import type { MarketPulse } from "@/lib/market/marketPulse";
import type { StructureResult, TimeframeStructureRow } from "./engines/structureEngine";
import type { LiquidityResult } from "./engines/liquidityEngine";
import type { SupplyDemandResult } from "./engines/supplyDemandEngine";
import type { InstitutionalLevelsResult } from "./engines/institutionalLevelsEngine";
import type { CatalystResult } from "./engines/catalystEngine";
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

const MAX_MARKET_CONTEXT_BULLETS = 5;

// Section 7 — Market Context: deterministic institutional-language facts,
// each derived from one already-computed field. Evaluated in a fixed
// priority order, capped at 5 — never padded, never invented.
export function buildMarketContext(structure: StructureResult, liquidity: LiquidityResult, supplyDemandByTimeframe: SupplyDemandResult[]): string[] {
  const bullets: string[] = [];

  for (const row of structure.rows) {
    if (row.quality === "unavailable") continue;
    if (row.bias === "Bullish" || row.bias === "Bullish Shift") bullets.push(`${row.label} buyers continue defending higher lows.`);
    else if (row.bias === "Bearish" || row.bias === "Bearish Shift") bullets.push(`${row.label} sellers continue defending lower highs.`);
    else if (row.bias === "Bullish Pullback") bullets.push(`${row.label} is correcting within an otherwise bullish structure.`);
    else if (row.bias === "Bearish Pullback") bullets.push(`${row.label} is correcting within an otherwise bearish structure.`);
  }

  for (const sd of supplyDemandByTimeframe) {
    if (sd.nearestDemand && sd.nearestDemand.distance === 0) bullets.push(`Price is trading inside ${TIMEFRAME_LABEL[sd.timeframe]} demand.`);
    if (sd.nearestSupply && sd.nearestSupply.distance === 0) bullets.push(`Price is trading inside ${TIMEFRAME_LABEL[sd.timeframe]} supply.`);
  }

  if (liquidity.liquidityRestingAbove) bullets.push(`Liquidity remains resting above at ${liquidity.liquidityRestingAbove.price}.`);
  if (liquidity.liquidityRestingBelow) bullets.push(`Liquidity remains resting below at ${liquidity.liquidityRestingBelow.price}.`);
  if (liquidity.nearestSweep) bullets.push(`The nearest liquidity sweep occurred at ${liquidity.nearestSweep.sweptPrice}.`);

  if (structure.disagreement) bullets.push("The current structure lacks confirmation across every supported timeframe.");

  return bullets.slice(0, MAX_MARKET_CONTEXT_BULLETS);
}

const MAX_PLAYBOOK_BULLETS = 4;

// Section 8 — Session Playbook: conditions only, never entries/exits.
export function buildSessionPlaybook(structure: StructureResult, supplyDemandByTimeframe: SupplyDemandResult[]): string[] {
  const bullets: string[] = [];
  const daily = rowFor(structure, "daily");
  const dailyCamp = daily ? camp(daily.bias) : "neutral";

  for (const sd of supplyDemandByTimeframe) {
    const label = TIMEFRAME_LABEL[sd.timeframe];
    if (sd.nearestSupply && sd.nearestSupply.state !== "broken" && sd.nearestSupply.distance < 0) {
      bullets.push(`Watch acceptance above ${label} Supply.`);
    }
    if (sd.nearestDemand && sd.nearestDemand.state !== "broken" && sd.nearestDemand.distance > 0) {
      bullets.push(`Watch acceptance below ${label} Demand.`);
    }
  }

  if (dailyCamp === "bullish") {
    const dailySd = supplyDemandByTimeframe.find((s) => s.timeframe === "daily");
    if (dailySd?.nearestDemand) bullets.push(`Loss of Daily Demand at ${dailySd.nearestDemand.low} would weaken the structure.`);
  } else if (dailyCamp === "bearish") {
    const dailySd = supplyDemandByTimeframe.find((s) => s.timeframe === "daily");
    if (dailySd?.nearestSupply) bullets.push(`Reclaiming above Daily Supply at ${dailySd.nearestSupply.high} would weaken the structure.`);
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

export function buildMarketQuality(pulse: MarketPulse, liquidity: LiquidityResult, structure: StructureResult): MarketQuality {
  let trendQuality: QualityRating;
  if (pulse.regime.regime === "unknown") trendQuality = "Unavailable";
  else if (pulse.regime.regime === "bullish_trend" || pulse.regime.regime === "bearish_trend") {
    trendQuality = pulse.conviction.conviction === "high" ? "Excellent" : pulse.conviction.conviction === "medium" ? "Good" : "Moderate";
  } else trendQuality = "Weak";

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

  const anyRowAvailable = structure.rows.some((r) => r.quality !== "unavailable");
  const structureAlignment: QualityRating = !anyRowAvailable ? "Unavailable" : structure.disagreement ? "Weak" : "Excellent";

  return { trendQuality, liquidityQuality, executionConditions, volatility, structureAlignment };
}

const MAX_WARNINGS = 3;
const MAJOR_LEVEL_PROXIMITY_THRESHOLD_PERCENT = 0.5;
const MACRO_EVENT_WARNING_HOURS = 3;

// Section 10 — Institutional Warnings: fixed-priority rule bank, top 3
// that actually fire — never padded to 3.
export function buildWarnings(
  structure: StructureResult,
  supplyDemandByTimeframe: SupplyDemandResult[],
  institutionalLevels: InstitutionalLevelsResult,
  catalyst: CatalystResult,
  pulse: MarketPulse,
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

  // 4. An expansion phase unsupported by cross-timeframe agreement.
  if (pulse.phase.phase === "expansion" && structure.disagreement) {
    warnings.push("The current expansion is unsupported by higher timeframe structure.");
  }

  return warnings.slice(0, MAX_WARNINGS);
}
