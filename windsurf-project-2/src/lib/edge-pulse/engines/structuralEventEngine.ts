import type { CompletedCandle, SwingPoint } from "@/lib/market/engines/swingDetection";
import { evaluateSwingSequence } from "@/lib/market/engines/sequenceTrendEvaluator";

// ============================================================
// Edge Pulse — Structural Event Engine (BOS / CHoCH / Failed Break / False Break)
// ============================================================
// docs/edge-pulse-market-structure.md §17/§18/§20/§21. Reuses the EXACT
// same "close beyond a confirmed swing" / "wick pierced, closed back"
// comparisons swingDetection.ts's detectBreakout already uses for the
// single latest candle — generalized here to scan every candle in the
// series (same discipline as Liquidity Engine's findNearestSweep and
// Supply/Demand Engine's findRawZones), so a full BOS/CHoCH history can be
// built, not just "did the very last candle do something."
//
// The only genuinely new idea is the LABEL: whether a confirmed break
// agrees with (BOS) or contradicts (CHoCH) the swing-SEQUENCE trend that
// was already established at that point in time (evaluateSwingSequence,
// computed only from swings confirmed BEFORE the break — never leaking
// later swings into a historical judgement). No new low-level swing/
// breakout math is introduced; swingDetection.ts is untouched.

export type StructuralEventType = "BOS" | "CHoCH";
export type StructuralEventStatus = "confirmed" | "false_break";

export interface StructuralEvent {
  type: StructuralEventType;
  direction: "bullish" | "bearish";
  price: number; // the swing level that was broken
  brokenSwingDatetime: string; // when the broken swing itself formed
  confirmedAt: string; // ISO timestamp of the candle whose close confirmed the break
  status: StructuralEventStatus;
}

export interface FailedBreak {
  direction: "bullish" | "bearish";
  price: number;
  candleDatetime: string;
}

export interface StructuralEventsResult {
  events: StructuralEvent[]; // every event found, chronological order, INCLUDING false breaks (collapsed evidence only)
  lastBOS: StructuralEvent | null; // most recent CONFIRMED (non-false-break) BOS
  lastCHoCH: StructuralEvent | null; // most recent CONFIRMED (non-false-break) CHoCH
  lastFailedBreak: FailedBreak | null;
}

// docs §21: "e.g. 2-3 candles, to be calibrated against real data, never
// invented from nothing." Set to 3 — matches the upper end of that
// documented range; a confirmed break that reverses back through the
// level within 3 closed candles retroactively relabels as False Break.
const FALSE_BREAK_CONFIRMATION_WINDOW = 3;

// Same window evaluateSwingSequence defaults to — a break is only
// labelled BOS/CHoCH when a clear bull/bear sequence trend was already
// established; a break of a range/mixed/unknown structure's boundary is
// neither (docs §17: "for a range, beyond the range's own boundary" is a
// distinct, narrower concept this engine does not yet label — staying
// scoped to what Sprint 2 actually asks for).
const SEQUENCE_WINDOW = 5;

function priorSwing(swings: SwingPoint[], beforeIndex: number): SwingPoint | null {
  return swings.filter((s) => s.index < beforeIndex).pop() ?? null;
}

export function computeStructuralEvents(chrono: CompletedCandle[], swingHighs: SwingPoint[], swingLows: SwingPoint[]): StructuralEventsResult {
  const events: StructuralEvent[] = [];
  const failedBreaks: FailedBreak[] = [];
  // A swing level is only ever "broken" once — the FIRST candle whose
  // close clears it is the event; every later candle that also happens to
  // stay beyond it is not a fresh, separate BOS/CHoCH.
  const brokenHighSwingIndices = new Set<number>();
  const brokenLowSwingIndices = new Set<number>();

  for (let i = 0; i < chrono.length; i++) {
    const candle = chrono[i];
    const priorHigh = priorSwing(swingHighs, i);
    const priorLow = priorSwing(swingLows, i);

    if (priorHigh && candle.close > priorHigh.price && !brokenHighSwingIndices.has(priorHigh.index)) {
      brokenHighSwingIndices.add(priorHigh.index);
      const sequenceBefore = evaluateSwingSequence(
        swingHighs.filter((s) => s.index < i),
        swingLows.filter((s) => s.index < i),
        SEQUENCE_WINDOW
      );
      if (sequenceBefore.trend === "bullish" || sequenceBefore.trend === "bearish") {
        events.push({
          type: sequenceBefore.trend === "bullish" ? "BOS" : "CHoCH",
          direction: "bullish",
          price: priorHigh.price,
          brokenSwingDatetime: priorHigh.datetime,
          confirmedAt: candle.datetime,
          status: "confirmed",
        });
      }
    } else if (priorHigh && candle.high > priorHigh.price && candle.close <= priorHigh.price) {
      failedBreaks.push({ direction: "bullish", price: priorHigh.price, candleDatetime: candle.datetime });
    }

    if (priorLow && candle.close < priorLow.price && !brokenLowSwingIndices.has(priorLow.index)) {
      brokenLowSwingIndices.add(priorLow.index);
      const sequenceBefore = evaluateSwingSequence(
        swingHighs.filter((s) => s.index < i),
        swingLows.filter((s) => s.index < i),
        SEQUENCE_WINDOW
      );
      if (sequenceBefore.trend === "bullish" || sequenceBefore.trend === "bearish") {
        events.push({
          type: sequenceBefore.trend === "bearish" ? "BOS" : "CHoCH",
          direction: "bearish",
          price: priorLow.price,
          brokenSwingDatetime: priorLow.datetime,
          confirmedAt: candle.datetime,
          status: "confirmed",
        });
      }
    } else if (priorLow && candle.low < priorLow.price && candle.close >= priorLow.price) {
      failedBreaks.push({ direction: "bearish", price: priorLow.price, candleDatetime: candle.datetime });
    }
  }

  // False Break relabelling (docs §21): scan forward up to
  // FALSE_BREAK_CONFIRMATION_WINDOW closed candles after each confirmed
  // event for a close back on the ORIGIN side of the broken level — same
  // "scan forward, don't stop at the first match" discipline that fixed
  // the Liquidity Engine's swept->consumed bug in Sprint 1.
  for (const event of events) {
    const eventIndex = chrono.findIndex((c) => c.datetime === event.confirmedAt);
    if (eventIndex === -1) continue;
    const scanEnd = Math.min(eventIndex + FALSE_BREAK_CONFIRMATION_WINDOW, chrono.length - 1);
    for (let k = eventIndex + 1; k <= scanEnd; k++) {
      const reversedBack = event.direction === "bullish" ? chrono[k].close < event.price : chrono[k].close > event.price;
      if (reversedBack) {
        event.status = "false_break";
        break;
      }
    }
  }

  const confirmed = events.filter((e) => e.status === "confirmed");
  const lastBOS = [...confirmed].reverse().find((e) => e.type === "BOS") ?? null;
  const lastCHoCH = [...confirmed].reverse().find((e) => e.type === "CHoCH") ?? null;
  const lastFailedBreak = failedBreaks.length > 0 ? failedBreaks[failedBreaks.length - 1] : null;

  return { events, lastBOS, lastCHoCH, lastFailedBreak };
}
