import type { MarketContext } from "../types";
import type { MarketRegimeResult } from "./marketRegime";
import type { MarketPhaseResult } from "./marketPhase";
import type { MarketVolatilityResult } from "./marketVolatility";

// ============================================================
// PropEdge — Market Conviction Engine (deterministic)
// ============================================================
// Pure function: MarketRegimeResult + MarketPhaseResult +
// MarketVolatilityResult + MarketContext -> MarketConvictionResult. No API
// calls, no React, no Supabase, no localStorage, no AI/LLM, no external
// indicators, and — deliberately — no raw OHLC. This is an orchestration
// layer: it reads only the already-computed outputs of the Regime, Phase,
// Volatility, and Market Context engines and asks one question — how much
// do these already-independent deterministic reads agree with each other?
//
// Conviction is NOT confidence in the code, NOT a probability, and NOT a
// trade signal. It is a measure of agreement between existing facts. Two
// engines disagreeing is itself a fact worth surfacing (as "low"
// conviction), not an error to hide.
//
// Scope note: MarketContext's key-level proximity data (nearestLevel /
// distances) is intentionally NOT used here. The brief calls it optional,
// and folding "how close price is to a level" into an alignment score
// would require a new, under-specified heuristic (how close is
// "close"?) rather than orchestrating what the four inputs already
// decided — exactly the kind of engine-logic duplication this file is
// meant to avoid. A future iteration can add it deliberately, scoped on
// its own.
//
// Foundation-scope engine: not connected to EdgePilot, the API route, or
// any UI yet. Market Pulse / Opportunity Engine / Liquidity Engine /
// Breakout Engine / LLM narration are explicitly out of scope for this
// iteration and are not implemented here.

export type MarketConviction = "low" | "medium" | "high" | "unknown";
export type MarketConvictionConfidence = "low" | "medium" | "high";

export interface MarketConvictionResult {
  symbol: string;
  conviction: MarketConviction;
  confidence: MarketConvictionConfidence;
  evidence: string[];
}

type Direction = "bullish" | "bearish" | "neutral" | "unknown";
type Alignment = "aligned_directional" | "aligned_neutral" | "partial" | "contradictory" | "insufficient";

const LEVELS: Exclude<MarketConviction, "unknown">[] = ["low", "medium", "high"];

function regimeDirection(regime: MarketRegimeResult): Direction {
  if (regime.regime === "bullish_trend") return "bullish";
  if (regime.regime === "bearish_trend") return "bearish";
  if (regime.regime === "range") return "neutral";
  // "transition" and "unknown" are both genuinely unresolved for
  // direction purposes — transition is explicitly documented (in the
  // Regime engine) as "not yet confirmed as trend or range".
  return "unknown";
}

function contextDirection(marketContext: MarketContext | null): Direction {
  if (!marketContext) return "unknown";
  if (marketContext.bias === "bullish") return "bullish";
  if (marketContext.bias === "bearish") return "bearish";
  if (marketContext.bias === "neutral") return "neutral";
  return "unknown";
}

function classifyAlignment(regimeDir: Direction, contextDir: Direction): Alignment {
  if (regimeDir === "unknown" && contextDir === "unknown") return "insufficient";
  if (regimeDir === "unknown" || contextDir === "unknown") return "partial";
  if (regimeDir === contextDir) return regimeDir === "neutral" ? "aligned_neutral" : "aligned_directional";
  if ((regimeDir === "bullish" && contextDir === "bearish") || (regimeDir === "bearish" && contextDir === "bullish")) return "contradictory";
  return "partial"; // one neutral, one directional
}

function baseConviction(alignment: Exclude<Alignment, "insufficient">): Exclude<MarketConviction, "unknown"> {
  switch (alignment) {
    case "aligned_directional":
      return "high";
    case "partial":
      return "medium";
    case "aligned_neutral":
    case "contradictory":
      return "low";
  }
}

interface Modifier {
  delta: -1 | 0 | 1;
  note: string;
}

// Phase refines an already-coherent directional read: it does not rescue
// a contradictory one (see the alignment gate in computeMarketConviction).
// Expansion actively confirms directional force; pullback is a normal
// corrective pause (direction intact, not currently reinforced, so no
// change); compression suggests the trend is resting; rotation
// (two-sided movement) directly contradicts an active trend.
function phaseModifier(phase: MarketPhaseResult, primaryDirection: Direction): Modifier {
  if (primaryDirection !== "bullish" && primaryDirection !== "bearish") return { delta: 0, note: "" };
  switch (phase.phase) {
    case "expansion":
      return { delta: 1, note: "Expansion phase actively confirms directional force." };
    case "pullback":
      return { delta: 0, note: "Pullback phase is a normal corrective pause within the trend — direction intact, not currently reinforced." };
    case "compression":
      return { delta: -1, note: "Compression phase suggests the trend is resting, weakening current directional force." };
    case "rotation":
      return { delta: -1, note: "Rotation phase (two-sided movement) contradicts an active directional trend." };
    case "unknown":
      return { delta: 0, note: "Phase could not be determined — no phase modifier applied." };
  }
}

// Volatility affects reliability of the read, not direction. Only
// "extreme" volatility penalizes conviction — low/normal/high volatility
// alone is not treated as a red flag (a strong, orderly directional move
// can legitimately carry above-normal range; "expansion" phase already
// covers the healthy version of that).
function volatilityModifier(volatility: MarketVolatilityResult, primaryDirection: Direction): Modifier {
  if (primaryDirection !== "bullish" && primaryDirection !== "bearish") return { delta: 0, note: "" };
  if (volatility.volatility === "extreme") return { delta: -1, note: "Extreme volatility reduces reliability of the directional read." };
  if (volatility.volatility === "unknown") return { delta: 0, note: "Volatility could not be determined — no volatility modifier applied." };
  return { delta: 0, note: "" };
}

export function computeMarketConviction(
  regime: MarketRegimeResult,
  phase: MarketPhaseResult,
  volatility: MarketVolatilityResult,
  marketContext: MarketContext | null
): MarketConvictionResult {
  const symbol = regime?.symbol ?? "unknown";
  const evidence: string[] = [];

  // Regime is the primary directional anchor (every other engine either
  // consumes it, as Phase's pullback check does, or is direction-agnostic,
  // as Volatility is). If regime itself could not be determined, there is
  // no anchor to orchestrate around.
  if (!regime || regime.regime === "unknown") {
    evidence.push("Market Regime could not be determined (unknown) — conviction requires a resolvable regime as the primary directional anchor.");
    return { symbol, conviction: "unknown", confidence: "low", evidence };
  }

  const regimeDir = regimeDirection(regime);
  const contextDir = contextDirection(marketContext);
  const alignment = classifyAlignment(regimeDir, contextDir);

  evidence.push(`Market Regime: ${regime.regime} (direction: ${regimeDir}).`);
  evidence.push(marketContext ? `Market Context structural bias: ${marketContext.bias} (direction: ${contextDir}).` : "Market Context is unavailable (no structural bias to compare).");

  if (alignment === "insufficient") {
    evidence.push("Neither Market Regime nor Market Context resolves to a direction — no directional view is supported.");
    return { symbol, conviction: "unknown", confidence: "low", evidence };
  }

  let conviction: MarketConviction = baseConviction(alignment);
  evidence.push(`Alignment: ${alignment} -> base conviction "${conviction}".`);

  // Phase/Volatility only refine an already-coherent base (aligned or
  // partial) — they never rescue a contradictory or neutral-agreed read.
  const refinable = alignment === "aligned_directional" || alignment === "partial";
  if (refinable) {
    const primaryDirection: Direction = regimeDir !== "unknown" ? regimeDir : contextDir;
    const phaseMod = phaseModifier(phase, primaryDirection);
    const volMod = volatilityModifier(volatility, primaryDirection);

    evidence.push(`Market Phase: ${phase.phase}.${phaseMod.note ? ` ${phaseMod.note}` : ""}`);
    evidence.push(`Market Volatility: ${volatility.volatility}.${volMod.note ? ` ${volMod.note}` : ""}`);

    const baseIndex = LEVELS.indexOf(conviction as Exclude<MarketConviction, "unknown">);
    const adjustedIndex = Math.max(0, Math.min(LEVELS.length - 1, baseIndex + phaseMod.delta + volMod.delta));
    const adjusted = LEVELS[adjustedIndex];

    if (adjusted !== conviction) {
      evidence.push(`Phase/volatility modifiers adjust conviction from "${conviction}" to "${adjusted}".`);
      conviction = adjusted;
    }
  } else {
    evidence.push(`Alignment "${alignment}" is not refinable — phase and volatility are reported but do not change the base conviction.`);
    evidence.push(`Market Phase: ${phase.phase}.`);
    evidence.push(`Market Volatility: ${volatility.volatility}.`);
  }

  // Confidence: how many of the four inputs were actually resolvable,
  // never a percentage. Regime is always resolved at this point (guarded
  // above), so it always counts.
  const resolvedInputs =
    1 + [phase.phase !== "unknown", volatility.volatility !== "unknown", contextDir !== "unknown"].filter(Boolean).length;
  const confidence: MarketConvictionConfidence = resolvedInputs >= 4 ? "high" : resolvedInputs >= 2 ? "medium" : "low";
  evidence.push(`Confidence set to "${confidence}" from ${resolvedInputs}/4 resolvable input(s) (regime, phase, volatility, market context).`);

  return { symbol, conviction, confidence, evidence };
}
