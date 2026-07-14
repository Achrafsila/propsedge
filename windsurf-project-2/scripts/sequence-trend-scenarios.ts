import assert from "node:assert/strict";
import { evaluateSwingSequence } from "../src/lib/market/engines/sequenceTrendEvaluator";
import { SwingPoint } from "../src/lib/market/engines/swingDetection";

// ============================================================
// Sequence Trend Evaluator deterministic scenarios (Sprint 2 / Phase 2)
// ============================================================
// No network. Fixtures reuse the exact live XAUUSD swing sequences pulled
// during Sprint 2 Phase 1's calibration run — verified against the pure
// function before being hardcoded here as assertions.
// Run: npx tsx scripts/sequence-trend-scenarios.ts

let pass = 0;
function scenario(name: string, fn: () => void) {
  fn();
  pass++;
  console.log(`  ok — ${name}`);
}

function h(price: number, i: number): SwingPoint {
  return { type: "high", index: i, price, datetime: `d${i}` };
}
function l(price: number, i: number): SwingPoint {
  return { type: "low", index: i, price, datetime: `d${i}` };
}

scenario("Clean ascending sequence -> bullish, strong consistency", () => {
  const highs = [100, 105, 110, 115, 120].map((p, i) => h(p, i));
  const lows = [90, 95, 100, 105, 110].map((p, i) => l(p, i));
  const result = evaluateSwingSequence(highs, lows);
  assert.equal(result.trend, "bullish");
  assert.equal(result.consistency, "strong");
  assert.deepEqual(result.highs, { higher: 4, lower: 0, equal: 0 });
});

scenario("Clean descending sequence -> bearish, strong consistency", () => {
  const highs = [120, 115, 110, 105, 100].map((p, i) => h(p, i));
  const lows = [110, 105, 100, 95, 90].map((p, i) => l(p, i));
  const result = evaluateSwingSequence(highs, lows);
  assert.equal(result.trend, "bearish");
  assert.equal(result.consistency, "strong");
});

scenario("Live XAUUSD Daily fixture (3 lower highs then a small bounce; lows mostly lower) -> mixed, weak — NOT a confident bullish read despite the last-two-swings ticking up", () => {
  const highs = [4359.95814, 4383.61801, 4216.38487, 4195.33479, 4202.03378].map((p, i) => h(p, i));
  const lows = [4213.19131, 4122.52133, 3961.49428, 3949.44708, 4022.20256].map((p, i) => l(p, i));
  const result = evaluateSwingSequence(highs, lows);
  assert.equal(result.trend, "mixed");
  assert.equal(result.consistency, "weak");
  // The old engine's last-two-only comparison would have called this bullish (4195->4202, 3949->4022 both "higher") —
  // the sequence read correctly refuses that overconfident conclusion.
});

scenario("Live XAUUSD H4 fixture (descending highs, ascending lows until a sharp final drop) -> mixed, not a confident bearish read", () => {
  const highs = [4134.11055, 4092.4117, 4125.6944, 4112.96916, 4099.20066].map((p, i) => h(p, i));
  const lows = [4022.20256, 4054.06488, 4076.64085, 4107.55154, 3985.81051].map((p, i) => l(p, i));
  const result = evaluateSwingSequence(highs, lows);
  assert.equal(result.trend, "mixed");
});

scenario("Equal highs and equal lows -> range, strong consistency", () => {
  const highs = [110, 110, 110, 110].map((p, i) => h(p, i));
  const lows = [100, 100, 100, 100].map((p, i) => l(p, i));
  const result = evaluateSwingSequence(highs, lows);
  assert.equal(result.trend, "range");
  assert.equal(result.consistency, "strong");
});

scenario("Lower highs + higher lows (narrowing) -> mixed, NOT range (deliberately distinct from marketRegime.ts's own 'narrowing = range' convention)", () => {
  const highs = [120, 115, 112, 110].map((p, i) => h(p, i));
  const lows = [90, 95, 98, 100].map((p, i) => l(p, i));
  const result = evaluateSwingSequence(highs, lows);
  assert.equal(result.trend, "mixed");
});

scenario("Moderate consistency: 3-of-4 comparisons agree, 1 disagrees", () => {
  const highs = [100, 105, 110, 108, 115].map((p, i) => h(p, i)); // higher, higher, lower, higher = 3 higher, 1 lower
  const lows = [90, 95, 100, 105, 110].map((p, i) => l(p, i)); // all higher
  const result = evaluateSwingSequence(highs, lows);
  assert.equal(result.trend, "bullish"); // 3/4 is still a majority
  assert.equal(result.consistency, "moderate"); // (3+4)/8 = 87.5%... let's just check it's not "strong"
  assert.notEqual(result.consistency, "strong");
});

scenario("Fewer than 3 confirmed swings per side -> unknown, never guessed", () => {
  const result = evaluateSwingSequence([h(100, 0), h(105, 1)], [l(90, 0), l(95, 1)]);
  assert.equal(result.trend, "unknown");
  assert.equal(result.evidence[0].includes("at least 3"), true);
});

scenario("Window caps at the most recent N swings — older swings never influence the read", () => {
  // 7 highs total, ascending overall, but force the window to only see the last 3 (all equal) via an explicit window param.
  const highs = [50, 60, 70, 80, 90, 100, 100].map((p, i) => h(p, i)); // last 3: 80,90->100? not equal; use exact equal tail instead
  const equalTailHighs = [50, 60, 70, 100, 100, 100].map((p, i) => h(p, i));
  const lows = [40, 50, 60, 90, 90, 90].map((p, i) => l(p, i));
  const result = evaluateSwingSequence(equalTailHighs, lows, 3);
  assert.equal(result.trend, "range"); // last 3 of each side are flat/equal, regardless of the ascending swings before them
  void highs;
});

console.log(`\n${pass} scenario(s) passed.`);
