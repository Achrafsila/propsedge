import type { MarketContext } from "../types";
import type { MarketRegimeResult, MarketRegime } from "./marketRegime";
import type { MarketPhaseResult, MarketPhase } from "./marketPhase";
import type { MarketVolatilityResult } from "./marketVolatility";
import type { MarketConvictionResult } from "./marketConviction";

// ============================================================
// PropEdge — Market Environment Engine (deterministic)
// ============================================================
// Pure function: MarketRegimeResult + MarketPhaseResult +
// MarketVolatilityResult + MarketConvictionResult (+ optional
// MarketContext) -> MarketEnvironmentResult. No API calls, no React, no
// Supabase, no localStorage, no AI/LLM, no external indicators, and no
// raw OHLC. This is the top of the orchestration stack: it reads only
// the already-computed outputs of the four engines below it.
//
// Market Environment is NOT a buy/sell signal, NOT a probability of
// success, NOT an entry recommendation, and NOT a measure of account
// risk. It only describes how clear and tradable current conditions are
// — a range regime in a clean rotation can be just as "favorable" an
// environment as a trending market in expansion; this engine never picks
// a direction, it only judges structural clarity.
//
// Design: structural clarity (from Regime + Phase together) is the
// primary axis — is there a well-defined regime, and does Phase agree
// with it or contradict it? Volatility and Conviction are bounded
// modifiers on top of that base, not independent axes:
//   - Volatility only ever penalizes (extreme = chaotic = worse for any
//     environment); low/normal/high volatility alone is not treated as a
//     red flag.
//   - Conviction only modifies environment quality when Regime is
//     trend-directional (bullish_trend / bearish_trend). For a range or
//     transition regime, Conviction's directional read is not a
//     meaningful signal about environment quality — a clean range
//     naturally produces low directional conviction (there is no
//     direction to have conviction about), and treating that as a
//     quality problem would misrepresent a genuinely well-defined range
//     as "poor". This is also why Conviction's internal alignment logic
//     (aligned_neutral vs. contradictory) is never re-derived here: for
//     trend regimes, Conviction's own output already carries everything
//     needed.
//
// Scope note: MarketContext is accepted (per the brief, "optionally...
// if needed") but is not incorporated into the classification math.
// Conviction already consumes MarketContext's structural bias when
// forming its own read, so re-deriving anything from it here would
// duplicate that engine's logic rather than orchestrate its output —
// exactly what the brief asks this engine to avoid. If provided, it is
// only cited in evidence for traceability.
//
// Foundation-scope engine: not connected to EdgePilot, the API route, or
// any UI yet. Market Pulse / Liquidity Engine / Breakout Engine / LLM
// narration / trade signals / entry recommendations are explicitly out
// of scope for this iteration and are not implemented here.

export type MarketEnvironment = "poor" | "selective" | "favorable" | "unknown";
export type MarketEnvironmentConfidence = "low" | "medium" | "high";

export interface MarketEnvironmentResult {
  symbol: string;
  environment: MarketEnvironment;
  confidence: MarketEnvironmentConfidence;
  evidence: string[];
}

type Clarity = "clear" | "mixed" | "unclear";

const LEVELS: Exclude<MarketEnvironment, "unknown">[] = ["poor", "selective", "favorable"];

const CLARITY_BASE: Record<Clarity, Exclude<MarketEnvironment, "unknown">> = {
  clear: "favorable",
  mixed: "selective",
  unclear: "poor",
};

// Regime + Phase together decide structural clarity. "Transition" is
// unconditionally unclear — it is the Regime engine's own definition of
// "not yet confirmed as trend or range". For a trend regime, Phase either
// confirms it (expansion/pullback), leaves it resting (compression /
// unknown), or directly contradicts it (rotation — two-sided movement
// inside an active trend is a real tension, not noise). For a range
// regime, Phase either confirms the bounded read (rotation/compression)
// or introduces breakout tension the regime hasn't confirmed yet
// (expansion / unknown). Any other combination defaults to "mixed" —
// the conservative middle ground, never silently treated as clear.
function structuralClarity(regime: MarketRegime, phase: MarketPhase): Clarity {
  if (regime === "transition") return "unclear";

  if (regime === "bullish_trend" || regime === "bearish_trend") {
    if (phase === "expansion" || phase === "pullback") return "clear";
    if (phase === "rotation") return "unclear";
    return "mixed"; // compression or unknown
  }

  if (regime === "range") {
    if (phase === "rotation" || phase === "compression") return "clear";
    return "mixed"; // expansion (possible breakout tension) or unknown
  }

  return "mixed";
}

export function computeMarketEnvironment(
  regime: MarketRegimeResult,
  phase: MarketPhaseResult,
  volatility: MarketVolatilityResult,
  conviction: MarketConvictionResult,
  marketContext?: MarketContext | null
): MarketEnvironmentResult {
  const symbol = regime?.symbol ?? "unknown";
  const evidence: string[] = [];

  // Regime is the primary structural anchor, same as it is for Phase and
  // Conviction — if it could not be determined, there is no structure to
  // judge clarity against.
  if (!regime || regime.regime === "unknown") {
    evidence.push("Market Regime could not be determined (unknown) — environment quality requires a resolvable regime as the structural anchor.");
    return { symbol, environment: "unknown", confidence: "low", evidence };
  }

  const clarity = structuralClarity(regime.regime, phase.phase);
  let environment: MarketEnvironment = CLARITY_BASE[clarity];

  evidence.push(`Market Regime: ${regime.regime}; Market Phase: ${phase.phase}.`);
  evidence.push(`Structural clarity: ${clarity} -> base environment "${environment}".`);

  const isTrendRegime = regime.regime === "bullish_trend" || regime.regime === "bearish_trend";
  let volDelta = 0;
  let convDelta = 0;

  if (volatility.volatility === "extreme") {
    volDelta = -1;
    evidence.push(`Market Volatility: ${volatility.volatility}. Extreme volatility degrades environment quality regardless of structure.`);
  } else {
    evidence.push(`Market Volatility: ${volatility.volatility}.${volatility.volatility === "unknown" ? " No volatility modifier applied." : " Not extreme — no penalty."}`);
  }

  if (isTrendRegime) {
    if (conviction.conviction === "high") {
      convDelta = 1;
      evidence.push(`Market Conviction: ${conviction.conviction}. Strong directional alignment reinforces the trending environment.`);
    } else if (conviction.conviction === "low") {
      convDelta = -1;
      evidence.push(`Market Conviction: ${conviction.conviction}. Weak/contradictory alignment undermines confidence in the trending environment.`);
    } else {
      evidence.push(`Market Conviction: ${conviction.conviction}.${conviction.conviction === "medium" ? " Adequate alignment — no modifier applied." : " No conviction modifier applied."}`);
    }
  } else {
    evidence.push(
      `Market Conviction: ${conviction.conviction}. Regime is not trend-directional (${regime.regime}) — conviction is not a meaningful environment-quality signal here, so no modifier is applied.`
    );
  }

  const baseIndex = LEVELS.indexOf(environment as Exclude<MarketEnvironment, "unknown">);
  const adjustedIndex = Math.max(0, Math.min(LEVELS.length - 1, baseIndex + volDelta + convDelta));
  const adjusted = LEVELS[adjustedIndex];
  if (adjusted !== environment) {
    evidence.push(`Modifiers adjust environment from "${environment}" to "${adjusted}".`);
    environment = adjusted;
  }

  if (marketContext) {
    evidence.push(`Market Context structural bias: ${marketContext.bias} (already reflected in Market Conviction — cited here for traceability only).`);
  }

  // Confidence: how many of the four core inputs were actually
  // resolvable, never a percentage. Regime is always resolved here
  // (guarded above), so it always counts.
  const resolvedInputs =
    1 + [phase.phase !== "unknown", volatility.volatility !== "unknown", conviction.conviction !== "unknown"].filter(Boolean).length;
  const confidence: MarketEnvironmentConfidence = resolvedInputs >= 4 ? "high" : resolvedInputs >= 2 ? "medium" : "low";
  evidence.push(`Confidence set to "${confidence}" from ${resolvedInputs}/4 resolvable input(s) (regime, phase, volatility, conviction).`);

  return { symbol, environment, confidence, evidence };
}
