import type { InstrumentMarketHistory, MarketCandle, HistoryQuality } from "@/lib/market/types";
import { computeMarketRegime } from "@/lib/market/engines/marketRegime";
import { computeMarketPhase } from "@/lib/market/engines/marketPhase";
import { detectSwings, detectBreakout, isCompleteCandle, type CompletedCandle } from "@/lib/market/engines/swingDetection";
import { evaluateSwingSequence, SequenceTrend, SequenceConsistency, DirectionCounts } from "@/lib/market/engines/sequenceTrendEvaluator";
import { computeStructuralEvents, StructuralEvent, FailedBreak } from "./structuralEventEngine";
import { MultiTimeframeHistory, Timeframe, TIMEFRAME_LABEL, STRUCTURE_TIMEFRAMES } from "../types";

// ============================================================
// Edge Pulse — Structure Engine (multi-timeframe, deterministic)
// ============================================================
// Composes the EXISTING, unmodified computeMarketRegime/computeMarketPhase
// (both pure functions over InstrumentMarketHistory.dailyCandles — neither
// cares what wall-clock interval those candles represent, only how many
// completed candles there are) across 4 timeframes, by handing each
// timeframe's own candle array into that same "dailyCandles" slot. This is
// intentional maximum reuse, not a hack: MIN_COMPLETED_CANDLES,
// RECENT_WINDOW, etc. are all candle-COUNT thresholds, equally valid
// whether the candles are daily or M15. No engine file is modified here.
//
// Swing points and breakout direction are independently recovered (via the
// shared swingDetection.ts utility) purely to report the "latest HH/HL" /
// "LH/LL" display values and to distinguish a confirmed trend from a fresh,
// unconfirmed "Shift" — MarketRegimeResult itself does not expose swings,
// and its own shape must not change.
//
// Sprint 2 / Phase 2 (docs/edge-pulse-market-structure.md) additions below
// are ADDITIVE ONLY: `bias`, `color`, `latestHH/HL/LH/LL` are computed by
// the exact same logic as before (verified byte-identical against
// scripts/structure-engine-scenarios.ts) — new fields sit alongside them,
// nothing existing was renamed, removed, or recomputed differently.

export type StructureBiasLabel =
  | "Bullish"
  | "Bearish"
  | "Bullish Pullback"
  | "Bearish Pullback"
  | "Bullish Shift"
  | "Bearish Shift"
  | "Ranging"
  | "Transition"
  | "Unavailable";

export type StructureColor = "green" | "red" | "yellow" | "gray";
export type TimeframeAlignment = "aligned" | "conflicting" | "not_applicable";

// A row needs at least this many completed candles before swing points are
// even attempted — matches computeMarketRegime's own MIN_COMPLETED_CANDLES
// floor conceptually (below this, a fractal window can't resolve at all).
const MIN_CANDLES_FOR_SWINGS = 5;

// docs §13/§14's Pullback/Correction boundary: the SAME 0.5%-20% band
// marketPhase.ts's (untouched) evaluatePullback already uses for
// "pullback" is reused here only as the LOWER bound past which a deeper
// retracement becomes "Correction" instead — this file does not import or
// alter evaluatePullback, it independently measures retracement using the
// same simple geometry (find the extreme in a lookback, measure % back to
// the latest close) so marketPhase.ts stays completely untouched.
const CORRECTION_LOOKBACK = 10; // same window as evaluatePullback's own PULLBACK_LOOKBACK
const CORRECTION_MIN_RETRACEMENT = 0.2; // docs §14: "deeper than Pullback's bound (20%)"
const CORRECTION_MAX_RETRACEMENT = 0.5; // beyond 50% back into the prior move, this reads as a reversal already underway, not a correction

export interface TimeframeStructureRow {
  timeframe: Timeframe;
  label: string;
  bias: StructureBiasLabel;
  color: StructureColor;
  latestHH: number | null;
  latestHL: number | null;
  latestLH: number | null;
  latestLL: number | null;
  quality: HistoryQuality;

  // Sprint 2 / Phase 2 (docs/edge-pulse-market-structure.md) — additive.
  sequenceTrend: SequenceTrend; // docs §7/§3 — judged from the last 3-5 swings, not just the last two
  sequenceConsistency: SequenceConsistency;
  // Sprint 2 / Phase 3 — the raw per-side direction counts behind
  // sequenceTrend, exposed so the interpretation layer can classify
  // "which way is a mixed read leaning" without recomputing swings itself.
  sequenceHighs: DirectionCounts;
  sequenceLows: DirectionCounts;
  compression: boolean; // docs §11 — computed by marketPhase.ts today but previously discarded here entirely
  expansion: boolean; // docs §12 — same
  rotation: boolean; // docs (Range/Rotation note) — same
  correction: boolean; // docs §14 — NEW, not previously implemented
  lastBOS: StructuralEvent | null; // docs §17
  lastCHoCH: StructuralEvent | null; // docs §18
  lastFailedBreak: FailedBreak | null; // docs §20 (already-implemented primitive, now exposed)
  reversal: boolean; // docs §15 — CHoCH + a since-confirmed opposite sequence trend
  higherTimeframeAlignment: TimeframeAlignment; // docs's "timeframe hierarchy" — this row's sequence trend vs. the next-higher timeframe's
}

export interface StructureResult {
  symbol: string;
  rows: TimeframeStructureRow[]; // one per STRUCTURE_TIMEFRAMES, in that order
  disagreement: boolean; // true when at least one available row leans bullish AND at least one leans bearish
}

// Reshapes an arbitrary timeframe's candles into the exact shape
// computeMarketRegime/computeMarketPhase already expect — weeklyCandles is
// intentionally empty (these two engines never read it).
function toHistoryShape(symbol: string, candles: MarketCandle[], quality: HistoryQuality): InstrumentMarketHistory {
  return {
    symbol,
    currentPrice: candles[0]?.close ?? null,
    dailyCandles: candles,
    weeklyCandles: [],
    dataQuality: { dailyHistory: quality, weeklyHistory: "unavailable" },
  };
}

const UNAVAILABLE_ROW = (timeframe: Timeframe): TimeframeStructureRow => ({
  timeframe,
  label: TIMEFRAME_LABEL[timeframe],
  bias: "Unavailable",
  color: "gray",
  latestHH: null,
  latestHL: null,
  latestLH: null,
  latestLL: null,
  quality: "unavailable",
  sequenceTrend: "unknown",
  sequenceConsistency: "weak",
  sequenceHighs: { higher: 0, lower: 0, equal: 0 },
  sequenceLows: { higher: 0, lower: 0, equal: 0 },
  compression: false,
  expansion: false,
  rotation: false,
  correction: false,
  lastBOS: null,
  lastCHoCH: null,
  lastFailedBreak: null,
  reversal: false,
  higherTimeframeAlignment: "not_applicable",
});

// Independent retracement measurement (docs §14) — deliberately NOT a call
// into marketPhase.ts's private evaluatePullback (untouched); this is the
// same simple geometry (extreme-in-lookback vs. latest close) recomputed
// here so Correction can be judged without altering that file at all.
function measureRetracement(chrono: CompletedCandle[], bullish: boolean): number | null {
  const window = chrono.slice(-CORRECTION_LOOKBACK);
  if (window.length < 2) return null;

  let extremeIndex = 0;
  for (let i = 1; i < window.length; i++) {
    if (bullish ? window[i].high > window[extremeIndex].high : window[i].low < window[extremeIndex].low) extremeIndex = i;
  }
  if (extremeIndex === window.length - 1) return null; // still making new extremes — no retracement yet

  const extreme = window[extremeIndex];
  const last = window[window.length - 1];
  return bullish ? (extreme.high - last.close) / extreme.high : (last.close - extreme.low) / extreme.low;
}

function computeRow(symbol: string, timeframe: Timeframe, candles: MarketCandle[], quality: HistoryQuality): TimeframeStructureRow {
  if (quality === "unavailable" || candles.length === 0) return UNAVAILABLE_ROW(timeframe);

  const history = toHistoryShape(symbol, candles, quality);
  const regime = computeMarketRegime(history);
  const phase = computeMarketPhase(history, regime);

  // Rule: index 0 is always the currently-forming candle — never analysed.
  // Same rule computeMarketRegime already applies internally; recomputed
  // here (independently, via the shared utility) to surface display values
  // and the new Sprint 2 fields, never to override the already-decided
  // regime/phase.
  const completed = candles.slice(1).filter(isCompleteCandle);
  const chrono = [...completed].reverse();
  const swings = chrono.length >= MIN_CANDLES_FOR_SWINGS ? detectSwings(chrono) : [];
  const highs = swings.filter((s) => s.type === "high");
  const lows = swings.filter((s) => s.type === "low");

  const sequence = evaluateSwingSequence(highs, lows);
  const structuralEvents = computeStructuralEvents(chrono, highs, lows);
  const compression = phase.phase === "compression";
  const expansion = phase.phase === "expansion";
  const rotation = phase.phase === "rotation";

  // Correction (docs §14): a retracement deeper than Pullback's own 20%
  // band, still short of a confirmed CHoCH, judged against the SEQUENCE
  // trend (not the 2-swing regime) — never labelled for a range/mixed/
  // unknown sequence, matching Pullback's own "never without trend
  // context" rule.
  let correction = false;
  if (sequence.trend === "bullish" || sequence.trend === "bearish") {
    const retracement = measureRetracement(chrono, sequence.trend === "bullish");
    const noConfirmedChoch = structuralEvents.lastCHoCH === null;
    if (retracement !== null && retracement >= CORRECTION_MIN_RETRACEMENT && retracement <= CORRECTION_MAX_RETRACEMENT && noConfirmedChoch) {
      correction = true;
    }
  }

  // Reversal (docs §15): a confirmed CHoCH exists, AND the sequence trend
  // computed from ALL currently available swings now agrees with the
  // CHoCH's own direction — i.e. a second confirming swing has since
  // formed in the new direction, not merely one broken level.
  const reversal =
    structuralEvents.lastCHoCH !== null &&
    ((structuralEvents.lastCHoCH.direction === "bearish" && sequence.trend === "bearish") ||
      (structuralEvents.lastCHoCH.direction === "bullish" && sequence.trend === "bullish"));

  if (regime.regime === "unknown") {
    // Even when the (2-swing) regime can't resolve, phase-derived and
    // sequence-derived reads may still be meaningful — surfaced here
    // additively; bias/color stay "Unavailable"/"gray" exactly as before.
    return {
      ...UNAVAILABLE_ROW(timeframe),
      quality,
      sequenceTrend: sequence.trend,
      sequenceConsistency: sequence.consistency,
      sequenceHighs: sequence.highs,
      sequenceLows: sequence.lows,
      compression,
      expansion,
      rotation,
      lastBOS: structuralEvents.lastBOS,
      lastCHoCH: structuralEvents.lastCHoCH,
      lastFailedBreak: structuralEvents.lastFailedBreak,
    };
  }

  const breakout = chrono.length > 0 ? detectBreakout(chrono, highs, lows) : { direction: null, failed: false, detail: "" };

  // The most recent confirmed swing high/low, in trader terms: labelled HH/HL
  // when the read is bullish-leaning, LH/LL when bearish-leaning — same two
  // underlying swing points either way, just the vocabulary a trader
  // expects for the direction in play. Ranging/Transition rows report both
  // (there is no single "higher" side to prefer).
  const latestSwingHigh = highs.length > 0 ? highs[highs.length - 1].price : null;
  const latestSwingLow = lows.length > 0 ? lows[lows.length - 1].price : null;

  let bias: StructureBiasLabel;
  let color: StructureColor;
  let bullishLabelling: boolean;

  if (regime.regime === "bullish_trend") {
    bias = phase.phase === "pullback" ? "Bullish Pullback" : "Bullish";
    color = "green";
    bullishLabelling = true;
  } else if (regime.regime === "bearish_trend") {
    bias = phase.phase === "pullback" ? "Bearish Pullback" : "Bearish";
    color = "red";
    bullishLabelling = false;
  } else if (regime.regime === "range") {
    bias = "Ranging";
    color = "yellow";
    bullishLabelling = true; // arbitrary for a range — both fields are populated below regardless
  } else {
    // transition: a fresh, unconfirmed directional break reads as a
    // "Shift" (matches marketRegime.ts's own rule that a breakout override
    // is exactly what produces "transition" in the common case); anything
    // else (e.g. disagreeing equal-high/equal-low structure) stays a plain
    // "Transition" — never overstate an unconfirmed read as a trend.
    if (breakout.direction === "bullish") {
      bias = "Bullish Shift";
      bullishLabelling = true;
    } else if (breakout.direction === "bearish") {
      bias = "Bearish Shift";
      bullishLabelling = false;
    } else {
      bias = "Transition";
      bullishLabelling = true;
    }
    color = "yellow";
  }

  const showBoth = regime.regime === "range" || bias === "Transition";

  return {
    timeframe,
    label: TIMEFRAME_LABEL[timeframe],
    bias,
    color,
    latestHH: bullishLabelling || showBoth ? latestSwingHigh : null,
    latestHL: bullishLabelling || showBoth ? latestSwingLow : null,
    latestLH: !bullishLabelling || showBoth ? latestSwingHigh : null,
    latestLL: !bullishLabelling || showBoth ? latestSwingLow : null,
    quality,
    sequenceTrend: sequence.trend,
    sequenceConsistency: sequence.consistency,
    sequenceHighs: sequence.highs,
    sequenceLows: sequence.lows,
    compression,
    expansion,
    rotation,
    correction,
    lastBOS: structuralEvents.lastBOS,
    lastCHoCH: structuralEvents.lastCHoCH,
    lastFailedBreak: structuralEvents.lastFailedBreak,
    reversal,
    higherTimeframeAlignment: "not_applicable", // filled in by computeStructure, which has cross-row context
  };
}

export function computeStructure(symbol: string, history: MultiTimeframeHistory): StructureResult {
  const rows: TimeframeStructureRow[] = STRUCTURE_TIMEFRAMES.map((tf) => {
    const tfHistory = history[tf];
    return computeRow(symbol, tf, tfHistory.candles, tfHistory.quality);
  });

  // Timeframe hierarchy (docs's "timeframe hierarchy" objective): STRUCTURE_TIMEFRAMES
  // is already ordered highest-to-lowest (daily, h4, h1, m15) — each row's
  // "higher timeframe" is simply the row before it in this same array.
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const higher = rows[i - 1];
    if (row.quality === "unavailable" || higher.quality === "unavailable" || row.sequenceTrend === "unknown" || higher.sequenceTrend === "unknown") {
      row.higherTimeframeAlignment = "not_applicable";
    } else if (row.sequenceTrend === "mixed" || row.sequenceTrend === "range" || higher.sequenceTrend === "mixed" || higher.sequenceTrend === "range") {
      row.higherTimeframeAlignment = "not_applicable";
    } else {
      row.higherTimeframeAlignment = row.sequenceTrend === higher.sequenceTrend ? "aligned" : "conflicting";
    }
  }

  const bullishLeaning = new Set<StructureBiasLabel>(["Bullish", "Bullish Pullback", "Bullish Shift"]);
  const bearishLeaning = new Set<StructureBiasLabel>(["Bearish", "Bearish Pullback", "Bearish Shift"]);
  const anyBullish = rows.some((r) => bullishLeaning.has(r.bias));
  const anyBearish = rows.some((r) => bearishLeaning.has(r.bias));

  return { symbol, rows, disagreement: anyBullish && anyBearish };
}
