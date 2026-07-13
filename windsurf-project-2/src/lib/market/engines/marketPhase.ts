import type { InstrumentMarketHistory, MarketCandle } from "../types";
import type { MarketRegimeResult } from "./marketRegime";

// ============================================================
// PropEdge — Market Phase Engine (deterministic)
// ============================================================
// Pure function: InstrumentMarketHistory (+ optional MarketRegimeResult)
// -> MarketPhaseResult. No API calls, no React, no Supabase, no
// localStorage, no AI/LLM, no external indicators. Classification is
// price structure only: candle-range contraction/expansion relative to a
// baseline window, consecutive-range overlap, structural containment, and
// (when a trend regime is supplied) retracement from the recent extreme.
//
// Hard rule: index 0 of dailyCandles is always the currently-forming
// candle and is NEVER analysed — same rule and same empirical basis as
// the Market Regime Engine. Only fully-formed OHLC candles at index 1+
// are used.
//
// Foundation-scope engine: not connected to EdgePilot, the API route, or
// any UI yet. Market Pulse / Conviction / Volatility / Opportunity /
// Liquidity Engine / the full Breakout Engine are explicitly out of scope
// for this iteration and are not implemented here.

export type MarketPhase = "compression" | "expansion" | "pullback" | "rotation" | "unknown";
export type MarketPhaseConfidence = "low" | "medium" | "high";

export interface MarketPhaseResult {
  symbol: string;
  phase: MarketPhase;
  confidence: MarketPhaseConfidence;
  evidence: string[];
}

// ── Decision-rule constants (every threshold documented, none arbitrary) ──

// Recent window vs. the baseline window immediately before it — the
// comparison every contraction/expansion read is anchored on.
const RECENT_WINDOW = 6;
const BASELINE_WINDOW = 12;
// Hard floor: a full recent window plus a full baseline window. Below
// this, contraction/expansion comparisons would be built on a partial or
// nonexistent baseline, so the engine refuses to classify rather than
// guess.
const MIN_COMPLETED_CANDLES = RECENT_WINDOW + BASELINE_WINDOW; // 18

// Compression: the recent median range must fall to <=70% of the baseline
// median range to count as "contracting". <=50% is treated as strong
// contraction for confidence purposes.
const CONTRACTION_RATIO_THRESHOLD = 0.7;
const STRONG_CONTRACTION_RATIO_THRESHOLD = 0.5;
// Expansion: the latest completed candle's range must reach >=150% of the
// baseline median range to count as "expanding". >=200% is strong.
const EXPANSION_RANGE_RATIO_THRESHOLD = 1.5;
const STRONG_EXPANSION_RANGE_RATIO_THRESHOLD = 2.0;
// Compression's overlap check: >=60% of consecutive candle-range pairs in
// the recent window must overlap.
const OVERLAP_RATIO_THRESHOLD = 0.6;

// Pullback: how far back to look for the swing extreme the retracement is
// measured from.
const PULLBACK_LOOKBACK = 10;
// A retracement below 0.5% is noise, not a real corrective move; beyond
// 20% it is no longer "corrective" — it is challenging the trend
// structure itself, which is not this engine's call to make.
const MIN_PULLBACK_RETRACEMENT = 0.005;
const MAX_PULLBACK_RETRACEMENT = 0.2;
// A retracement comfortably inside [2%, 15%] is the "textbook" corrective
// band used as one of two confidence-boosting conditions.
const PULLBACK_STRONG_BAND_MIN = 0.02;
const PULLBACK_STRONG_BAND_MAX = 0.15;
// At least 2 candles since the extreme must close against the trend for
// the move to be a real pullback, not one candle's noise; 3+ is strong.
const PULLBACK_MIN_COUNTER_CLOSES = 2;
const PULLBACK_STRONG_COUNTER_CLOSES = 3;

// Rotation: window used to count directional alternations in closes, and
// the minimum/strong alternation counts.
const ROTATION_WINDOW = 8;
const ROTATION_MIN_ALTERNATIONS = 3;
const ROTATION_STRONG_ALTERNATIONS = 4;

// Data-quality confidence bonus shared by expansion/rotation: strictly
// more than the 18-candle floor, the smallest round number that signals
// the caller supplied meaningfully more than the bare minimum.
const AMPLE_DATA_CANDLES = 24;

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

// Fraction of consecutive candle-range pairs that overlap (a candle's
// [low, high] intersects the previous candle's [low, high]).
function overlapRatio(candles: CompletedCandle[]): { ratio: number; overlapCount: number; pairs: number } {
  if (candles.length < 2) return { ratio: 0, overlapCount: 0, pairs: 0 };
  let overlapCount = 0;
  for (let i = 1; i < candles.length; i++) {
    const overlapHigh = Math.min(candles[i - 1].high, candles[i].high);
    const overlapLow = Math.max(candles[i - 1].low, candles[i].low);
    if (overlapHigh >= overlapLow) overlapCount++;
  }
  const pairs = candles.length - 1;
  return { ratio: pairs > 0 ? overlapCount / pairs : 0, overlapCount, pairs };
}

interface PullbackEvaluation {
  confidence: MarketPhaseConfidence;
  evidence: string[];
}

// Evaluates a pullback only when a trend regime (bullish or bearish) has
// already been established by the caller — this engine never infers trend
// context on its own, per the rule that a countertrend move must never be
// labelled "pullback" when the regime is range/transition/unknown.
// Returns null when the criteria aren't met, so the caller falls through
// to the context-free phase checks.
function evaluatePullback(chrono: CompletedCandle[], regime: MarketRegimeResult): PullbackEvaluation | null {
  const lookback = chrono.slice(-PULLBACK_LOOKBACK);
  const last = lookback[lookback.length - 1];
  const bullish = regime.regime === "bullish_trend";

  let extremeIndex = 0;
  for (let i = 1; i < lookback.length; i++) {
    if (bullish ? lookback[i].high > lookback[extremeIndex].high : lookback[i].low < lookback[extremeIndex].low) {
      extremeIndex = i;
    }
  }
  const extreme = lookback[extremeIndex];

  // The extreme must have happened before the latest candle — if price is
  // still making new highs/lows, there has been no pullback yet.
  if (extremeIndex === lookback.length - 1) return null;

  const retracement = bullish ? (extreme.high - last.close) / extreme.high : (last.close - extreme.low) / extreme.low;
  if (retracement < MIN_PULLBACK_RETRACEMENT || retracement > MAX_PULLBACK_RETRACEMENT) return null;

  let counterCloses = 0;
  for (let i = extremeIndex + 1; i < lookback.length; i++) {
    const counter = bullish ? lookback[i].close < lookback[i - 1].close : lookback[i].close > lookback[i - 1].close;
    if (counter) counterCloses++;
  }
  if (counterCloses < PULLBACK_MIN_COUNTER_CLOSES) return null;

  const strongBand = retracement >= PULLBACK_STRONG_BAND_MIN && retracement <= PULLBACK_STRONG_BAND_MAX;
  const strongCounter = counterCloses >= PULLBACK_STRONG_COUNTER_CLOSES;
  const score = (strongBand ? 1 : 0) + (strongCounter ? 1 : 0);
  const confidence: MarketPhaseConfidence = score >= 2 ? "high" : score === 1 ? "medium" : "low";

  const extremeLabel = bullish ? "high" : "low";
  const extremeValue = bullish ? extreme.high : extreme.low;

  return {
    confidence,
    evidence: [
      `${bullish ? "Bullish" : "Bearish"} trend context confirmed via regime (${regime.regime}); measuring retracement from the recent ${PULLBACK_LOOKBACK}-candle ${extremeLabel}.`,
      `Retracement from recent ${extremeLabel} ${extremeValue} (${extreme.datetime}) to latest close ${last.close} is ${(retracement * 100).toFixed(1)}% (corrective band ${(MIN_PULLBACK_RETRACEMENT * 100).toFixed(1)}%-${(MAX_PULLBACK_RETRACEMENT * 100).toFixed(1)}%).`,
      `${counterCloses} candle(s) since that ${extremeLabel} closed ${bullish ? "lower" : "higher"} than the candle before them (threshold ${PULLBACK_MIN_COUNTER_CLOSES}).`,
      `Confidence set to "${confidence}" from ${score} confirming condition(s) (strong band: ${strongBand}, strong counter-close count: ${strongCounter}).`,
    ],
  };
}

export function computeMarketPhase(history: InstrumentMarketHistory, regime?: MarketRegimeResult): MarketPhaseResult {
  const symbol = history?.symbol ?? "unknown";
  const evidence: string[] = [];

  if (!history || !Array.isArray(history.dailyCandles) || history.dailyCandles.length === 0) {
    return { symbol, phase: "unknown", confidence: "low", evidence: ["No daily candle history provided."] };
  }

  // Rule: index 0 is always the currently-forming candle — never analysed.
  const candidateSlots = history.dailyCandles.slice(1);
  const completed = candidateSlots.filter(isCompleteCandle);

  if (completed.length < candidateSlots.length) {
    evidence.push(
      `${candidateSlots.length - completed.length} of ${candidateSlots.length} completed-slot candle(s) excluded for missing/malformed OHLC fields.`
    );
  }

  if (completed.length < MIN_COMPLETED_CANDLES) {
    evidence.push(
      `Only ${completed.length} usable completed candle(s); at least ${MIN_COMPLETED_CANDLES} are required (a ${RECENT_WINDOW}-candle recent window plus a ${BASELINE_WINDOW}-candle baseline) to classify market phase.`
    );
    return { symbol, phase: "unknown", confidence: "low", evidence };
  }

  // dailyCandles is newest-first; every window below reasons chronologically.
  const chrono = [...completed].reverse();
  const recentSlice = chrono.slice(-RECENT_WINDOW);
  const baselineSlice = chrono.slice(-(RECENT_WINDOW + BASELINE_WINDOW), -RECENT_WINDOW);
  const last = chrono[chrono.length - 1];

  const recentMedianRange = median(recentSlice.map(candleRange));
  const baselineMedianRange = median(baselineSlice.map(candleRange));
  const contractionRatio = baselineMedianRange > 0 ? recentMedianRange / baselineMedianRange : 1;
  const lastRangeRatio = baselineMedianRange > 0 ? candleRange(last) / baselineMedianRange : 1;

  // ── 1. Expansion — checked first: the most decisive, single-candle-
  // confirmable structural signal, and by construction incompatible with
  // a corrective pullback read (a directional close beyond the recent
  // structure is continuation, not correction). ──
  const priorStructure = recentSlice.slice(0, -1);
  const priorStructureHigh = priorStructure.length ? Math.max(...priorStructure.map((c) => c.high)) : last.high;
  const priorStructureLow = priorStructure.length ? Math.min(...priorStructure.map((c) => c.low)) : last.low;
  const rangeExpanded = lastRangeRatio >= EXPANSION_RANGE_RATIO_THRESHOLD;
  const closedAbove = last.close > priorStructureHigh;
  const closedBelow = last.close < priorStructureLow;
  const directionalClose = closedAbove || closedBelow;

  evidence.push(
    `Latest completed candle range is ${(lastRangeRatio * 100).toFixed(0)}% of the prior ${BASELINE_WINDOW}-candle median range (expansion threshold ${(EXPANSION_RANGE_RATIO_THRESHOLD * 100).toFixed(0)}%).`
  );

  if (rangeExpanded && directionalClose) {
    evidence.push(
      `Latest completed close ${last.close} closed ${closedAbove ? "above" : "below"} the prior ${RECENT_WINDOW - 1}-candle structural ${closedAbove ? "high" : "low"} (${closedAbove ? priorStructureHigh : priorStructureLow}) — directional expansion confirmed.`
    );
    const strongRange = lastRangeRatio >= STRONG_EXPANSION_RANGE_RATIO_THRESHOLD;
    const ampleData = completed.length >= AMPLE_DATA_CANDLES;
    const score = (strongRange ? 1 : 0) + (ampleData ? 1 : 0);
    const confidence: MarketPhaseConfidence = score >= 2 ? "high" : score === 1 ? "medium" : "low";
    evidence.push(`Confidence set to "${confidence}" from ${score} confirming condition(s) (strong range: ${strongRange}, ample history: ${ampleData}).`);
    return { symbol, phase: "expansion", confidence, evidence };
  }
  if (rangeExpanded && !directionalClose) {
    evidence.push(
      "Latest completed candle's range expanded but its close did not clear the recent structural boundary in either direction — a large wick alone is not enough for expansion."
    );
  }

  // ── 2. Pullback — only eligible when the caller supplied a trend regime. ──
  if (regime && (regime.regime === "bullish_trend" || regime.regime === "bearish_trend")) {
    const pullback = evaluatePullback(chrono, regime);
    if (pullback) {
      evidence.push(...pullback.evidence);
      return { symbol, phase: "pullback", confidence: pullback.confidence, evidence };
    }
  }

  // ── 3. Compression. ──
  const recentOverlap = overlapRatio(recentSlice);
  const recentHigh = Math.max(...recentSlice.map((c) => c.high));
  const recentLow = Math.min(...recentSlice.map((c) => c.low));
  const baselineHigh = Math.max(...baselineSlice.map((c) => c.high));
  const baselineLow = Math.min(...baselineSlice.map((c) => c.low));
  const containedInBaseline = recentHigh <= baselineHigh && recentLow >= baselineLow;
  const contractionConfirmed = contractionRatio <= CONTRACTION_RATIO_THRESHOLD;
  const overlapConfirmed = recentOverlap.ratio >= OVERLAP_RATIO_THRESHOLD;

  evidence.push(
    `Recent ${RECENT_WINDOW}-candle median range is ${(contractionRatio * 100).toFixed(0)}% of the prior ${BASELINE_WINDOW}-candle median range (contraction threshold ${(CONTRACTION_RATIO_THRESHOLD * 100).toFixed(0)}%).`
  );
  evidence.push(
    `${recentOverlap.overlapCount}/${recentOverlap.pairs} consecutive candle range(s) in the recent window overlap (ratio ${(recentOverlap.ratio * 100).toFixed(0)}%, threshold ${(OVERLAP_RATIO_THRESHOLD * 100).toFixed(0)}%).`
  );
  evidence.push(
    containedInBaseline
      ? "Recent price action remains inside the prior baseline's high/low envelope."
      : "Recent price action has moved outside the prior baseline's high/low envelope."
  );

  const compressionConditions = [contractionConfirmed, overlapConfirmed, containedInBaseline].filter(Boolean).length;
  const strongContraction = contractionRatio <= STRONG_CONTRACTION_RATIO_THRESHOLD;
  // Requires a majority (>=2 of 3) of independent, multi-candle conditions
  // — never inferred from a single small candle. "High" additionally
  // requires strong contraction, not just a bare pass of the threshold.
  if (compressionConditions >= 2) {
    const confidence: MarketPhaseConfidence = compressionConditions === 3 && strongContraction ? "high" : "medium";
    evidence.push(`Confidence set to "${confidence}" from ${compressionConditions}/3 confirming compression condition(s).`);
    return { symbol, phase: "compression", confidence, evidence };
  }

  // ── 4. Rotation. ──
  const rotationSlice = chrono.slice(-ROTATION_WINDOW);
  const rotationPrior = rotationSlice.slice(0, -1);
  const rotationPriorHigh = rotationPrior.length ? Math.max(...rotationPrior.map((c) => c.high)) : last.high;
  const rotationPriorLow = rotationPrior.length ? Math.min(...rotationPrior.map((c) => c.low)) : last.low;
  const staysContained = last.high <= rotationPriorHigh && last.low >= rotationPriorLow;

  let alternations = 0;
  let lastSign = 0;
  for (let i = 1; i < rotationSlice.length; i++) {
    const delta = rotationSlice[i].close - rotationSlice[i - 1].close;
    const sign = delta > 0 ? 1 : delta < 0 ? -1 : 0;
    if (sign !== 0) {
      if (lastSign !== 0 && sign !== lastSign) alternations++;
      lastSign = sign;
    }
  }
  const alternationsConfirmed = alternations >= ROTATION_MIN_ALTERNATIONS;
  // Distinguishes rotation from compression: rotation is two-sided
  // movement inside stable boundaries, NOT a narrowing range.
  const notCompressing = !contractionConfirmed;

  evidence.push(
    `${alternations} directional alternation(s) across the last ${ROTATION_WINDOW} completed candle closes (rotation threshold ${ROTATION_MIN_ALTERNATIONS}).`
  );
  evidence.push(
    staysContained ? "Latest completed candle stayed within the recent rotation boundaries." : "Latest completed candle moved outside the recent rotation boundaries."
  );

  if (alternationsConfirmed && staysContained && notCompressing) {
    evidence.push(
      `Range is not contracting relative to baseline (ratio ${(contractionRatio * 100).toFixed(0)}%, compression threshold ${(CONTRACTION_RATIO_THRESHOLD * 100).toFixed(0)}%) — distinguishes rotation from compression.`
    );
    const strongAlternation = alternations >= ROTATION_STRONG_ALTERNATIONS;
    const ampleData = completed.length >= AMPLE_DATA_CANDLES;
    const score = (strongAlternation ? 1 : 0) + (ampleData ? 1 : 0);
    const confidence: MarketPhaseConfidence = score >= 2 ? "high" : score === 1 ? "medium" : "low";
    evidence.push(
      `Confidence set to "${confidence}" from ${score} confirming condition(s) (strong alternation: ${strongAlternation}, ample history: ${ampleData}).`
    );
    return { symbol, phase: "rotation", confidence, evidence };
  }

  // ── 5. No rule satisfied with enough evidence. ──
  evidence.push("No phase rule (expansion, pullback, compression, rotation) was satisfied with sufficient evidence.");
  return { symbol, phase: "unknown", confidence: "low", evidence };
}
