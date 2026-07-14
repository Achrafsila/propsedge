import type { SwingPoint, Direction } from "./swingDetection";
import { classifyDirection } from "./swingDetection";

// ============================================================
// PropEdge — Sequence Trend Evaluator (shared pure utility)
// ============================================================
// Sprint 2 / Phase 2, docs/edge-pulse-market-structure.md §3/§7's central
// finding: marketRegime.ts judges trend from only the LAST TWO confirmed
// swings per side (`slice(-2)`), so a genuinely choppy or reversing
// sequence can read identically to a clean trend. This file adds a
// reusable, ADDITIVE sequence read — it does not touch, remove, or
// silently alter marketRegime.ts's own 2-swing comparison (still used by
// computeMarketRegime, unchanged, matching every existing regime
// scenario). Callers that want a fuller read call this alongside it.
//
// Pure function only — no API calls, no React, no AI/LLM. Takes whatever
// confirmed SwingPoint arrays it's given (per-timeframe, already isolated
// by the caller) and reasons only over pairwise direction between
// consecutive swings within the analysed window.

export type SequenceTrend = "bullish" | "bearish" | "range" | "mixed" | "unknown";
export type SequenceConsistency = "strong" | "moderate" | "weak";

export interface DirectionCounts {
  higher: number;
  lower: number;
  equal: number;
}

export interface SwingSequenceAssessment {
  trend: SequenceTrend;
  highs: DirectionCounts;
  lows: DirectionCounts;
  consistency: SequenceConsistency;
  evidence: string[];
}

// "Analyse at least the latest 3 to 5 confirmed swing highs and lows" —
// default window is the upper end (5); MIN_SWINGS_FOR_SEQUENCE is the
// floor (3, i.e. at least 2 pairwise comparisons) below which the read
// refuses to classify rather than guess, same discipline as every other
// engine's own MIN_COMPLETED_CANDLES-style floor.
const DEFAULT_SEQUENCE_WINDOW = 5;
const MIN_SWINGS_FOR_SEQUENCE = 3;

// Majority = strictly more than half of the comparisons in the window —
// a bare tie (e.g. 2-of-4) is deliberately NOT a majority; it reads as
// "mixed," never rounded up to a false consensus.
function majorityDirection(counts: DirectionCounts, total: number): Direction | null {
  if (total === 0) return null;
  if (counts.higher > total / 2) return "higher";
  if (counts.lower > total / 2) return "lower";
  if (counts.equal > total / 2) return "equal";
  return null;
}

function pairwiseDirections(swings: SwingPoint[]): Direction[] {
  const directions: Direction[] = [];
  for (let i = 1; i < swings.length; i++) {
    directions.push(classifyDirection(swings[i - 1].price, swings[i].price));
  }
  return directions;
}

function countDirections(directions: Direction[]): DirectionCounts {
  return {
    higher: directions.filter((d) => d === "higher").length,
    lower: directions.filter((d) => d === "lower").length,
    equal: directions.filter((d) => d === "equal").length,
  };
}

const EMPTY_COUNTS: DirectionCounts = { higher: 0, lower: 0, equal: 0 };

// Analyses the last `window` confirmed swing highs and the last `window`
// confirmed swing lows independently, then combines them:
//   both sides majority "higher"                -> bullish
//   both sides majority "lower"                 -> bearish
//   both sides majority "equal"                 -> range (classic boundary-
//                                                   oscillation reading only)
//   anything else (including the "lower high /
//   higher low narrowing" pattern marketRegime.ts
//   calls "range")                              -> mixed
// The narrowing case is deliberately NOT folded into "range" here (unlike
// marketRegime.ts's historical convention) — narrowing highs/lows is a
// compression-like signal, not a classic oscillating range, and
// docs/edge-pulse-market-structure.md §10 already flags conflating the two
// as a known limitation of the current label. This evaluator keeps them
// distinct; "mixed" is the honest bucket for "highs and lows disagree,"
// whatever shape that disagreement takes.
export function evaluateSwingSequence(swingHighs: SwingPoint[], swingLows: SwingPoint[], window: number = DEFAULT_SEQUENCE_WINDOW): SwingSequenceAssessment {
  const recentHighs = swingHighs.slice(-window);
  const recentLows = swingLows.slice(-window);
  const evidence: string[] = [];

  if (recentHighs.length < MIN_SWINGS_FOR_SEQUENCE || recentLows.length < MIN_SWINGS_FOR_SEQUENCE) {
    evidence.push(
      `Only ${recentHighs.length} confirmed swing high(s) and ${recentLows.length} confirmed swing low(s) available; at least ${MIN_SWINGS_FOR_SEQUENCE} of each are required for a sequence read.`
    );
    return { trend: "unknown", highs: EMPTY_COUNTS, lows: EMPTY_COUNTS, consistency: "weak", evidence };
  }

  const highDirs = pairwiseDirections(recentHighs);
  const lowDirs = pairwiseDirections(recentLows);
  const highs = countDirections(highDirs);
  const lows = countDirections(lowDirs);

  evidence.push(
    `Last ${recentHighs.length} confirmed swing highs: ${recentHighs.map((s) => s.price).join(" -> ")} (${highs.higher} higher, ${highs.lower} lower, ${highs.equal} equal across ${highDirs.length} comparison(s)).`
  );
  evidence.push(
    `Last ${recentLows.length} confirmed swing lows: ${recentLows.map((s) => s.price).join(" -> ")} (${lows.higher} higher, ${lows.lower} lower, ${lows.equal} equal across ${lowDirs.length} comparison(s)).`
  );

  const highMajority = majorityDirection(highs, highDirs.length);
  const lowMajority = majorityDirection(lows, lowDirs.length);

  let trend: SequenceTrend;
  if (highMajority === "higher" && lowMajority === "higher") {
    trend = "bullish";
    evidence.push("Majority of recent swing highs AND lows are ascending -> bullish sequence.");
  } else if (highMajority === "lower" && lowMajority === "lower") {
    trend = "bearish";
    evidence.push("Majority of recent swing highs AND lows are descending -> bearish sequence.");
  } else if (highMajority === "equal" && lowMajority === "equal") {
    trend = "range";
    evidence.push("Majority of recent swing highs AND lows are equal -> range sequence.");
  } else {
    trend = "mixed";
    evidence.push(
      `Swing highs and lows do not agree on one clear direction (highs majority: ${highMajority ?? "none"}, lows majority: ${lowMajority ?? "none"}) -> mixed sequence.`
    );
  }

  // Consistency: what fraction of ALL comparisons across both sides agree
  // with the classified trend's expected direction. "mixed"/"unknown" are
  // always weak by construction — there is no single direction to be
  // consistent about.
  let consistency: SequenceConsistency;
  if (trend === "mixed") {
    consistency = "weak";
  } else {
    const agreeing = trend === "bullish" ? highs.higher + lows.higher : trend === "bearish" ? highs.lower + lows.lower : highs.equal + lows.equal;
    const total = highDirs.length + lowDirs.length;
    const ratio = total > 0 ? agreeing / total : 0;
    consistency = ratio >= 1 ? "strong" : ratio >= 0.66 ? "moderate" : "weak";
    evidence.push(`Consistency: ${(ratio * 100).toFixed(0)}% of comparisons agree with the ${trend} read (strong=100%, moderate>=66%, else weak).`);
  }

  return { trend, highs, lows, consistency, evidence };
}
