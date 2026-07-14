import type { InstrumentMarketHistory, MarketCandle, HistoryQuality } from "@/lib/market/types";
import { computeMarketRegime } from "@/lib/market/engines/marketRegime";
import { computeMarketPhase } from "@/lib/market/engines/marketPhase";
import { detectSwings, detectBreakout, isCompleteCandle } from "@/lib/market/engines/swingDetection";
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

// A row needs at least this many completed candles before swing points are
// even attempted — matches computeMarketRegime's own MIN_COMPLETED_CANDLES
// floor conceptually (below this, a fractal window can't resolve at all).
const MIN_CANDLES_FOR_SWINGS = 5;

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
});

function computeRow(symbol: string, timeframe: Timeframe, candles: MarketCandle[], quality: HistoryQuality): TimeframeStructureRow {
  if (quality === "unavailable" || candles.length === 0) return UNAVAILABLE_ROW(timeframe);

  const history = toHistoryShape(symbol, candles, quality);
  const regime = computeMarketRegime(history);
  const phase = computeMarketPhase(history, regime);

  if (regime.regime === "unknown") {
    return { ...UNAVAILABLE_ROW(timeframe), quality };
  }

  // Rule: index 0 is always the currently-forming candle — never analysed.
  // Same rule computeMarketRegime already applies internally; recomputed
  // here (independently, via the shared utility) only to surface display
  // values, never to override the already-decided regime/phase.
  const completed = candles.slice(1).filter(isCompleteCandle);
  const chrono = [...completed].reverse();
  const swings = chrono.length >= MIN_CANDLES_FOR_SWINGS ? detectSwings(chrono) : [];
  const highs = swings.filter((s) => s.type === "high");
  const lows = swings.filter((s) => s.type === "low");
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
  };
}

export function computeStructure(symbol: string, history: MultiTimeframeHistory): StructureResult {
  const rows: TimeframeStructureRow[] = STRUCTURE_TIMEFRAMES.map((tf) => {
    const tfHistory = history[tf];
    return computeRow(symbol, tf, tfHistory.candles, tfHistory.quality);
  });

  const bullishLeaning = new Set<StructureBiasLabel>(["Bullish", "Bullish Pullback", "Bullish Shift"]);
  const bearishLeaning = new Set<StructureBiasLabel>(["Bearish", "Bearish Pullback", "Bearish Shift"]);
  const anyBullish = rows.some((r) => bullishLeaning.has(r.bias));
  const anyBearish = rows.some((r) => bearishLeaning.has(r.bias));

  return { symbol, rows, disagreement: anyBullish && anyBearish };
}
