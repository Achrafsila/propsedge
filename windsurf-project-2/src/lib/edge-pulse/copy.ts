import type { MarketPulse } from "@/lib/market/marketPulse";
import type { StructureResult, TimeframeStructureRow } from "./engines/structureEngine";
import type { LiquidityResult } from "./engines/liquidityEngine";
import type { SupplyDemandResult } from "./engines/supplyDemandEngine";
import type { InstitutionalLevelsResult } from "./engines/institutionalLevelsEngine";
import type { CatalystResult } from "./engines/catalystEngine";
import type { StructureInterpretationResult, StructureAlignment, OverallStructureInterpretation } from "./engines/structureInterpretationEngine";
import { classifyStructureCondition, mostRecentStructuralEvent } from "./engines/structureInterpretationEngine";
import type { StructuralEvent, FailedBreak } from "./engines/structuralEventEngine";
import { TIMEFRAME_LABEL } from "./types";

// ============================================================
// Edge Pulse — deterministic copy templates (composition layer)
// ============================================================
// Fixed-template text generation only — every phrase is slotted in from an
// already-computed engine field, never invented. No AI, no LLM, no
// predictions, no entries/stop losses/take profits — Edge Pulse explains
// current market condition and structural conditions to monitor, never
// trading instructions.
//
// Vocabulary rule: never use the words "Conviction", "Environment",
// "Regime", "Confidence", "Engine", or "Model" in any generated sentence
// (they are internal field/engine names, not trader-facing language) —
// only the underlying enum VALUES (e.g. "bullish_trend") ever get read,
// and even those are translated to trader phrasing below, never printed
// as raw identifiers.

export type OverallBiasLabel = "Strongly Bullish" | "Bullish" | "Neutral" | "Bearish" | "Strongly Bearish" | "Transitional" | "Unclear";
export type QualityRating = "Excellent" | "Good" | "Moderate" | "Weak" | "Unavailable";

export function deriveOverallBias(pulse: MarketPulse): OverallBiasLabel {
  const { regime, conviction } = pulse;
  if (regime.regime === "unknown") return "Unclear";
  if (regime.regime === "range") return "Neutral";
  if (regime.regime === "transition") return "Transitional";
  const strong = conviction.conviction === "high";
  if (regime.regime === "bullish_trend") return strong ? "Strongly Bullish" : "Bullish";
  return strong ? "Strongly Bearish" : "Bearish";
}

const BULLISH_BIASES = new Set(["Bullish", "Bullish Pullback", "Bullish Shift"]);
const BEARISH_BIASES = new Set(["Bearish", "Bearish Pullback", "Bearish Shift"]);

function camp(bias: string): "bullish" | "bearish" | "neutral" {
  if (BULLISH_BIASES.has(bias)) return "bullish";
  if (BEARISH_BIASES.has(bias)) return "bearish";
  return "neutral";
}

function rowFor(structure: StructureResult, timeframe: string): TimeframeStructureRow | undefined {
  return structure.rows.find((r) => r.timeframe === timeframe);
}

// Section 1 — Market Outlook narrative. Exactly 2-3 fixed-template
// sentences built from the Daily row (the "broader trend" reference) and
// the H1 row (the nearer-term correction/alignment reference).
export function buildOutlookNarrative(structure: StructureResult): string[] {
  const daily = rowFor(structure, "daily");
  const h1 = rowFor(structure, "h1");
  const sentences: string[] = [];

  if (!daily || daily.quality === "unavailable") {
    return ["Daily structure could not be determined from the available history."];
  }

  // A confirmed trend (Bullish/Bearish, with or without a Pullback) reads
  // very differently from a Shift (a fresh, still-UNCONFIRMED change of
  // direction per marketRegime.ts's own "transition" rule) — collapsing
  // both into the same "remain in control" language would overstate
  // confidence in exactly the case the underlying engine is least sure
  // about. Only a confirmed trend gets "in control" / "not invalidated"
  // language; a Shift gets its own, more tentative phrasing.
  const dailyCamp = camp(daily.bias);
  const dailyIsShift = daily.bias === "Bullish Shift" || daily.bias === "Bearish Shift";
  const dailyIsConfirmedTrend = dailyCamp !== "neutral" && !dailyIsShift;

  if (dailyIsConfirmedTrend) sentences.push(dailyCamp === "bullish" ? "Daily buyers remain in control." : "Daily sellers remain in control.");
  else if (dailyIsShift) sentences.push(`Daily structure is shifting ${dailyCamp}, not yet confirmed.`);
  else if (daily.bias === "Ranging") sentences.push("Daily structure remains range-bound.");
  else sentences.push("Daily structure is not yet clearly established.");

  if (h1 && h1.quality !== "unavailable") {
    const h1Camp = camp(h1.bias);
    if (h1.bias.includes("Pullback")) sentences.push("H1 is currently correcting.");
    else if (h1Camp !== "neutral" && h1Camp !== dailyCamp) sentences.push("H1 is currently pushing against the broader trend.");
    else if (h1Camp === dailyCamp && h1Camp !== "neutral") sentences.push("H1 remains aligned with the broader trend.");
  }

  if (dailyIsConfirmedTrend) sentences.push("The broader trend has not been invalidated.");
  else if (daily.bias === "Ranging") sentences.push("No directional trend is currently established.");

  return sentences.slice(0, 3);
}

// Section 1 — Execution posture: one condition to wait for, never an
// instruction to trade. Only fires when the nearer-term (H1) read
// currently opposes the Daily trend.
export function buildExecutionPosture(structure: StructureResult): string | null {
  const daily = rowFor(structure, "daily");
  const h1 = rowFor(structure, "h1");
  if (!daily || !h1 || daily.quality === "unavailable" || h1.quality === "unavailable") return null;

  const dailyCamp = camp(daily.bias);
  const h1Camp = camp(h1.bias);
  if (dailyCamp === "neutral" || h1Camp === "neutral" || dailyCamp === h1Camp) return null;

  const side = dailyCamp === "bullish" ? "buyers" : "sellers";
  return `Wait for ${TIMEFRAME_LABEL.h1} ${side} to regain control.`;
}

// Sprint 2 / Phase 4 — the CALIBRATED Market Outlook narrative and session
// posture, built from structureInterpretationEngine.ts's already-composed
// StructureInterpretationResult rather than the legacy bias camps above.
// buildOutlookNarrative/buildExecutionPosture (above) are kept, unchanged,
// for payload backward compatibility — these are the versions the UI's
// primary headline now actually uses.

const ALIGNMENT_SENTENCE: Record<StructureAlignment, string> = {
  fully_aligned: "Every available timeframe currently agrees on this read.",
  mostly_aligned: "Most timeframes agree, with at least one holdout.",
  mixed: "Timeframes are not aligned right now — no dominant structure across the board.",
  conflicting: "Timeframes are actively conflicting — treat this read with caution.",
  unknown: "Not enough data is available to judge alignment across timeframes.",
};

// Exactly 3 sentences, every one a direct readout of an already-computed
// StructureInterpretationResult field — never invented prose, no LLM.
export function buildStructureNarrative(interpretation: StructureInterpretationResult): string[] {
  return [interpretation.primaryCondition, interpretation.executionCondition, ALIGNMENT_SENTENCE[interpretation.alignment]];
}

// Session posture: a condition to watch, never an instruction to trade.
// Priority order: an active cross-timeframe conflict outranks a same-
// timeframe nuance (matches classifyStructureCondition's own ordering
// rationale); an unconfirmed reversal attempt on the primary (Daily) read
// is the next most decision-relevant fact; otherwise no posture note is
// needed for an aligned, resolved structure.
export function buildSessionPosture(structure: StructureResult, interpretation: StructureInterpretationResult): string | null {
  if (interpretation.alignment === "conflicting") {
    return "Lower timeframes are conflicting with the higher-timeframe read — wait for alignment before treating this as resolved.";
  }

  const daily = rowFor(structure, "daily");
  if (daily) {
    const dailyCondition = classifyStructureCondition(daily);
    if (dailyCondition === "bullish_reversal_attempt") return "Watch for a second confirming swing before treating this as a bullish reversal.";
    if (dailyCondition === "bearish_reversal_attempt") return "Watch for a second confirming swing before treating this as a bearish reversal.";
  }

  const h1 = rowFor(structure, "h1");
  if (h1) {
    const h1Condition = classifyStructureCondition(h1);
    if (h1Condition === "compression_before_break" || h1Condition === "two_sided_rotation") {
      return `${TIMEFRAME_LABEL.h1} is not yet showing a directional resolution — wait for a confirmed break.`;
    }
  }

  if (interpretation.overall === "unresolved") return "Not enough confirmed structure to define a session posture.";

  return null;
}

const MAX_MARKET_CONTEXT_BULLETS = 5;

// Sprint 2 / Phase 5 — one bullet per timeframe, built strictly from the
// CALIBRATED read (classifyStructureCondition / mostRecentStructuralEvent /
// row.reversal), never the legacy row.bias string. A clean sequence
// (condition === null) only earns a "structure remains intact" claim when
// a same-direction BOS actually confirms it — otherwise it stays silent
// rather than asserting a trend the calibrated layer hasn't confirmed.
function contextBulletForRow(row: TimeframeStructureRow): string | null {
  if (row.quality === "unavailable") return null;

  if (row.reversal) {
    const event = mostRecentStructuralEvent(row);
    const direction = row.sequenceTrend === "bullish" ? "bullish" : "bearish";
    return event
      ? `${row.label} reversal is confirmed following a ${direction} CHoCH at ${event.price}.`
      : `${row.label} reversal is confirmed.`;
  }

  const condition = classifyStructureCondition(row);
  if (condition === "bullish_reversal_attempt" || condition === "bearish_reversal_attempt") {
    const direction = condition === "bullish_reversal_attempt" ? "bullish" : "bearish";
    const event = mostRecentStructuralEvent(row);
    return event
      ? `${row.label} is showing an unconfirmed ${direction} reversal attempt after a CHoCH at ${event.price}.`
      : `${row.label} is showing an unconfirmed ${direction} reversal attempt.`;
  }
  if (condition === "corrective_bullish_move") return `${row.label} is correcting within an otherwise bullish sequence.`;
  if (condition === "corrective_bearish_move") return `${row.label} is correcting within an otherwise bearish sequence.`;
  if (condition === "compression_before_break") return `${row.label} is compressing, direction not yet resolved.`;
  if (condition === "two_sided_rotation") return `${row.label} is rotating two-sided inside stable boundaries.`;
  if (condition === "mixed_bullish_pressure") return `${row.label} structure is mixed with a bullish lean.`;
  if (condition === "mixed_bearish_pressure") return `${row.label} structure is mixed with a bearish lean.`;
  if (condition === "balanced_range") return `${row.label} remains in a balanced range.`;
  if (condition === "conflicting_timeframes") return `${row.label} is conflicting with the higher timeframe.`;

  if (condition === null) {
    const event = mostRecentStructuralEvent(row);
    if (event?.type === "BOS" && event.direction === row.sequenceTrend) {
      return `${row.label} ${row.sequenceTrend} structure remains intact, confirmed by a BOS at ${event.price}.`;
    }
  }
  return null; // "unresolved", or a clean sequence with no confirming BOS yet — no strong claim to make
}

// Section 7 — Market Context: deterministic institutional-language facts,
// each derived from one already-computed field. Evaluated in a fixed
// priority order, capped at 5 — never padded, never invented. Never uses
// legacy row.bias wording when the calibrated read is mixed/neutral.
export function buildMarketContext(
  structure: StructureResult,
  structureInterpretation: StructureInterpretationResult,
  liquidity: LiquidityResult,
  supplyDemandByTimeframe: SupplyDemandResult[]
): string[] {
  const bullets: string[] = [];

  for (const row of structure.rows) {
    const bullet = contextBulletForRow(row);
    if (bullet) bullets.push(bullet);
  }

  for (const sd of supplyDemandByTimeframe) {
    const label = TIMEFRAME_LABEL[sd.timeframe];
    if (sd.nearestDemand && sd.nearestDemand.distance === 0) {
      bullets.push(`Price is trading inside ${label} demand at ${sd.nearestDemand.low}–${sd.nearestDemand.high}.`);
    }
    if (sd.nearestSupply && sd.nearestSupply.distance === 0) {
      bullets.push(`Price is trading inside ${label} supply at ${sd.nearestSupply.low}–${sd.nearestSupply.high}.`);
    }
  }

  if (liquidity.liquidityRestingAbove) bullets.push(`Liquidity remains resting above at ${liquidity.liquidityRestingAbove.price}.`);
  if (liquidity.liquidityRestingBelow) bullets.push(`Liquidity remains resting below at ${liquidity.liquidityRestingBelow.price}.`);
  if (liquidity.nearestSweep) bullets.push(`The nearest liquidity sweep occurred at ${liquidity.nearestSweep.sweptPrice}.`);

  if (structureInterpretation.alignment === "conflicting") bullets.push("The current structure lacks confirmation across every supported timeframe.");

  return bullets.slice(0, MAX_MARKET_CONTEXT_BULLETS);
}

const MAX_PLAYBOOK_BULLETS = 4;

function sdFor(supplyDemandByTimeframe: SupplyDemandResult[], timeframe: string): SupplyDemandResult | undefined {
  return supplyDemandByTimeframe.find((s) => s.timeframe === timeframe);
}

function zoneRange(zone: { low: number; high: number }): string {
  return `${zone.low}–${zone.high}`;
}

// Section 8 — Session Playbook: conditions only, never entries/exits.
// Sprint 2 / Phase 5 — concrete zone ranges, cross-referenced against the
// CALIBRATED per-row condition (never the legacy bias camp), fixed
// priority order, capped at 4.
export function buildSessionPlaybook(structure: StructureResult, supplyDemandByTimeframe: SupplyDemandResult[]): string[] {
  const bullets: string[] = [];

  // Priority 1 — an open reversal attempt cross-referenced with its own
  // timeframe's supply/demand zone (e.g. "Loss of H1 Demand at X would
  // weaken the current recovery attempt.").
  for (const row of structure.rows) {
    if (row.quality === "unavailable") continue;
    const condition = classifyStructureCondition(row);
    const sd = sdFor(supplyDemandByTimeframe, row.timeframe);
    if (condition === "bullish_reversal_attempt" && sd?.nearestDemand && sd.nearestDemand.state !== "broken") {
      bullets.push(`Loss of ${row.label} Demand at ${zoneRange(sd.nearestDemand)} would weaken the current recovery attempt.`);
    } else if (condition === "bearish_reversal_attempt" && sd?.nearestSupply && sd.nearestSupply.state !== "broken") {
      bullets.push(`Reclaiming above ${row.label} Supply at ${zoneRange(sd.nearestSupply)} would weaken the current reversal warning.`);
    }
  }

  // Priority 2 — generic acceptance levels with concrete ranges.
  for (const sd of supplyDemandByTimeframe) {
    const label = TIMEFRAME_LABEL[sd.timeframe];
    if (sd.nearestSupply && sd.nearestSupply.state !== "broken" && sd.nearestSupply.distance < 0) {
      bullets.push(`Watch acceptance above ${label} Supply at ${zoneRange(sd.nearestSupply)}.`);
    }
    if (sd.nearestDemand && sd.nearestDemand.state !== "broken" && sd.nearestDemand.distance > 0) {
      bullets.push(`Watch acceptance below ${label} Demand at ${zoneRange(sd.nearestDemand)}.`);
    }
  }

  // Priority 3 — unresolved/compressing/rotating timeframes, referenced
  // against their own latest confirmed swing high.
  for (const row of structure.rows) {
    if (row.quality === "unavailable") continue;
    const condition = classifyStructureCondition(row);
    const swingHigh = row.latestHH ?? row.latestLH;
    if ((condition === "compression_before_break" || condition === "two_sided_rotation" || condition === "unresolved") && swingHigh !== null) {
      bullets.push(`${row.label} structure remains unresolved below its latest swing high at ${swingHigh}.`);
    }
  }

  return bullets.slice(0, MAX_PLAYBOOK_BULLETS);
}

// Section 9 — Market Quality ratings. `unknown`/unresolved inputs map to
// "Unavailable" — a low rating is itself a claim, never fabricated from
// missing data.
export interface MarketQuality {
  trendQuality: QualityRating;
  liquidityQuality: QualityRating;
  executionConditions: QualityRating;
  volatility: QualityRating;
  structureAlignment: QualityRating;
}

// Sprint 2 / Phase 5 — Trend Quality and Structure Alignment now derive
// from the CALIBRATED multi-timeframe interpretation, not the legacy
// single-timeframe MarketPulse regime/conviction or structure.disagreement
// — otherwise this section could contradict the hero headline directly
// above it.
const OVERALL_TREND_RATING: Record<OverallStructureInterpretation, QualityRating> = {
  strongly_bullish: "Excellent",
  strongly_bearish: "Excellent",
  slightly_bullish: "Good",
  slightly_bearish: "Good",
  neutral: "Moderate",
  unresolved: "Unavailable",
};

const ALIGNMENT_RATING: Record<StructureAlignment, QualityRating> = {
  fully_aligned: "Excellent",
  mostly_aligned: "Good",
  mixed: "Moderate",
  conflicting: "Weak",
  unknown: "Unavailable",
};

export function buildMarketQuality(pulse: MarketPulse, liquidity: LiquidityResult, structureInterpretation: StructureInterpretationResult): MarketQuality {
  const trendQuality = OVERALL_TREND_RATING[structureInterpretation.overall];

  let liquidityQuality: QualityRating;
  if (liquidity.quality === "unavailable") liquidityQuality = "Unavailable";
  else {
    const facts = [liquidity.buySideLiquidity, liquidity.sellSideLiquidity, liquidity.equalHighs, liquidity.equalLows, liquidity.nearestSweep].filter(
      (f) => f !== null
    ).length;
    liquidityQuality = facts >= 4 ? "Excellent" : facts >= 2 ? "Good" : facts >= 1 ? "Moderate" : "Weak";
  }

  let executionConditions: QualityRating;
  if (pulse.environment.environment === "unknown") executionConditions = "Unavailable";
  else if (pulse.environment.environment === "favorable") executionConditions = "Excellent";
  else if (pulse.environment.environment === "selective") executionConditions = "Good";
  else executionConditions = "Weak";

  const VOLATILITY_RATING: Record<string, QualityRating> = { normal: "Excellent", low: "Good", high: "Moderate", extreme: "Weak", unknown: "Unavailable" };
  const volatility = VOLATILITY_RATING[pulse.volatility.volatility] ?? "Unavailable";

  const structureAlignment = ALIGNMENT_RATING[structureInterpretation.alignment];

  return { trendQuality, liquidityQuality, executionConditions, volatility, structureAlignment };
}

const MAX_WARNINGS = 3;
const MAJOR_LEVEL_PROXIMITY_THRESHOLD_PERCENT = 0.5;
const MACRO_EVENT_WARNING_HOURS = 3;

// Section 10 — Institutional Warnings: fixed-priority rule bank, top 3
// that actually fire — never padded to 3.
export function buildWarnings(
  structure: StructureResult,
  structureInterpretation: StructureInterpretationResult,
  supplyDemandByTimeframe: SupplyDemandResult[],
  institutionalLevels: InstitutionalLevelsResult,
  catalyst: CatalystResult,
  now: Date
): string[] {
  const warnings: string[] = [];

  // 1. Trapped between an HTF supply and an LTF demand (or vice versa),
  // both close to price (state not broken, either side's zone distance
  // magnitude under the same proximity threshold used for level warnings).
  const h4 = supplyDemandByTimeframe.find((s) => s.timeframe === "h4");
  const h1 = supplyDemandByTimeframe.find((s) => s.timeframe === "h1");
  if (h4?.nearestSupply && h1?.nearestDemand && h4.nearestSupply.distance < 0 && h1.nearestDemand.distance > 0) {
    warnings.push(`Price is trapped between ${TIMEFRAME_LABEL.h4} Supply and ${TIMEFRAME_LABEL.h1} Demand.`);
  }

  // 2. Proximity to the nearest institutional level.
  const nearestLevel = institutionalLevels.levels[0];
  if (nearestLevel && Math.abs(nearestLevel.distancePercent) <= MAJOR_LEVEL_PROXIMITY_THRESHOLD_PERCENT) {
    warnings.push(`${nearestLevel.label} sits only ${Math.abs(nearestLevel.distancePercent)}% away.`);
  }

  // 3. A confirmed macro event within the next few hours.
  if (catalyst.todaysCatalyst) {
    const hoursUntil = (new Date(catalyst.todaysCatalyst.scheduledAt).getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursUntil >= 0 && hoursUntil <= MACRO_EVENT_WARNING_HOURS) {
      warnings.push(`Major macro event within ${Math.ceil(hoursUntil)} hour(s).`);
    }
  }

  // 4. An expansion phase unsupported by cross-timeframe agreement — the
  // CALIBRATED alignment read, not the legacy bias-camp disagreement flag.
  const expandingRow = structure.rows.find((r) => r.quality !== "unavailable" && r.expansion);
  if (expandingRow && (structureInterpretation.alignment === "conflicting" || structureInterpretation.alignment === "mixed")) {
    warnings.push(`${expandingRow.label} is expanding but higher-timeframe structure is not confirming it.`);
  }

  // 5. An open reversal attempt on a primary (Daily/H4) timeframe — not yet
  // earned a second confirming swing.
  for (const row of [rowFor(structure, "daily"), rowFor(structure, "h4")]) {
    if (!row || row.quality === "unavailable") continue;
    const condition = classifyStructureCondition(row);
    if (condition === "bullish_reversal_attempt" || condition === "bearish_reversal_attempt") {
      warnings.push(`${row.label} reversal remains unconfirmed — treat the current structure as provisional.`);
    }
  }

  return warnings.slice(0, MAX_WARNINGS);
}

// Section 11 — Technical Reasoning, CALIBRATED default view (Sprint 2 /
// Phase 5). One fact row per timeframe: sequence trend, phase, latest
// structural event (BOS/CHoCH/false break, whichever is most recent),
// reversal state, latest confirmed swing high/low — the same fields every
// other section's copy is built from. Legacy MarketPulse/regime/phase
// evidence is kept on the payload separately (composeEdgePulse.ts's
// `legacyDiagnostics`), never merged into this list.
export interface TechnicalReasoningTimeframeFacts {
  timeframe: TimeframeStructureRow["timeframe"];
  label: string;
  sequenceTrend: TimeframeStructureRow["sequenceTrend"];
  phase: string;
  latestEvent: string;
  reversal: boolean;
  latestSwingHigh: number | null;
  latestSwingLow: number | null;
}

function phaseLabelFor(row: TimeframeStructureRow): string {
  if (row.compression) return "Compression";
  if (row.expansion) return "Expansion";
  if (row.rotation) return "Rotation";
  if (row.correction) return "Correction";
  return "None";
}

function formatStructuralEvent(event: StructuralEvent): string {
  const kind = event.type === "BOS" ? "BOS" : "CHoCH";
  const direction = event.direction === "bullish" ? "Bullish" : "Bearish";
  return `${kind} ${direction} @ ${event.price}`;
}

function formatFailedBreak(failedBreak: FailedBreak): string {
  const direction = failedBreak.direction === "bullish" ? "Bullish" : "Bearish";
  return `False Break ${direction} @ ${failedBreak.price}`;
}

// The most recent of {lastBOS/lastCHoCH via mostRecentStructuralEvent} vs.
// lastFailedBreak, compared by timestamp — never fabricated, always a
// direct readout of already-computed structuralEventEngine.ts fields.
function latestEventLabelFor(row: TimeframeStructureRow): string {
  const event = mostRecentStructuralEvent(row);
  const failedBreak = row.lastFailedBreak;
  if (!event && !failedBreak) return "None";
  if (event && !failedBreak) return formatStructuralEvent(event);
  if (!event && failedBreak) return formatFailedBreak(failedBreak);
  const eventTime = new Date(event!.confirmedAt).getTime();
  const failedTime = new Date(failedBreak!.candleDatetime).getTime();
  return failedTime > eventTime ? formatFailedBreak(failedBreak!) : formatStructuralEvent(event!);
}

export function buildTechnicalReasoningFacts(structure: StructureResult): TechnicalReasoningTimeframeFacts[] {
  return structure.rows.map((row) => ({
    timeframe: row.timeframe,
    label: row.label,
    sequenceTrend: row.sequenceTrend,
    phase: row.quality === "unavailable" ? "Unavailable" : phaseLabelFor(row),
    latestEvent: row.quality === "unavailable" ? "Unavailable" : latestEventLabelFor(row),
    reversal: row.reversal,
    latestSwingHigh: row.latestHH ?? row.latestLH,
    latestSwingLow: row.latestHL ?? row.latestLL,
  }));
}
