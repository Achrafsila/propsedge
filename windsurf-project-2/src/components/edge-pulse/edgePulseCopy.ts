import { MarketPulse } from "@/lib/market/marketPulse";
import { KeyLevels } from "@/lib/market/types";

// ============================================================
// Edge Pulse — deterministic copy templates (presentation only)
// ============================================================
// Fixed-template text generation only — every phrase slotted in is read
// directly from an already-computed MarketPulse field (Regime, Phase,
// Bias, Conviction, Volatility, Environment, key levels, current price).
// No AI, no LLM, no new analysis, no predictions. Never mentions entries,
// stop losses, or take profits — Edge Pulse explains current market
// condition only, never trading instructions. This file does not touch
// src/lib/market/* — it is UI copy composed from data that file already
// produced.

const REGIME_PHRASE: Record<string, string> = {
  bullish_trend: "a bullish trend",
  bearish_trend: "a bearish trend",
  range: "a defined range",
  transition: "a structural transition",
  unknown: "an undetermined structure",
};

const PHASE_PHRASE: Record<string, string> = {
  expansion: "expanding",
  pullback: "pulling back within that structure",
  compression: "compressing",
  rotation: "rotating between its boundaries",
  unknown: "in an undetermined phase",
};

const BIAS_PHRASE: Record<string, string> = {
  bullish: "bullish",
  bearish: "bearish",
  neutral: "neutral",
  unknown: "undetermined",
};

const CONVICTION_PHRASE: Record<string, string> = {
  high: "strong",
  medium: "moderate",
  low: "weak",
  unknown: "unclear",
};

const VOLATILITY_PHRASE: Record<string, string> = {
  low: "below-average",
  normal: "typical",
  high: "elevated",
  extreme: "extreme",
  unknown: "undetermined",
};

const ENVIRONMENT_PHRASE: Record<string, string> = {
  favorable: "favorable for structured decision-making",
  selective: "tradable only with selectivity",
  poor: "currently unclear and not well-defined",
  unknown: "not yet determined",
};

// Section 3 — Market Interpretation. Exactly one deterministic
// explanation, built from Regime/Phase/Bias/Conviction/Volatility/
// Environment only — the same six fields MarketPulse.summary already
// condenses into one line, expanded here into three fixed-template
// sentences for a fuller (still non-predictive) explanation.
export function buildMarketInterpretation(pulse: MarketPulse): string {
  const regime = REGIME_PHRASE[pulse.regime.regime];
  const phase = PHASE_PHRASE[pulse.phase.phase];
  const bias = BIAS_PHRASE[pulse.bias];
  const conviction = CONVICTION_PHRASE[pulse.conviction.conviction];
  const volatility = VOLATILITY_PHRASE[pulse.volatility.volatility];
  const environment = ENVIRONMENT_PHRASE[pulse.environment.environment];

  const sentence1 = `${pulse.symbol} is currently in ${regime}, ${phase}.`;
  const sentence2 = `Structural bias reads ${bias}, with ${conviction} conviction behind it.`;
  const sentence3 = `Volatility is ${volatility}, and the overall environment is ${environment}.`;

  return `${sentence1} ${sentence2} ${sentence3}`;
}

// Section 5 — Conditions To Watch. Deterministic monitoring statements
// only: what would change the read, never what to do about it. Evaluated
// as a fixed, ordered set of rules; capped at 4 (same discipline
// MarketPulse.evidence already applies to its own array) so the section
// stays scannable rather than an exhaustive dump.
const MAX_CONDITIONS = 4;

export function buildConditionsToWatch(pulse: MarketPulse, currentPrice: number | null, keyLevels: KeyLevels | null): string[] {
  const conditions: string[] = [];
  const bullishLean = pulse.regime.regime === "bullish_trend" || pulse.bias === "bullish";
  const bearishLean = pulse.regime.regime === "bearish_trend" || pulse.bias === "bearish";

  if (currentPrice !== null && keyLevels?.dailyOpen != null) {
    if (bullishLean && currentPrice < keyLevels.dailyOpen) {
      conditions.push("Price reclaiming Daily Open would improve bullish alignment.");
    } else if (bearishLean && currentPrice > keyLevels.dailyOpen) {
      conditions.push("Price losing Daily Open would improve bearish alignment.");
    }
  }

  if (currentPrice !== null && keyLevels?.previousWeekLow != null && currentPrice > keyLevels.previousWeekLow && !bearishLean) {
    conditions.push("Acceptance below Previous Week Low would weaken structure.");
  }
  if (currentPrice !== null && keyLevels?.previousWeekHigh != null && currentPrice < keyLevels.previousWeekHigh && !bullishLean) {
    conditions.push("Acceptance above Previous Week High would weaken structure.");
  }

  if (pulse.phase.phase === "compression") {
    conditions.push("Compression remains unresolved. Wait for expansion confirmation.");
  }
  if (pulse.phase.phase === "rotation") {
    conditions.push("Price continues rotating within the current range — a decisive break of either boundary would be the next structural signal.");
  }
  if (pulse.volatility.volatility === "extreme") {
    conditions.push("Volatility is extreme — expect wider swings than the recent baseline.");
  }
  if (pulse.conviction.conviction === "low") {
    conditions.push("Conviction is low — current structural signals are not yet well-aligned.");
  }

  return conditions.slice(0, MAX_CONDITIONS);
}
