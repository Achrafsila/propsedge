import assert from "node:assert/strict";
import { computeMarketEnvironment } from "../src/lib/market/engines/marketEnvironment";
import type { MarketRegimeResult, MarketRegime } from "../src/lib/market/engines/marketRegime";
import type { MarketPhaseResult, MarketPhase } from "../src/lib/market/engines/marketPhase";
import type { MarketVolatilityResult, MarketVolatility } from "../src/lib/market/engines/marketVolatility";
import type { MarketConvictionResult, MarketConviction } from "../src/lib/market/engines/marketConviction";
import type { MarketContext, StructuralBias } from "../src/lib/market/types";

// ============================================================
// PropEdge — Market Environment Engine deterministic scenarios
// ============================================================
// No network, no candle fixtures — Environment orchestrates already-
// computed engine outputs, so every fixture here is a literal
// MarketRegimeResult / MarketPhaseResult / MarketVolatilityResult /
// MarketConvictionResult, constructed directly to exercise each
// documented structural-clarity/modifier rule.
// Run: npx tsx scripts/market-environment-scenarios.ts

let pass = 0;
function scenario(name: string, fn: () => void) {
  fn();
  pass++;
  console.log(`  ok — ${name}`);
}

function regimeResult(regime: MarketRegime): MarketRegimeResult {
  return { symbol: "EURUSD", regime, confidence: "high", evidence: [] };
}
function phaseResult(phase: MarketPhase): MarketPhaseResult {
  return { symbol: "EURUSD", phase, confidence: "high", evidence: [] };
}
function volatilityResult(volatility: MarketVolatility): MarketVolatilityResult {
  return { symbol: "EURUSD", volatility, confidence: "high", evidence: [] };
}
function convictionResult(conviction: MarketConviction): MarketConvictionResult {
  return { symbol: "EURUSD", conviction, confidence: "high", evidence: [] };
}
function context(bias: StructuralBias): MarketContext {
  return { bias, nearestLevel: null, distances: [], insight: "" };
}

// ── 1. Trend + expansion + high conviction + normal volatility -> favorable, high confidence ──

scenario("Trending, expanding, high conviction -> favorable, high confidence", () => {
  const result = computeMarketEnvironment(regimeResult("bullish_trend"), phaseResult("expansion"), volatilityResult("normal"), convictionResult("high"));
  assert.equal(result.environment, "favorable");
  assert.equal(result.confidence, "high");
  assert.ok(result.evidence.some((e) => e.includes("clear -> base environment")), "evidence names the clarity classification");
});

// ── 2. Trend + rotation contradicts phase -> unclear base (poor), but high conviction pulls it back to selective ──

scenario("Trend contradicted by rotation phase, but high conviction -> pulled up from poor to selective", () => {
  const result = computeMarketEnvironment(regimeResult("bearish_trend"), phaseResult("rotation"), volatilityResult("normal"), convictionResult("high"));
  assert.equal(result.environment, "selective");
  assert.ok(result.evidence.some((e) => e.includes('adjust environment from "poor" to "selective"')), "evidence explains the upward adjustment");
});

// ── 3. Clean range (rotation, low volatility) -> favorable ──

scenario("Range regime + rotation + low volatility -> favorable (clean range)", () => {
  const result = computeMarketEnvironment(regimeResult("range"), phaseResult("rotation"), volatilityResult("low"), convictionResult("low"));
  assert.equal(result.environment, "favorable");
  assert.ok(
    result.evidence.some((e) => e.includes("not a meaningful environment-quality signal")),
    "evidence explains conviction is not applied for a non-trend regime"
  );
});

// ── 4. Same clean range, but extreme volatility -> downgraded to selective ──

scenario("Range regime + rotation + extreme volatility -> downgraded to selective", () => {
  const result = computeMarketEnvironment(regimeResult("range"), phaseResult("rotation"), volatilityResult("extreme"), convictionResult("low"));
  assert.equal(result.environment, "selective");
  assert.ok(result.evidence.some((e) => e.includes("degrades environment quality")), "evidence explains the volatility penalty");
});

// ── 5. Range + expansion (breakout tension, regime not yet confirmed) -> selective ──

scenario("Range regime + expansion phase (breakout tension) -> selective", () => {
  const result = computeMarketEnvironment(regimeResult("range"), phaseResult("expansion"), volatilityResult("normal"), convictionResult("low"));
  assert.equal(result.environment, "selective");
});

// ── 6. Transition regime -> always poor, unaffected by strong conviction/low volatility ──

scenario("Transition regime -> always poor, even with strong conviction and calm volatility", () => {
  const result = computeMarketEnvironment(regimeResult("transition"), phaseResult("unknown"), volatilityResult("low"), convictionResult("high"));
  assert.equal(result.environment, "poor");
  assert.ok(result.evidence.some((e) => e.includes("unclear -> base environment")), "evidence names transition as unclear");
});

// ── 7. Trend + compression + extreme volatility -> double penalty down to poor ──

scenario("Trend resting (compression) + extreme volatility -> poor (double penalty)", () => {
  const result = computeMarketEnvironment(regimeResult("bullish_trend"), phaseResult("compression"), volatilityResult("extreme"), convictionResult("medium"));
  assert.equal(result.environment, "poor");
});

// ── 8. Regime unknown -> hard gate to unknown ──

scenario("Regime unknown -> hard gate to unknown regardless of other inputs", () => {
  const result = computeMarketEnvironment(regimeResult("unknown"), phaseResult("expansion"), volatilityResult("normal"), convictionResult("high"));
  assert.equal(result.environment, "unknown");
  assert.equal(result.confidence, "low");
  assert.ok(result.evidence.some((e) => e.includes("structural anchor")), "evidence names regime as the anchor");
});

// ── 9. Confidence degrades with unresolved inputs ──

scenario("Phase/volatility/conviction unknown -> environment still resolves, confidence low", () => {
  const result = computeMarketEnvironment(regimeResult("bullish_trend"), phaseResult("unknown"), volatilityResult("unknown"), convictionResult("unknown"));
  assert.equal(result.environment, "selective"); // trend + phase unknown -> mixed base, no modifiers applied (both unknown)
  assert.equal(result.confidence, "low"); // only 1 of 4 inputs resolved
});

// ── 10. MarketContext is optional and cited, but never changes the classification ──

scenario("MarketContext is cited in evidence but does not change the result", () => {
  const withoutContext = computeMarketEnvironment(regimeResult("bullish_trend"), phaseResult("expansion"), volatilityResult("normal"), convictionResult("high"));
  const withContext = computeMarketEnvironment(
    regimeResult("bullish_trend"),
    phaseResult("expansion"),
    volatilityResult("normal"),
    convictionResult("high"),
    context("bullish")
  );
  assert.equal(withoutContext.environment, withContext.environment);
  assert.equal(withoutContext.confidence, withContext.confidence);
  assert.ok(withContext.evidence.some((e) => e.includes("Market Context structural bias")), "evidence cites the context when provided");
  assert.ok(!withoutContext.evidence.some((e) => e.includes("Market Context structural bias")), "no context evidence line when not provided");
});

console.log(`\n${pass} scenario(s) passed.`);
