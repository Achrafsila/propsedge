import type { InstrumentMarketHistory, MarketContext, StructuralBias, KeyLevelDistance, HistoryQuality } from "./types";
import { computeMarketRegime, MarketRegime, MarketRegimeResult } from "./engines/marketRegime";
import { computeMarketPhase, MarketPhase, MarketPhaseResult } from "./engines/marketPhase";
import { computeMarketVolatility, MarketVolatilityResult } from "./engines/marketVolatility";
import { computeMarketConviction, MarketConvictionResult } from "./engines/marketConviction";
import { computeMarketEnvironment, MarketEnvironmentResult } from "./engines/marketEnvironment";

// ============================================================
// PropEdge — Market Pulse (deterministic orchestration layer)
// ============================================================
// Pure function: InstrumentMarketHistory + MarketContext ->
// MarketPulse. This file computes nothing itself — it calls the five
// existing engines in their correct dependency order and composes their
// outputs, evidence, and data-quality states into one object per
// instrument. No API calls, no React, no Supabase, no localStorage, no
// AI/LLM, no trade signals, no entries/targets, no directional
// recommendations. Called by marketIntelligence.ts's orchestrator (which
// attaches the result to InstrumentMarketData.marketPulse, served by
// /api/market-intelligence) — not yet rendered by any UI (EdgePilot
// integration is a separate, later step).
//
// Dependency order (why it's fixed):
//   1. computeMarketRegime(history)                        — no dependencies
//   2. computeMarketVolatility(history)                     — no dependencies
//   3. computeMarketPhase(history, regime)                  — needs regime (pullback check)
//   4. computeMarketConviction(regime, phase, volatility, context)   — needs 1-3 + context
//   5. computeMarketEnvironment(regime, phase, volatility, conviction, context) — needs 1-4 + context
// Regime and Volatility are independent of everything and of each other;
// every engine after them only ever consumes outputs that already exist.
//
// Every engine is called unconditionally, even when Regime comes back
// "unknown" — each downstream engine already has its own honest handling
// of an unresolved regime (Phase can still classify off compression/
// expansion/rotation without it; Conviction and Environment already
// hard-gate to "unknown" internally). Pulse never second-guesses or
// short-circuits an engine's own rules — that would be exactly the kind
// of duplicated logic this layer must avoid.

export type MarketPulseEvidenceSource = "regime" | "phase" | "volatility" | "conviction" | "environment" | "market_context" | "pulse";

export interface MarketPulseEvidence {
  source: MarketPulseEvidenceSource;
  message: string;
}

// Trader-facing contract: MarketPulse.evidence is capped, never a raw dump
// of every upstream engine's evidence array. The five analytical engines
// keep ALL of their own evidence untouched (pulse.regime.evidence,
// pulse.phase.evidence, etc. are unchanged) — only the top-level composed
// MarketPulse.evidence array is deduplicated and capped.
const MAX_EVIDENCE_ITEMS = 8;

// Exact-duplicate removal, first occurrence wins. Two engines occasionally
// state the same fact in the same words (e.g. both citing an identical
// volatility reading); a trader-facing summary should show that once, not
// twice. This never touches wording — a message survives byte-for-byte or
// is dropped entirely, never edited.
export function dedupeEvidence(items: MarketPulseEvidence[]): MarketPulseEvidence[] {
  const seen = new Set<string>();
  const out: MarketPulseEvidence[] = [];
  for (const item of items) {
    if (seen.has(item.message)) continue;
    seen.add(item.message);
    out.push(item);
  }
  return out;
}

export interface MarketPulse {
  symbol: string;
  generatedAt: string; // ISO 8601 (UTC) — the one field that is not a pure function of the inputs, same convention as MarketIntelligence.fetchedAt

  status: "available" | "partial" | "unavailable";

  regime: MarketRegimeResult;
  phase: MarketPhaseResult;
  bias: StructuralBias;
  conviction: MarketConvictionResult;
  volatility: MarketVolatilityResult;
  environment: MarketEnvironmentResult;

  // Reuses KeyLevelDistance verbatim (same 4 fields the brief's inline
  // type describes) rather than redeclaring an identical shape.
  nearestLevel: KeyLevelDistance | null;

  summary: string;
  evidence: MarketPulseEvidence[];

  dataQuality: {
    dailyHistory: HistoryQuality;
    weeklyHistory: HistoryQuality;
    marketContext: "available" | "unavailable";
  };
}

const REGIME_LABEL: Record<MarketRegime, string> = {
  bullish_trend: "a bullish trend",
  bearish_trend: "a bearish trend",
  range: "a range",
  transition: "a transition",
  unknown: "an undetermined structure",
};

const PHASE_LABEL: Record<MarketPhase, string> = {
  compression: "compressing",
  expansion: "expanding",
  pullback: "pulling back",
  rotation: "rotating",
  unknown: "in an undetermined phase",
};

// One deterministic, template-built sentence — every value slotted in is
// copied verbatim from an already-computed engine enum, never rephrased
// or inferred. This is intentionally much smaller than the Narrative
// Engine designed earlier in this project: Pulse needs one composed
// summary line, not a six-section trader briefing.
function buildSummary(
  symbol: string,
  regime: MarketRegimeResult,
  phase: MarketPhaseResult,
  bias: StructuralBias,
  conviction: MarketConvictionResult,
  volatility: MarketVolatilityResult,
  environment: MarketEnvironmentResult
): string {
  if (regime.regime === "unknown") {
    return `${symbol}: market structure could not be determined from the available history.`;
  }
  return `${symbol} is in ${REGIME_LABEL[regime.regime]}, currently ${PHASE_LABEL[phase.phase]}. Structural bias is ${bias}, volatility is ${volatility.volatility}. Environment is ${environment.environment} with ${conviction.conviction} conviction.`;
}

export function computeMarketPulse(history: InstrumentMarketHistory, marketContext: MarketContext | null): MarketPulse {
  const symbol = history?.symbol ?? "unknown";

  const regime = computeMarketRegime(history);
  const volatility = computeMarketVolatility(history);
  const phase = computeMarketPhase(history, regime);
  const conviction = computeMarketConviction(regime, phase, volatility, marketContext);
  const environment = computeMarketEnvironment(regime, phase, volatility, conviction, marketContext);

  const bias: StructuralBias = marketContext?.bias ?? "unknown";
  const nearestLevel: KeyLevelDistance | null = marketContext?.nearestLevel ?? null;

  // Honest data-quality rollup. Regime failing is no longer an automatic
  // full "unavailable" — it is named as one degradation among several,
  // exactly like any other engine coming back "unknown". "unavailable" is
  // reserved for the case where there is genuinely nothing to report:
  // no usable history, no Market Context, AND every analytical output is
  // unknown.
  const degradations: string[] = [];
  if (regime.regime === "unknown") degradations.push("regime could not be determined");
  if (history.dataQuality.dailyHistory !== "complete") degradations.push(`daily history is ${history.dataQuality.dailyHistory}`);
  if (history.dataQuality.weeklyHistory !== "complete") degradations.push(`weekly history is ${history.dataQuality.weeklyHistory}`);
  if (!marketContext) degradations.push("market context is unavailable");
  if (phase.phase === "unknown") degradations.push("phase could not be determined");
  if (volatility.volatility === "unknown") degradations.push("volatility could not be determined");
  if (conviction.conviction === "unknown") degradations.push("conviction could not be determined");
  if (environment.environment === "unknown") degradations.push("environment could not be determined");

  const hasUsableHistory = history.dataQuality.dailyHistory !== "unavailable";
  const hasContext = marketContext !== null;
  const anyAnalyticalOutputResolved =
    regime.regime !== "unknown" ||
    phase.phase !== "unknown" ||
    volatility.volatility !== "unknown" ||
    conviction.conviction !== "unknown" ||
    environment.environment !== "unknown";

  let status: MarketPulse["status"];
  if (!hasUsableHistory && !hasContext && !anyAnalyticalOutputResolved) {
    status = "unavailable";
  } else if (degradations.length === 0) {
    status = "available";
  } else {
    status = "partial";
  }

  // Deterministic source order for the trader-facing array: Market
  // Context's own facts lead (they're the most concrete, human-readable
  // facts — an insight sentence and a level reading), then the five
  // engines in their dependency order, then Pulse's own data-quality note
  // last. Market Context's facts are surfaced verbatim — never
  // recomputed, just tagged and carried through.
  const rawEvidence: MarketPulseEvidence[] = [];
  if (marketContext?.insight) {
    rawEvidence.push({ source: "market_context", message: marketContext.insight });
  }
  if (marketContext?.nearestLevel) {
    const nl = marketContext.nearestLevel;
    const sign = (n: number) => (n >= 0 ? "+" : "");
    rawEvidence.push({
      source: "market_context",
      message: `Nearest level: ${nl.label} at ${nl.price} (distance ${sign(nl.distance)}${nl.distance}, ${sign(nl.distancePercent)}${nl.distancePercent}%).`,
    });
  }
  rawEvidence.push(...regime.evidence.map((message) => ({ source: "regime" as const, message })));
  rawEvidence.push(...phase.evidence.map((message) => ({ source: "phase" as const, message })));
  rawEvidence.push(...volatility.evidence.map((message) => ({ source: "volatility" as const, message })));
  rawEvidence.push(...conviction.evidence.map((message) => ({ source: "conviction" as const, message })));
  rawEvidence.push(...environment.evidence.map((message) => ({ source: "environment" as const, message })));
  if (degradations.length > 0) {
    rawEvidence.push({ source: "pulse", message: `Data quality degraded: ${degradations.join("; ")}.` });
  }

  // Trader-facing cap: exact duplicates removed (first occurrence wins,
  // per dedupeEvidence), then capped at MAX_EVIDENCE_ITEMS. Order is
  // preserved throughout, so a cap only ever drops the LEAST-prioritized
  // trailing items (later engines / the pulse-level note), never
  // reorders what survives.
  const evidence = dedupeEvidence(rawEvidence).slice(0, MAX_EVIDENCE_ITEMS);

  return {
    symbol,
    generatedAt: new Date().toISOString(),
    status,
    regime,
    phase,
    bias,
    conviction,
    volatility,
    environment,
    nearestLevel,
    summary: buildSummary(symbol, regime, phase, bias, conviction, volatility, environment),
    evidence,
    dataQuality: {
      dailyHistory: history.dataQuality.dailyHistory,
      weeklyHistory: history.dataQuality.weeklyHistory,
      marketContext: marketContext ? "available" : "unavailable",
    },
  };
}
