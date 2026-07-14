import type { MarketCandle } from "../types";

// ============================================================
// PropEdge — Swing detection (shared pure utility)
// ============================================================
// Extracted verbatim from marketRegime.ts so multiple consumers (the
// single-timeframe Market Regime Engine, and Edge Pulse's multi-timeframe
// Structure/Liquidity/Supply-Demand engines) can share one swing-detection
// implementation instead of duplicating it. Behavior is byte-identical to
// what marketRegime.ts had inlined before this extraction — this file only
// relocates code, it does not change any decision rule.
//
// Pure functions only — no API calls, no React, no AI/LLM. Callers own
// their own completed-candle filtering (e.g. "index 0 is the
// currently-forming candle, never analysed") — this file only reasons
// about whatever chronological candle array it's given.

// 5-bar fractal: a candle is a swing point only if it is the strict,
// unique extreme among itself and 2 candles on each side (classic
// Williams-fractal window). Callers on shorter timeframes may need a
// different wing size for equivalent noise rejection — pass it explicitly
// rather than relying on this default when timeframe-tuning matters.
export const DEFAULT_FRACTAL_WING = 2;

export interface CompletedCandle {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface SwingPoint {
  type: "high" | "low";
  index: number; // position within the chronological completed-candle array
  price: number;
  datetime: string;
}

export type Direction = "higher" | "lower" | "equal";

export function isCompleteCandle(c: MarketCandle): c is CompletedCandle {
  return typeof c.open === "number" && typeof c.high === "number" && typeof c.low === "number" && typeof c.close === "number";
}

export function classifyDirection(prev: number, curr: number): Direction {
  if (curr > prev) return "higher";
  if (curr < prev) return "lower";
  return "equal";
}

// 5-bar fractal swing detection. A candle at i is a swing high iff its
// high is the strict, unique maximum among [i-2, i+2]; the symmetric rule
// applies to swing lows on the low field. A tie within the window never
// produces a swing point — an ambiguous extreme is not a confirmed pivot
// (this is what makes "equal highs" / "equal lows" fixtures resolve
// deterministically instead of arbitrarily picking one candle).
export function detectSwings(chrono: CompletedCandle[], wing: number = DEFAULT_FRACTAL_WING): SwingPoint[] {
  const swings: SwingPoint[] = [];
  for (let i = wing; i < chrono.length - wing; i++) {
    const window = chrono.slice(i - wing, i + wing + 1);
    const center = chrono[i];

    const highs = window.map((c) => c.high);
    const maxHigh = Math.max(...highs);
    if (center.high === maxHigh && highs.filter((h) => h === maxHigh).length === 1) {
      swings.push({ type: "high", index: i, price: center.high, datetime: center.datetime });
    }

    const lows = window.map((c) => c.low);
    const minLow = Math.min(...lows);
    if (center.low === minLow && lows.filter((l) => l === minLow).length === 1) {
      swings.push({ type: "low", index: i, price: center.low, datetime: center.datetime });
    }
  }
  return swings;
}

export interface BreakoutSignal {
  direction: "bullish" | "bearish" | null;
  failed: boolean;
  detail: string;
}

// Breakout / failed-breakout of the latest completed candle against the
// nearest confirmed swing level before it. A breakout is a CLOSE beyond
// the level; a pierce that closes back inside the level is a failed
// breakout. Deliberately looks only at the single latest completed
// candle — one candle can signal a breakout attempt, but it can never by
// itself promote a fresh regime past "transition" (that combine step is
// each caller's own responsibility, not this utility's).
export function detectBreakout(chrono: CompletedCandle[], swingHighs: SwingPoint[], swingLows: SwingPoint[]): BreakoutSignal {
  const lastIndex = chrono.length - 1;
  const last = chrono[lastIndex];
  const priorHigh = swingHighs.filter((s) => s.index < lastIndex).pop() ?? null;
  const priorLow = swingLows.filter((s) => s.index < lastIndex).pop() ?? null;

  if (priorHigh && last.close > priorHigh.price) {
    return {
      direction: "bullish",
      failed: false,
      detail: `Latest completed close ${last.close} broke above the prior swing high ${priorHigh.price} (${priorHigh.datetime}).`,
    };
  }
  if (priorHigh && last.high > priorHigh.price && last.close <= priorHigh.price) {
    return {
      direction: null,
      failed: true,
      detail: `Latest completed high ${last.high} pierced the prior swing high ${priorHigh.price} but closed back below it — failed breakout.`,
    };
  }
  if (priorLow && last.close < priorLow.price) {
    return {
      direction: "bearish",
      failed: false,
      detail: `Latest completed close ${last.close} broke below the prior swing low ${priorLow.price} (${priorLow.datetime}).`,
    };
  }
  if (priorLow && last.low < priorLow.price && last.close >= priorLow.price) {
    return {
      direction: null,
      failed: true,
      detail: `Latest completed low ${last.low} pierced the prior swing low ${priorLow.price} but closed back above it — failed breakout.`,
    };
  }
  return { direction: null, failed: false, detail: "No breakout beyond the nearest confirmed swing level on the latest completed candle." };
}
