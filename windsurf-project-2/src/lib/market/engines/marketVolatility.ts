import type { InstrumentMarketHistory, MarketCandle } from "../types";

// ============================================================
// PropEdge — Market Volatility Engine (deterministic)
// ============================================================
// Pure function: InstrumentMarketHistory -> MarketVolatilityResult. No API
// calls, no React, no Supabase, no localStorage, no AI/LLM, no external
// indicator libraries. Classification is candle-range statistics only —
// high minus low, recent-vs-baseline median ratio, and how many recent
// candles are individually unusual. Close direction is never read
// anywhere in this file; volatility is a range concept, not a direction
// concept.
//
// Hard rule: index 0 of dailyCandles is always the currently-forming
// candle and is NEVER analysed — same rule and same empirical basis as
// the Market Regime and Market Phase engines. Only fully-formed OHLC
// candles at index 1+ are used.
//
// Threshold note (per the brief's "do not blindly accept these
// thresholds" instruction): the suggested windows (5 recent / 20
// baseline / 25 minimum) and bands (0.70 / 1.30 / 2.00) are kept as-is.
// They are accepted, not just defaulted to, for two concrete reasons:
//   1. The 1.3x / 2.0x multiples already exist as the "expansion" /
//      "strong expansion" vocabulary in marketPhase.ts — reusing the same
//      multiples here keeps range-ratio language consistent across every
//      Market Data engine instead of introducing a second, arbitrary
//      scale.
//   2. Using the MEDIAN of the 5-candle recent window (not the mean, not
//      the max, not the last candle) is what makes the persistence rule
//      (requirement 6) correct "for free": the median of 5 values is the
//      3rd order statistic, so if the median itself is >= a threshold,
//      at least 3 of the 5 candles are already >= that threshold. A lone
//      spike mathematically cannot move the median past a threshold on
//      its own — it takes a genuine majority. This is why the ratio path
//      needs no extra persistence gate of its own, while the separate
//      "at least 2 large candles" check below exists purely to catch the
//      opposite case: a handful of quiet candles diluting the median
//      while 2+ candles are independently unusual.
//
// Foundation-scope engine: not connected to EdgePilot, the API route, or
// any UI yet. Market Pulse / Conviction / Opportunity / Liquidity Engine /
// Breakout Engine are explicitly out of scope for this iteration and are
// not implemented here.

export type MarketVolatility = "low" | "normal" | "high" | "extreme" | "unknown";
export type MarketVolatilityConfidence = "low" | "medium" | "high";

export interface MarketVolatilityResult {
  symbol: string;
  volatility: MarketVolatility;
  confidence: MarketVolatilityConfidence;
  evidence: string[];
}

// ── Decision-rule constants (every threshold documented, none arbitrary) ──

const RECENT_WINDOW = 5;
const BASELINE_WINDOW = 20;
// Hard floor: a full recent window plus a full baseline window. Below
// this, the baseline itself would be partial or nonexistent, so the
// engine refuses to classify rather than guess.
const MIN_COMPLETED_CANDLES = RECENT_WINDOW + BASELINE_WINDOW; // 25

// Ratio bands (recentMedianRange / baselineMedianRange). Accepted as
// suggested — see the file header for why.
const LOW_THRESHOLD = 0.7; // ratio < this => low
const HIGH_THRESHOLD = 1.3; // ratio >= this (and < EXTREME) => high
const EXTREME_THRESHOLD = 2.0; // ratio >= this => extreme

// Persistence check (requirement 6): the multiple a single candle's range
// must exceed the baseline median by to count as "large" / "very large".
// Deliberately reuses HIGH_THRESHOLD / EXTREME_THRESHOLD rather than
// introducing separate numbers, so "1.3x baseline" means the same thing
// whether it's being applied to the 5-candle median or to one candle.
const LARGE_CANDLE_MULTIPLE = HIGH_THRESHOLD;
const VERY_LARGE_CANDLE_MULTIPLE = EXTREME_THRESHOLD;
// The requirement's explicit floor: one outlier is evidence, never the
// classifier; two or more is persistence.
const MIN_LARGE_CANDLES_FOR_PERSISTENCE = 2;
// A majority (3 of the 5-candle window) is treated as a *strong* signal
// for confidence purposes only — it does not change the classification
// itself, only how confidently it is reported.
const STRONG_LARGE_CANDLES = 3;

// "Decisive" sub-bands, used only for confidence scoring (never for
// classification) — how far into its band the ratio sits.
const DECISIVE_LOW_RATIO = 0.55;
const DECISIVE_NORMAL_MIN = 0.85;
const DECISIVE_NORMAL_MAX = 1.15;
const DECISIVE_HIGH_RATIO = 1.6;
const DECISIVE_EXTREME_RATIO = 2.5;

// Data-quality confidence bonus: the 25-candle floor plus two more full
// recent-window cycles (2x5) — the smallest round number that signals
// meaningfully more history than the bare minimum.
const AMPLE_DATA_CANDLES = 35;

interface CompletedCandle {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

function isCompleteCandle(c: MarketCandle): c is CompletedCandle {
  return typeof c.open === "number" && typeof c.high === "number" && typeof c.low === "number" && typeof c.close === "number";
}

function candleRange(c: CompletedCandle): number {
  return c.high - c.low;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function classifyByRatio(ratio: number): MarketVolatility {
  if (ratio < LOW_THRESHOLD) return "low";
  if (ratio < HIGH_THRESHOLD) return "normal";
  if (ratio < EXTREME_THRESHOLD) return "high";
  return "extreme";
}

export function computeMarketVolatility(history: InstrumentMarketHistory): MarketVolatilityResult {
  const symbol = history?.symbol ?? "unknown";
  const evidence: string[] = [];

  if (!history || !Array.isArray(history.dailyCandles) || history.dailyCandles.length === 0) {
    return { symbol, volatility: "unknown", confidence: "low", evidence: ["No daily candle history provided."] };
  }

  // Rule: index 0 is always the currently-forming candle — never analysed.
  const candidateSlots = history.dailyCandles.slice(1);
  // Rule: exclude invalid/missing OHLC candles honestly — never zero-fill.
  const completed = candidateSlots.filter(isCompleteCandle);

  if (completed.length < candidateSlots.length) {
    evidence.push(
      `${candidateSlots.length - completed.length} of ${candidateSlots.length} completed-slot candle(s) excluded for missing/malformed OHLC fields.`
    );
  }

  if (completed.length < MIN_COMPLETED_CANDLES) {
    evidence.push(
      `Only ${completed.length} usable completed candle(s); at least ${MIN_COMPLETED_CANDLES} are required (a ${RECENT_WINDOW}-candle recent window plus a ${BASELINE_WINDOW}-candle baseline) to classify volatility.`
    );
    return { symbol, volatility: "unknown", confidence: "low", evidence };
  }

  // dailyCandles is newest-first; the windows below reason chronologically.
  const chrono = [...completed].reverse();
  const recentSlice = chrono.slice(-RECENT_WINDOW);
  const baselineSlice = chrono.slice(-(RECENT_WINDOW + BASELINE_WINDOW), -RECENT_WINDOW);

  const recentMedianRange = median(recentSlice.map(candleRange));
  const baselineMedianRange = median(baselineSlice.map(candleRange));

  // Degenerate baseline: never divide by zero, never fabricate a number.
  if (baselineMedianRange === 0 && recentMedianRange === 0) {
    evidence.push(`Both the recent ${RECENT_WINDOW}-candle and baseline ${BASELINE_WINDOW}-candle median ranges are zero — no measurable volatility.`);
    return { symbol, volatility: "low", confidence: "low", evidence };
  }
  if (baselineMedianRange === 0) {
    evidence.push(
      `Baseline ${BASELINE_WINDOW}-candle median range is zero while the recent ${RECENT_WINDOW}-candle median range is ${recentMedianRange.toFixed(5)} — the ratio is unbounded, treated as extreme.`
    );
    return { symbol, volatility: "extreme", confidence: "low", evidence };
  }

  const ratio = recentMedianRange / baselineMedianRange;
  evidence.push(
    `Recent ${RECENT_WINDOW}-candle median range is ${ratio.toFixed(2)}x the prior ${BASELINE_WINDOW}-candle median range (${recentMedianRange.toFixed(5)} vs ${baselineMedianRange.toFixed(5)}).`
  );

  const baseLevel = classifyByRatio(ratio);

  // ── Persistence check (requirement 6) ──
  // Counts how many of the 5 recent candles are individually unusual,
  // independent of what the median says. This is what lets 2+ elevated
  // candles promote a classification the median alone diluted (e.g. 3
  // quiet candles + 2 large ones keeps the median low), while a single
  // spike (count === 1) is reported but never promotes anything.
  const largeCandleCount = recentSlice.filter((c) => candleRange(c) >= LARGE_CANDLE_MULTIPLE * baselineMedianRange).length;
  const veryLargeCandleCount = recentSlice.filter((c) => candleRange(c) >= VERY_LARGE_CANDLE_MULTIPLE * baselineMedianRange).length;

  evidence.push(
    `${largeCandleCount} of the last ${RECENT_WINDOW} completed candles exceed ${LARGE_CANDLE_MULTIPLE}x the baseline median range.`
  );
  if (veryLargeCandleCount > 0) {
    evidence.push(`${veryLargeCandleCount} of the last ${RECENT_WINDOW} completed candles exceed ${VERY_LARGE_CANDLE_MULTIPLE}x the baseline median range.`);
  }

  let volatility: MarketVolatility = baseLevel;
  let promoted = false;
  if (baseLevel === "low" || baseLevel === "normal") {
    if (veryLargeCandleCount >= MIN_LARGE_CANDLES_FOR_PERSISTENCE) {
      volatility = "extreme";
      promoted = true;
    } else if (largeCandleCount >= MIN_LARGE_CANDLES_FOR_PERSISTENCE) {
      volatility = "high";
      promoted = true;
    }
  } else if (baseLevel === "high" && veryLargeCandleCount >= MIN_LARGE_CANDLES_FOR_PERSISTENCE) {
    volatility = "extreme";
    promoted = true;
  }

  if (promoted) {
    evidence.push(
      `Ratio alone suggested "${baseLevel}", but ${volatility === "extreme" ? veryLargeCandleCount : largeCandleCount} of the last ${RECENT_WINDOW} candles independently exceed ${volatility === "extreme" ? VERY_LARGE_CANDLE_MULTIPLE : LARGE_CANDLE_MULTIPLE}x baseline — the persistence rule promotes the result to "${volatility}".`
    );
  } else if (largeCandleCount === 1 && volatility !== "high" && volatility !== "extreme") {
    evidence.push(
      `Exactly one of the last ${RECENT_WINDOW} candles is unusually large (>= ${LARGE_CANDLE_MULTIPLE}x baseline) — a single outlier alone does not change the classification.`
    );
  }

  // ── Confidence: derived only from deterministic evidence, never a percentage ──
  let decisive: boolean;
  switch (volatility) {
    case "low":
      decisive = ratio <= DECISIVE_LOW_RATIO;
      break;
    case "normal":
      decisive = ratio >= DECISIVE_NORMAL_MIN && ratio <= DECISIVE_NORMAL_MAX;
      break;
    case "high":
      decisive = ratio >= DECISIVE_HIGH_RATIO || largeCandleCount >= STRONG_LARGE_CANDLES;
      break;
    case "extreme":
      decisive = ratio >= DECISIVE_EXTREME_RATIO || veryLargeCandleCount >= STRONG_LARGE_CANDLES;
      break;
    default:
      decisive = false;
  }
  const ampleData = completed.length >= AMPLE_DATA_CANDLES;
  const score = (decisive ? 1 : 0) + (ampleData ? 1 : 0);
  const confidence: MarketVolatilityConfidence = score >= 2 ? "high" : score === 1 ? "medium" : "low";

  evidence.push(`Confidence set to "${confidence}" from ${score} confirming condition(s) (decisive ratio/persistence: ${decisive}, ample history: ${ampleData}).`);

  return { symbol, volatility, confidence, evidence };
}
