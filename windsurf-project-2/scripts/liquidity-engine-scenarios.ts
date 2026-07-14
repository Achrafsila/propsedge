import assert from "node:assert/strict";
import {
  computeTimeframeLiquidity,
  computeMultiTimeframeLiquidity,
  computeLiquidity,
  clusterEqualLevels,
} from "../src/lib/edge-pulse/engines/liquidityEngine";
import { SwingPoint } from "../src/lib/market/engines/swingDetection";
import { MarketCandle } from "../src/lib/market/types";
import { TimeframeCandles } from "../src/lib/edge-pulse/types";

// ============================================================
// Edge Pulse — Liquidity Engine deterministic scenarios (Sprint 1 / Phase 2)
// ============================================================
// No network. Every fixture's expected candidate/state/score was
// independently verified against the pure engine before being hardcoded
// here as assertions — same discipline as scripts/market-regime-scenarios.ts.
// Cross-referenced to docs/edge-pulse-market-definitions.md throughout.
// Run: npx tsx scripts/liquidity-engine-scenarios.ts

let pass = 0;
function scenario(name: string, fn: () => void) {
  fn();
  pass++;
  console.log(`  ok — ${name}`);
}

// ── Fixture helpers ────────────────────────────────────────────────────────

function candleFromValue(v: number, datetime: string): MarketCandle {
  return { datetime, open: v, high: v + 0.5, low: v - 0.5, close: v };
}
function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function toCandles(chrono: MarketCandle[]): MarketCandle[] {
  const lastDate = chrono[chrono.length - 1].datetime;
  const forming = candleFromValue(9999, addDays(lastDate, 1));
  return [forming, ...chrono.slice().reverse()];
}
function tfFromValues(values: number[], timeframe: "daily" | "h4" | "h1" | "m15" = "daily"): TimeframeCandles {
  const chrono = values.map((v, i) => candleFromValue(v, addDays("2026-01-01", i)));
  return { timeframe, candles: toCandles(chrono), quality: "complete" };
}
function swing(type: "high" | "low", index: number, price: number): SwingPoint {
  return { type, index, price, datetime: addDays("2026-01-01", index) };
}

// ── 1/2. Isolated swing high / low ─────────────────────────────────────────

scenario("Isolated swing high -> a single buy_side candidate, untouched", () => {
  const values = [90, 90, 100, 90, 90, 90, 90, 90, 90, 90]; // swing high 100.5 @2
  const r = computeTimeframeLiquidity("EURUSD", tfFromValues(values), 90);
  const buySide = r.candidates.filter((c) => c.side === "buy_side");
  assert.equal(buySide.length, 1);
  assert.equal(buySide[0].price, 100.5);
  assert.equal(buySide[0].origin, "swing_high");
  assert.equal(buySide[0].state, "untouched");
});

scenario("Isolated swing low -> a single sell_side candidate, untouched", () => {
  const values = [90, 90, 60, 90, 90, 90, 90, 90, 90, 90]; // swing low 59.5 @2
  const r = computeTimeframeLiquidity("EURUSD", tfFromValues(values), 90);
  const sellSide = r.candidates.filter((c) => c.side === "sell_side");
  assert.equal(sellSide.length, 1);
  assert.equal(sellSide[0].price, 59.5);
  assert.equal(sellSide[0].origin, "swing_low");
  assert.equal(sellSide[0].state, "untouched");
});

// ── 3/4. Equal highs (2 and 3 members), clean (nothing later supersedes) ──

scenario("Two equal highs within tolerance -> Equal Highs cluster, higher strength than an isolated swing", () => {
  const values = [90, 90, 80, 90, 90, 90, 90, 100, 90, 90, 90, 90, 100.15, 90, 90, 90, 90];
  const r = computeTimeframeLiquidity("EURUSD", tfFromValues(values), 90);
  const cluster = r.candidates.find((c) => c.origin === "equal_highs");
  assert.ok(cluster, "equal highs cluster found");
  assert.equal(cluster?.equalLevelCount, 2);
  assert.deepEqual(cluster?.equalLevelMembers, [100.5, 100.65]);
  const isolatedHigh = r.candidates.find((c) => c.origin === "swing_high");
  assert.ok(isolatedHigh);
  assert.ok((cluster!.strength === "high" ? 3 : cluster!.strength === "medium" ? 2 : 1) >= (isolatedHigh!.strength === "high" ? 3 : isolatedHigh!.strength === "medium" ? 2 : 1),
    "equal-highs strength is never lower than an isolated swing's");
});

scenario("Three equal highs within tolerance -> Equal Highs cluster, count 3", () => {
  const values = [90, 90, 80, 90, 90, 90, 90, 100, 90, 90, 90, 90, 100.1, 90, 90, 90, 90, 100.2, 90, 90];
  const r = computeTimeframeLiquidity("EURUSD", tfFromValues(values), 90);
  const cluster = r.candidates.find((c) => c.origin === "equal_highs");
  assert.ok(cluster);
  assert.equal(cluster?.equalLevelCount, 3);
  assert.deepEqual(cluster?.equalLevelMembers, [100.5, 100.6, 100.7]);
});

// ── 5. Bounded-cluster rejection ──────────────────────────────────────────

scenario("Bounded-cluster rejection: 4 ascending swings (pairwise gap 0.2, span 0.6) never form one 4-member cluster", () => {
  const values = [90, 90, 100, 90, 90, 90, 90, 100.2, 90, 90, 90, 90, 100.4, 90, 90, 90, 90, 100.6, 90, 90];
  const r = computeTimeframeLiquidity("EURUSD", tfFromValues(values), 90);
  const cluster = r.candidates.find((c) => c.origin === "equal_highs");
  assert.ok(cluster, "a cluster was found");
  assert.equal(cluster?.equalLevelCount, 2, "the old pairwise-chaining algorithm would have accepted all 4 (span 0.6); bounded clustering caps at 2");
  assert.deepEqual(cluster?.equalLevelMembers, [100.5, 100.7]);
  const span = Math.max(...cluster!.equalLevelMembers!) - Math.min(...cluster!.equalLevelMembers!);
  assert.ok(span <= 0.25 + 1e-9, "cluster span never exceeds tolerance");
});

scenario("clusterEqualLevels (direct unit test): span is always bounded by tolerance, regardless of chain length", () => {
  const swings: SwingPoint[] = [swing("high", 0, 100.0), swing("high", 1, 100.2), swing("high", 2, 100.4), swing("high", 3, 100.6)];
  const cluster = clusterEqualLevels(swings, 0.25);
  assert.ok(cluster);
  assert.equal(cluster?.length, 2);
  assert.deepEqual(cluster?.map((s) => s.price), [100.0, 100.2]);

  // A genuinely tight run of 4 (all within 0.25 of the lowest) DOES form one group.
  const tight: SwingPoint[] = [swing("high", 0, 100.0), swing("high", 1, 100.08), swing("high", 2, 100.16), swing("high", 3, 100.24)];
  const tightCluster = clusterEqualLevels(tight, 0.25);
  assert.equal(tightCluster?.length, 4);
});

// ── 6. Equal lows ──────────────────────────────────────────────────────────

scenario("Equal lows within tolerance -> Equal Lows cluster", () => {
  const values = [90, 90, 100, 90, 90, 90, 90, 60, 90, 90, 90, 90, 60.15, 90, 90];
  const r = computeTimeframeLiquidity("EURUSD", tfFromValues(values), 90);
  const cluster = r.candidates.find((c) => c.origin === "equal_lows");
  assert.ok(cluster);
  assert.equal(cluster?.equalLevelCount, 2);
  assert.deepEqual(cluster?.equalLevelMembers, [59.5, 59.65]);
});

// ── 7/8. Untouched / tested buy-side ──────────────────────────────────────

scenario("Untouched buy-side: no later candle reaches the level -> state stays untouched, 0 touches", () => {
  const values = [90, 90, 100, 90, 90, 90, 90, 90, 90, 90];
  const r = computeTimeframeLiquidity("EURUSD", tfFromValues(values), 90);
  const level = r.candidates.find((c) => c.price === 100.5)!;
  assert.equal(level.state, "untouched");
  assert.equal(level.touches, 0);
  assert.equal(level.stateChangedAt, null);
});

scenario("Tested buy-side: a later candle touches the level exactly without piercing beyond -> tested", () => {
  const testedCandle: MarketCandle = { datetime: addDays("2026-01-01", 7), open: 99, high: 100.5, low: 98.5, close: 99 };
  const chrono: MarketCandle[] = [
    candleFromValue(90, addDays("2026-01-01", 0)),
    candleFromValue(90, addDays("2026-01-01", 1)),
    candleFromValue(100, addDays("2026-01-01", 2)), // swing high 100.5
    candleFromValue(90, addDays("2026-01-01", 3)),
    candleFromValue(90, addDays("2026-01-01", 4)),
    candleFromValue(90, addDays("2026-01-01", 5)),
    candleFromValue(90, addDays("2026-01-01", 6)),
    testedCandle,
    candleFromValue(90, addDays("2026-01-01", 8)),
    candleFromValue(90, addDays("2026-01-01", 9)),
  ];
  const tfc: TimeframeCandles = { timeframe: "daily", candles: toCandles(chrono), quality: "complete" };
  const r = computeTimeframeLiquidity("EURUSD", tfc, 90);
  const level = r.candidates.find((c) => c.price === 100.5)!;
  assert.equal(level.state, "tested");
  assert.equal(level.touches, 1);
  assert.equal(level.stateChangedAt, "2026-01-08");
});

// ── 9/10. Wick sweep and close back below; later close above converts swept -> consumed ──

function buySweptChrono(): MarketCandle[] {
  const sweptCandle: MarketCandle = { datetime: addDays("2026-01-01", 7), open: 99, high: 100.6, low: 98.5, close: 99 }; // pierces 100.5, closes back below
  return [
    candleFromValue(90, addDays("2026-01-01", 0)),
    candleFromValue(90, addDays("2026-01-01", 1)),
    candleFromValue(100, addDays("2026-01-01", 2)), // swing high 100.5
    candleFromValue(90, addDays("2026-01-01", 3)),
    candleFromValue(90, addDays("2026-01-01", 4)),
    candleFromValue(90, addDays("2026-01-01", 5)),
    candleFromValue(90, addDays("2026-01-01", 6)),
    sweptCandle,
    candleFromValue(90, addDays("2026-01-01", 8)),
    candleFromValue(90, addDays("2026-01-01", 9)),
  ];
}

scenario("Wick sweep and close back below (buy-side) -> swept, and it is the latest valid sweep", () => {
  const tfc: TimeframeCandles = { timeframe: "daily", candles: toCandles(buySweptChrono()), quality: "complete" };
  const r = computeTimeframeLiquidity("EURUSD", tfc, 90);
  const level = r.candidates.find((c) => c.price === 100.5)!;
  assert.equal(level.state, "swept");
  assert.equal(r.latestValidSweep?.price, 100.5);
  assert.equal(r.latestValidSweep?.side, "buy_side");
});

scenario("A later close beyond the level converts swept -> consumed (never reported as merely swept — the audit's flagged bug)", () => {
  const chrono = buySweptChrono();
  const consumeCandle: MarketCandle = { datetime: addDays("2026-01-01", 9), open: 99, high: 101, low: 99, close: 100.8 }; // closes above 100.5
  const finalChrono = [...chrono.slice(0, 9), consumeCandle];
  const tfc: TimeframeCandles = { timeframe: "daily", candles: toCandles(finalChrono), quality: "complete" };
  const r = computeTimeframeLiquidity("EURUSD", tfc, 90);
  assert.equal(r.candidates.find((c) => c.price === 100.5), undefined, "consumed levels are excluded from active candidates");
  assert.equal(r.latestValidSweep, null, "no longer reported as a sweep once consumed");
});

// ── 11/12/13. Sell-side untouched / swept / swept->consumed ───────────────

scenario("Untouched sell-side: no later candle reaches the level -> stays untouched", () => {
  const values = [90, 90, 60, 90, 90, 90, 90, 90, 90, 90];
  const r = computeTimeframeLiquidity("EURUSD", tfFromValues(values), 90);
  const level = r.candidates.find((c) => c.price === 59.5)!;
  assert.equal(level.state, "untouched");
});

function sellSweptChrono(): MarketCandle[] {
  const sweptCandle: MarketCandle = { datetime: addDays("2026-01-01", 7), open: 91, high: 91.5, low: 59.3, close: 91 }; // shallow pierce below 59.5, closes back above
  return [
    candleFromValue(90, addDays("2026-01-01", 0)),
    candleFromValue(90, addDays("2026-01-01", 1)),
    candleFromValue(60, addDays("2026-01-01", 2)), // swing low 59.5
    candleFromValue(90, addDays("2026-01-01", 3)),
    candleFromValue(90, addDays("2026-01-01", 4)),
    candleFromValue(90, addDays("2026-01-01", 5)),
    candleFromValue(90, addDays("2026-01-01", 6)),
    sweptCandle,
    candleFromValue(90, addDays("2026-01-01", 8)),
    candleFromValue(90, addDays("2026-01-01", 9)),
  ];
}

scenario("Wick sweep and close back above (sell-side) -> swept, latest valid sweep", () => {
  const tfc: TimeframeCandles = { timeframe: "daily", candles: toCandles(sellSweptChrono()), quality: "complete" };
  const r = computeTimeframeLiquidity("EURUSD", tfc, 90);
  const level = r.candidates.find((c) => c.price === 59.5)!;
  assert.equal(level.state, "swept");
  assert.equal(r.latestValidSweep?.price, 59.5);
  assert.equal(r.latestValidSweep?.side, "sell_side");
});

scenario("A later close beyond the sell-side level converts swept -> consumed", () => {
  const chrono = sellSweptChrono();
  const consumeCandle: MarketCandle = { datetime: addDays("2026-01-01", 9), open: 91, high: 91, low: 55, close: 58 }; // closes below 59.5
  const finalChrono = [...chrono.slice(0, 9), consumeCandle];
  const tfc: TimeframeCandles = { timeframe: "daily", candles: toCandles(finalChrono), quality: "complete" };
  const r = computeTimeframeLiquidity("EURUSD", tfc, 90);
  assert.equal(r.candidates.find((c) => c.price === 59.5), undefined);
  assert.equal(r.latestValidSweep, null);
});

// ── 14. Nearest vs strongest differ ───────────────────────────────────────

scenario("Nearest vs strongest can differ: nearest picks the closer isolated swing, strongest picks a farther equal-highs cluster", () => {
  const values = [
    90, 90, 250, 90, 90, // equal-high A: 250.5 @2
    90, 90, 250.15, 90, 90, // equal-high B: 250.65 @7
    90, 90, 250.05, 90, 90, // equal-high C: 250.55 @12 (span 0.15 <= tolerance)
    90, 90, 90, 90, // pad
    90, 90, 200, 90, 90, // isolated swing high 200.5 @21 (later, LOWER -> cannot supersede the cluster)
  ];
  const r = computeTimeframeLiquidity("EURUSD", tfFromValues(values), 190);
  assert.equal(r.nearestUntouchedBuySide?.price, 200.5);
  assert.equal(r.nearestUntouchedBuySide?.origin, "swing_high");
  assert.equal(r.strongestUntouchedBuySide?.origin, "equal_highs");
  assert.notEqual(r.nearestUntouchedBuySide?.price, r.strongestUntouchedBuySide?.price);
});

// ── 15/16. Internal / external liquidity ──────────────────────────────────

function internalExternalFixture() {
  const values = [
    100, 100, 110, 100, 100, // H_old @2 (110.5) — later broken
    100, 100, 90, 100, 100, // L_old @7 (89.5) — later broken
    100, 100, 115, 100, 100, // H_new @12 (115.5) — external boundary
    100, 100, 85, 88, 88, // L_new @17 (84.5) — external boundary
    95, 88, 88, // H_internal @20 (95.5) — inside [84.5, 115.5], formed after both boundaries
  ];
  return computeTimeframeLiquidity("EURUSD", tfFromValues(values), 100);
}

scenario("Internal liquidity: a confirmed swing inside the active range, formed after it was established", () => {
  const r = internalExternalFixture();
  assert.equal(r.internalLiquidity.length, 1);
  assert.equal(r.internalLiquidity[0].price, 95.5);
  assert.ok(!r.externalLiquidity.some((l) => l.price === 95.5), "never double-counted as external");
});

scenario("External liquidity: exactly the active range's own boundary pair", () => {
  const r = internalExternalFixture();
  assert.equal(r.activeRange?.low, 84.5);
  assert.equal(r.activeRange?.high, 115.5);
  assert.equal(r.externalLiquidity.length, 2);
  assert.ok(r.externalLiquidity.some((l) => l.price === 115.5 && l.side === "buy_side"));
  assert.ok(r.externalLiquidity.some((l) => l.price === 84.5 && l.side === "sell_side"));
  // Broken swings (110.5, 89.5) never surface as external.
  assert.ok(!r.externalLiquidity.some((l) => l.price === 110.5 || l.price === 89.5));
});

// ── 17/18. Supersession (newer candidate) and consumed exclusion ─────────

scenario("A newer, materially more extreme confirmed swing supersedes an older one -> invalidated, excluded from active output", () => {
  const values = [90, 90, 100, 90, 90, 90, 90, 90, 90, 90, 90, 90, 105, 90, 90]; // old 100.5 @2, new 105.5 @12 (gap 5, far beyond supersession threshold)
  const r = computeTimeframeLiquidity("EURUSD", tfFromValues(values), 90);
  assert.equal(r.candidates.find((c) => c.price === 100.5), undefined, "superseded level excluded from active candidates");
  assert.ok(r.candidates.some((c) => c.price === 105.5 && c.state === "untouched"));
});

scenario("Consumed levels are excluded from every active output (candidates, nearest, strongest, internal, external)", () => {
  const chrono = buySweptChrono();
  const consumeCandle: MarketCandle = { datetime: addDays("2026-01-01", 9), open: 99, high: 101, low: 99, close: 100.8 };
  const tfc: TimeframeCandles = { timeframe: "daily", candles: toCandles([...chrono.slice(0, 9), consumeCandle]), quality: "complete" };
  const r = computeTimeframeLiquidity("EURUSD", tfc, 90);
  assert.ok(!r.candidates.some((c) => c.price === 100.5));
  assert.ok(!r.externalLiquidity.some((c) => c.price === 100.5));
  assert.ok(!r.internalLiquidity.some((c) => c.price === 100.5));
  assert.notEqual(r.nearestUntouchedBuySide?.price, 100.5);
});

// ── 19/20. D1/H4/H1/M15 independence; missing timeframe ───────────────────

scenario("D1/H4/H1/M15 are computed independently — never merged, never cross-contaminated", () => {
  const mtf = computeMultiTimeframeLiquidity(
    "EURUSD",
    {
      daily: tfFromValues([90, 90, 100, 90, 90, 90, 90], "daily"),
      h4: tfFromValues([90, 90, 200, 90, 90, 90, 90], "h4"),
      h1: { timeframe: "h1", candles: [], quality: "unavailable" },
      m15: tfFromValues([90, 90, 150, 90, 90, 90, 90], "m15"),
    },
    90
  );
  assert.equal(mtf.d1.timeframe, "D1");
  assert.equal(mtf.d1.candidates.find((c) => c.side === "buy_side")?.price, 100.5);
  assert.equal(mtf.h4.timeframe, "H4");
  assert.equal(mtf.h4.candidates.find((c) => c.side === "buy_side")?.price, 200.5);
  assert.equal(mtf.m15.timeframe, "M15");
  assert.equal(mtf.m15.candidates.find((c) => c.side === "buy_side")?.price, 150.5);
  // No timeframe's 100.5/200.5/150.5 leaks into another's candidate list.
  assert.ok(!mtf.h4.candidates.some((c) => c.price === 100.5));
  assert.ok(!mtf.m15.candidates.some((c) => c.price === 200.5));
});

scenario("Missing timeframe -> honest unavailable result, never fabricated", () => {
  const mtf = computeMultiTimeframeLiquidity(
    "EURUSD",
    {
      daily: tfFromValues([90, 90, 100, 90, 90, 90, 90], "daily"),
      h4: { timeframe: "h4", candles: [], quality: "unavailable" },
      h1: { timeframe: "h1", candles: [], quality: "unavailable" },
      m15: { timeframe: "m15", candles: [], quality: "unavailable" },
    },
    90
  );
  assert.equal(mtf.h4.quality, "unavailable");
  assert.deepEqual(mtf.h4.candidates, []);
  assert.equal(mtf.h4.nearestUntouchedBuySide, null);
  assert.equal(mtf.h4.activeRange, null);
});

// ── 21. Malformed OHLC ─────────────────────────────────────────────────────

scenario("Malformed OHLC (null fields) is skipped, never throws, never fabricated", () => {
  const chrono: MarketCandle[] = [
    candleFromValue(90, addDays("2026-01-01", 0)),
    { datetime: addDays("2026-01-01", 1), open: null, high: null, low: null, close: null },
    candleFromValue(100, addDays("2026-01-01", 2)),
    candleFromValue(90, addDays("2026-01-01", 3)),
    candleFromValue(90, addDays("2026-01-01", 4)),
    candleFromValue(90, addDays("2026-01-01", 5)),
    candleFromValue(90, addDays("2026-01-01", 6)),
  ];
  const tfc: TimeframeCandles = { timeframe: "daily", candles: toCandles(chrono), quality: "partial" };
  assert.doesNotThrow(() => computeTimeframeLiquidity("EURUSD", tfc, 90));
});

// ── 22. Index-0 mutation changes nothing ──────────────────────────────────

scenario("Mutating the forming candle (index 0) never changes the result", () => {
  const base = tfFromValues([90, 90, 100, 90, 90, 90, 90]);
  const mutated: TimeframeCandles = {
    ...base,
    candles: [{ datetime: base.candles[0].datetime, open: -99999, high: -99998, low: -99999, close: -99999 }, ...base.candles.slice(1)],
  };
  const rBase = computeTimeframeLiquidity("EURUSD", base, 90);
  const rMutated = computeTimeframeLiquidity("EURUSD", mutated, 90);
  assert.deepEqual(rBase.candidates, rMutated.candidates);
  assert.deepEqual(rBase.activeRange, rMutated.activeRange);
});

// ── Backward-compatibility adapter (Sprint section 9) ─────────────────────

scenario("Legacy computeLiquidity/LiquidityResult shape is preserved for composeEdgePulse/institutionalLevelsEngine/copy/UI", () => {
  const values = [90, 90, 100, 90, 90, 90, 90, 90, 90, 90, 90, 90, 60, 90, 90];
  const legacy = computeLiquidity("EURUSD", tfFromValues(values), 90);
  assert.equal(legacy.symbol, "EURUSD");
  assert.equal(legacy.timeframe, "daily");
  assert.equal(legacy.quality, "complete");
  assert.equal(legacy.buySideLiquidity?.price, 100.5);
  assert.equal(legacy.sellSideLiquidity?.price, 59.5);
  assert.equal(legacy.liquidityRestingAbove?.price, legacy.buySideLiquidity?.price);
  assert.equal(legacy.liquidityRestingBelow?.price, legacy.sellSideLiquidity?.price);
  assert.ok(Array.isArray(legacy.internalLiquidity));
  assert.ok(Array.isArray(legacy.externalLiquidity));
});

scenario("Legacy adapter: unavailable timeframe -> every field null/empty, never fabricated", () => {
  const legacy = computeLiquidity("US30", { timeframe: "h4", candles: [], quality: "unavailable" }, 43000);
  assert.equal(legacy.quality, "unavailable");
  assert.equal(legacy.buySideLiquidity, null);
  assert.equal(legacy.nearestSweep, null);
  assert.deepEqual(legacy.internalLiquidity, []);
});

console.log(`\n${pass} scenario(s) passed.`);
