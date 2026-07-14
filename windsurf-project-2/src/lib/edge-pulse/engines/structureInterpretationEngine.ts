import type { TimeframeStructureRow, StructureResult } from "./structureEngine";

// ============================================================
// Edge Pulse — Structure Interpretation Engine (Sprint 2 / Phase 3)
// ============================================================
// Pure composition layer over the ALREADY-COMPUTED, unmodified outputs of
// structureEngine.ts (sequence trend + counts, compression/expansion/
// rotation, correction, lastBOS/lastCHoCH, reversal, higherTimeframeAlignment).
// This file adds no new swing/BOS/CHoCH/reversal math and reads no raw
// candles — it only interprets fields that already exist. No AI, no LLM,
// no prediction — every classification below is a deterministic function
// of already-computed booleans/enums.
//
// Goal (per the sprint brief): a raw "mixed" sequence read is not, on its
// own, useful to a trader. This layer resolves it into one of a small set
// of named conditions, and separately composes all 4 timeframes into one
// overall interpretation — WITHOUT ever inferring a mature trend where
// the underlying engines didn't confirm one (a "mixed" row can lean, but
// it never gets promoted to "Bullish"/"Bearish").

// ── Part 1: per-row secondary classification ──────────────────────────────

export type StructureCondition =
  | "mixed_bullish_pressure"
  | "mixed_bearish_pressure"
  | "balanced_range"
  | "compression_before_break"
  | "bullish_reversal_attempt"
  | "bearish_reversal_attempt"
  | "corrective_bullish_move"
  | "corrective_bearish_move"
  | "conflicting_timeframes"
  | "unresolved";

// Decision order (highest priority first) — documented, not arbitrary:
//   1. conflicting_timeframes — a RELATIONAL fact (vs. the next-higher
//      timeframe) a trader typically wants flagged before any same-
//      timeframe nuance, since it changes how much to trust this row at all.
//   2. bullish/bearish_reversal_attempt — a CHoCH fired but hasn't yet
//      earned a second confirming swing (reversal === false). Once
//      reversal === true, sequenceTrend has already flipped cleanly and
//      falls through to "no secondary label needed" below — a genuinely
//      confirmed reversal reads as a normal Bullish/Bearish row, not a
//      lingering "attempt."
//   3. corrective_bullish/bearish_move — a flagged Correction (deeper than
//      Pullback's 20% band, no CHoCH yet) inside an established sequence
//      trend.
//   4. compression_before_break — coiling; direction genuinely unknown
//      until it resolves, independent of whatever the swing sequence
//      currently leans.
//   5. Clean bullish/bearish sequence, or a classic equal/equal range ->
//      no secondary condition needed (null) / "balanced_range".
//   6. mixed -> resolved into a bullish-leaning / bearish-leaning /
//      genuinely balanced read using the raw direction counts.
//   7. unknown (too few swings) -> "unresolved".
export function classifyStructureCondition(row: TimeframeStructureRow): StructureCondition | null {
  if (row.quality === "unavailable") return null;

  if (row.higherTimeframeAlignment === "conflicting") return "conflicting_timeframes";

  // A "reversal attempt" is only current if the CHoCH is genuinely the
  // MOST RECENT structural event on this row — a later BOS (necessarily
  // in the opposite direction, since a BOS only fires when it agrees with
  // the trend established at that time) means the market already
  // reasserted the prior structure and resolved the attempt, and this
  // should no longer be read as an open "attempt." Caught via live
  // XAUUSD validation: a stale bullish CHoCH from months earlier was
  // otherwise still reported as an active attempt despite a materially
  // more recent bearish BOS. lastBOS/lastCHoCH are read as-is from
  // structuralEventEngine.ts (unmodified) — only this recency comparison
  // is new.
  if (row.lastCHoCH && !row.reversal) {
    const chochIsMostRecent = !row.lastBOS || row.lastCHoCH.confirmedAt > row.lastBOS.confirmedAt;
    if (chochIsMostRecent) {
      return row.lastCHoCH.direction === "bullish" ? "bullish_reversal_attempt" : "bearish_reversal_attempt";
    }
  }

  if (row.correction) {
    return row.sequenceTrend === "bearish" ? "corrective_bearish_move" : "corrective_bullish_move";
  }

  if (row.compression) return "compression_before_break";

  if (row.sequenceTrend === "bullish" || row.sequenceTrend === "bearish") return null; // existing bias label already captures this cleanly
  if (row.sequenceTrend === "range") return "balanced_range";

  if (row.sequenceTrend === "mixed") {
    const highsLean = row.sequenceHighs.higher - row.sequenceHighs.lower;
    const lowsLean = row.sequenceLows.higher - row.sequenceLows.lower;
    const combined = highsLean + lowsLean;
    if (combined > 0) return "mixed_bullish_pressure";
    if (combined < 0) return "mixed_bearish_pressure";
    return "unresolved"; // genuinely no lean either way
  }

  return "unresolved"; // sequenceTrend === "unknown" — too few confirmed swings
}

const CONDITION_LABEL: Record<StructureCondition, string> = {
  mixed_bullish_pressure: "mixed structure with a bullish lean",
  mixed_bearish_pressure: "mixed structure with a bearish lean",
  balanced_range: "a balanced range",
  compression_before_break: "compressing, direction not yet resolved",
  bullish_reversal_attempt: "an unconfirmed bullish reversal attempt",
  bearish_reversal_attempt: "an unconfirmed bearish reversal attempt",
  corrective_bullish_move: "a corrective move within a bullish sequence",
  corrective_bearish_move: "a corrective move within a bearish sequence",
  conflicting_timeframes: "conflicting with the higher timeframe",
  unresolved: "not enough confirmed structure to classify",
};

// One-line, template-built description — never fabricated prose, always a
// direct readout of the row's own bias/condition.
export function describeStructureCondition(row: TimeframeStructureRow): string {
  if (row.quality === "unavailable") return `${row.label} is currently unavailable.`;
  const condition = classifyStructureCondition(row);
  if (condition === null) return `${row.label}: ${row.bias}.`;
  return `${row.label}: ${CONDITION_LABEL[condition]}.`;
}

// ── Part 2: overall multi-timeframe interpretation ────────────────────────

export type OverallStructureInterpretation = "strongly_bullish" | "slightly_bullish" | "neutral" | "slightly_bearish" | "strongly_bearish" | "unresolved";

export type StructureAlignment = "fully_aligned" | "mostly_aligned" | "mixed" | "conflicting" | "unknown";

export interface StructureInterpretationResult {
  symbol: string;
  overall: OverallStructureInterpretation;
  primaryCondition: string; // D1
  executionCondition: string; // H4
  lowerTimeframeCondition: string; // H1 (intraday) + M15 (confirmation), combined
  alignment: StructureAlignment;
  evidence: string[];
}

// Timeframe weighting: D1 is the primary read, H4 the execution
// structure, H1 intraday context, M15 only a confirmation signal — a
// descending hierarchy of decision weight, not an arbitrary choice. Only
// sequenceTrend (bullish=+1/bearish=-1/anything else=0) feeds the score;
// an unavailable or undetermined timeframe contributes exactly 0 — it
// never pulls the overall read in either direction, and never gets
// silently excluded from the weighting denominator either (fewer
// available timeframes honestly produces a LESS extreme overall verdict,
// never a fabricated one).
const TIMEFRAME_WEIGHT = { daily: 4, h4: 3, h1: 2, m15: 1 } as const;
const MAX_SCORE = TIMEFRAME_WEIGHT.daily + TIMEFRAME_WEIGHT.h4 + TIMEFRAME_WEIGHT.h1 + TIMEFRAME_WEIGHT.m15; // 10

const STRONG_THRESHOLD = 6; // >=60% of max weighted score
const SLIGHT_THRESHOLD = 2; // >=20% of max weighted score

function directionalScore(row: TimeframeStructureRow): number {
  if (row.sequenceTrend === "bullish") return 1;
  if (row.sequenceTrend === "bearish") return -1;
  return 0; // range/mixed/unknown -> neutral contribution, never guessed
}

function rowByTimeframe(rows: TimeframeStructureRow[], timeframe: keyof typeof TIMEFRAME_WEIGHT): TimeframeStructureRow | undefined {
  return rows.find((r) => r.timeframe === timeframe);
}

export function composeStructureInterpretation(structure: StructureResult): StructureInterpretationResult {
  const { rows } = structure;
  const evidence: string[] = [];

  const daily = rowByTimeframe(rows, "daily");
  const h4 = rowByTimeframe(rows, "h4");
  const h1 = rowByTimeframe(rows, "h1");
  const m15 = rowByTimeframe(rows, "m15");

  const availableRows = rows.filter((r) => r.quality !== "unavailable");
  if (availableRows.length === 0) {
    evidence.push("No timeframe has usable structure data — overall interpretation cannot be resolved.");
    return {
      symbol: structure.symbol,
      overall: "unresolved",
      primaryCondition: daily ? describeStructureCondition(daily) : "Daily unavailable.",
      executionCondition: h4 ? describeStructureCondition(h4) : "H4 unavailable.",
      lowerTimeframeCondition: "H1/M15 unavailable.",
      alignment: "unknown",
      evidence,
    };
  }

  let weightedScore = 0;
  for (const [tf, weight] of Object.entries(TIMEFRAME_WEIGHT) as [keyof typeof TIMEFRAME_WEIGHT, number][]) {
    const row = rowByTimeframe(rows, tf);
    if (!row || row.quality === "unavailable") continue;
    const score = directionalScore(row);
    weightedScore += score * weight;
    if (score !== 0) evidence.push(`${row.label} sequence trend is ${row.sequenceTrend} (weight ${weight}) -> contributes ${score * weight} to the weighted score.`);
  }
  evidence.push(`Weighted score ${weightedScore} of a possible +-${MAX_SCORE} (Daily=4, H4=3, H1=2, M15=1).`);

  let overall: OverallStructureInterpretation;
  if (weightedScore >= STRONG_THRESHOLD) overall = "strongly_bullish";
  else if (weightedScore >= SLIGHT_THRESHOLD) overall = "slightly_bullish";
  else if (weightedScore <= -STRONG_THRESHOLD) overall = "strongly_bearish";
  else if (weightedScore <= -SLIGHT_THRESHOLD) overall = "slightly_bearish";
  else overall = "neutral";

  // Alignment: how much the AVAILABLE timeframes' sequence trends agree.
  const bullishCount = availableRows.filter((r) => r.sequenceTrend === "bullish").length;
  const bearishCount = availableRows.filter((r) => r.sequenceTrend === "bearish").length;
  const anyConflicting = rows.some((r) => r.higherTimeframeAlignment === "conflicting");

  let alignment: StructureAlignment;
  if (anyConflicting) {
    alignment = "conflicting";
  } else if ((bullishCount === availableRows.length && bullishCount > 0) || (bearishCount === availableRows.length && bearishCount > 0)) {
    alignment = "fully_aligned";
  } else if (bullishCount >= Math.ceil(availableRows.length / 2) || bearishCount >= Math.ceil(availableRows.length / 2)) {
    alignment = "mostly_aligned";
  } else {
    alignment = "mixed";
  }
  evidence.push(`Alignment: ${bullishCount} bullish, ${bearishCount} bearish among ${availableRows.length} available timeframe(s) -> ${alignment}.`);

  return {
    symbol: structure.symbol,
    overall,
    primaryCondition: daily ? describeStructureCondition(daily) : "Daily unavailable.",
    executionCondition: h4 ? describeStructureCondition(h4) : "H4 unavailable.",
    lowerTimeframeCondition: `${h1 ? describeStructureCondition(h1) : "H1 unavailable."} ${m15 ? describeStructureCondition(m15) : "M15 unavailable."}`,
    alignment,
    evidence,
  };
}
