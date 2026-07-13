import assert from "node:assert/strict";
import { computeMarketConviction } from "../src/lib/market/engines/marketConviction";
import type { MarketRegimeResult, MarketRegime } from "../src/lib/market/engines/marketRegime";
import type { MarketPhaseResult, MarketPhase } from "../src/lib/market/engines/marketPhase";
import type { MarketVolatilityResult, MarketVolatility } from "../src/lib/market/engines/marketVolatility";
import type { MarketContext, StructuralBias } from "../src/lib/market/types";

// ============================================================
// PropEdge — Market Conviction Engine deterministic scenarios
// ============================================================
// No network, no candle fixtures — Conviction orchestrates already-
// computed engine outputs, so every fixture here is a literal
// MarketRegimeResult / MarketPhaseResult / MarketVolatilityResult /
// MarketContext, constructed directly to exercise each documented
// alignment/modifier rule.
// Run: npx tsx scripts/market-conviction-scenarios.ts

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
function context(bias: StructuralBias): MarketContext {
  return { bias, nearestLevel: null, distances: [], insight: "" };
}

// ── 1. Full alignment, expansion, normal volatility -> high, high confidence ──

scenario("Aligned bullish + expansion + normal volatility -> high conviction, high confidence", () => {
  const result = computeMarketConviction(regimeResult("bullish_trend"), phaseResult("expansion"), volatilityResult("normal"), context("bullish"));
  assert.equal(result.conviction, "high");
  assert.equal(result.confidence, "high");
  assert.ok(result.evidence.some((e) => e.includes("Alignment: aligned_directional")), "evidence names the alignment classification");
});

// ── 2. Mirror bearish case, pullback (no change), low volatility ──

scenario("Aligned bearish + pullback + low volatility -> high conviction (pullback does not reinforce or weaken)", () => {
  const result = computeMarketConviction(regimeResult("bearish_trend"), phaseResult("pullback"), volatilityResult("low"), context("bearish"));
  assert.equal(result.conviction, "high");
  assert.equal(result.confidence, "high");
});

// ── 3. Aligned directional but rotation phase contradicts -> downgraded to medium ──

scenario("Aligned bullish but rotation phase contradicts -> downgraded from high to medium", () => {
  const result = computeMarketConviction(regimeResult("bullish_trend"), phaseResult("rotation"), volatilityResult("normal"), context("bullish"));
  assert.equal(result.conviction, "medium");
  assert.ok(
    result.evidence.some((e) => e.includes('adjust conviction from "high" to "medium"')),
    "evidence explains the downgrade"
  );
});

// ── 4. Double penalty: compression AND extreme volatility -> down to low ──

scenario("Aligned bullish but compression + extreme volatility -> down to low (double penalty)", () => {
  const result = computeMarketConviction(regimeResult("bullish_trend"), phaseResult("compression"), volatilityResult("extreme"), context("bullish"));
  assert.equal(result.conviction, "low");
});

// ── 5. Partial alignment (context unavailable), expansion pushes medium -> high ──

scenario("Regime bullish, no market context, expansion phase -> partial base promoted to high", () => {
  const result = computeMarketConviction(regimeResult("bullish_trend"), phaseResult("expansion"), volatilityResult("normal"), null);
  assert.equal(result.conviction, "high");
  assert.equal(result.confidence, "medium"); // 3 of 4 inputs resolved (context missing)
});

// ── 6. Contradictory regime vs. context -> low, and modifiers do NOT rescue it ──

scenario("Regime bullish, context bearish (contradictory) -> low, expansion does not rescue it", () => {
  const result = computeMarketConviction(regimeResult("bullish_trend"), phaseResult("expansion"), volatilityResult("normal"), context("bearish"));
  assert.equal(result.conviction, "low");
  assert.equal(result.confidence, "high"); // all 4 inputs WERE resolvable — we are confident they disagree
  assert.ok(result.evidence.some((e) => e.includes("is not refinable")), "evidence explains modifiers were skipped");
});

// ── 7. Aligned neutral (range regime + neutral context) -> low, unaffected by phase ──

scenario("Range regime + neutral context (aligned_neutral) -> low, rotation phase does not change it", () => {
  const result = computeMarketConviction(regimeResult("range"), phaseResult("rotation"), volatilityResult("normal"), context("neutral"));
  assert.equal(result.conviction, "low");
  assert.ok(result.evidence.some((e) => e.includes("aligned_neutral")), "evidence names the neutral alignment");
});

// ── 8. Insufficient: transition regime + no context -> unknown ──

scenario("Transition regime + no market context -> unknown, low confidence", () => {
  const result = computeMarketConviction(regimeResult("transition"), phaseResult("unknown"), volatilityResult("unknown"), null);
  assert.equal(result.conviction, "unknown");
  assert.equal(result.confidence, "low");
  assert.ok(result.evidence.some((e) => e.includes("no directional view is supported")), "evidence explains the insufficiency");
});

// ── 9. Regime itself unknown -> hard gate to unknown ──

scenario("Regime unknown -> hard gate to unknown regardless of other inputs", () => {
  const result = computeMarketConviction(regimeResult("unknown"), phaseResult("expansion"), volatilityResult("normal"), context("bullish"));
  assert.equal(result.conviction, "unknown");
  assert.equal(result.confidence, "low");
  assert.ok(result.evidence.some((e) => e.includes("primary directional anchor")), "evidence names regime as the anchor");
});

// ── 10. Low confidence with a resolved conviction: only regime resolved ──

scenario("Only regime resolved (phase/volatility unknown, no context) -> conviction resolves, confidence low", () => {
  const result = computeMarketConviction(regimeResult("bullish_trend"), phaseResult("unknown"), volatilityResult("unknown"), null);
  assert.equal(result.conviction, "medium"); // partial alignment base, no modifiers (both unknown)
  assert.equal(result.confidence, "low"); // only 1 of 4 inputs resolved
});

console.log(`\n${pass} scenario(s) passed.`);
