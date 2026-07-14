import assert from "node:assert/strict";
import { computeLiquidity } from "../src/lib/edge-pulse/engines/liquidityEngine";
import { MarketCandle } from "../src/lib/market/types";
import { TimeframeCandles } from "../src/lib/edge-pulse/types";

// ============================================================
// Edge Pulse — Liquidity Engine deterministic scenarios
// ============================================================
// No network. Every fixture is hand-built (candle-by-candle) and its
// resulting swing/unbroken/cluster/sweep facts were independently verified
// against the pure engine before being hardcoded here as assertions — same
// discipline as scripts/market-regime-scenarios.ts.
// Run: npx tsx scripts/liquidity-engine-scenarios.ts

let pass = 0;
function scenario(name: string, fn: () => void) {
  fn();
  pass++;
  console.log(`  ok — ${name}`);
}

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
function tfFromValues(values: number[]): TimeframeCandles {
  const chrono = values.map((v, i) => candleFromValue(v, addDays("2026-01-01", i)));
  return { timeframe: "daily", candles: toCandles(chrono), quality: "complete" };
}

scenario("Broken swings excluded; unbroken pair brackets price; minor pivot inside range reports as internal liquidity", () => {
  const values = [
    100, 100, 110, 100, 100, // H_old @2 (110.5) — later broken by H_new's close
    100, 100, 90, 100, 100, // L_old @7 (89.5) — later broken by L_new's close
    100, 100, 115, 100, 100, // H_new @12 (115.5) — stays unbroken
    100, 100, 85, 88, 88, // L_new @17 (84.5) — stays unbroken
    95, 88, 88, // H_internal @20 (95.5) — unbroken, inside [84.5, 115.5], formed after the range
  ];
  const result = computeLiquidity("EURUSD", tfFromValues(values), 100);
  assert.equal(result.buySideLiquidity?.price, 115.5);
  assert.equal(result.sellSideLiquidity?.price, 84.5);
  assert.equal(result.liquidityRestingAbove?.price, result.buySideLiquidity?.price);
  assert.equal(result.liquidityRestingBelow?.price, result.sellSideLiquidity?.price);
  assert.equal(result.externalLiquidity.length, 2);
  assert.equal(result.internalLiquidity.length, 1);
  assert.equal(result.internalLiquidity[0].price, 95.5);
  // Broken swings (110.5, 89.5) never surface as either the boundary or internal liquidity.
  assert.ok(!result.externalLiquidity.some((l) => l.price === 110.5 || l.price === 89.5));
  assert.ok(!result.internalLiquidity.some((l) => l.price === 110.5 || l.price === 89.5));
});

scenario("Two unbroken swing highs/lows within tolerance -> Equal Highs / Equal Lows clusters", () => {
  const values = [100, 100, 110, 100, 100, 100, 100, 90, 100, 100, 100, 100, 110.2, 100, 100, 100, 100, 89.8, 100, 100];
  const result = computeLiquidity("EURUSD", tfFromValues(values), 100);
  assert.ok(result.equalHighs, "equal highs cluster found");
  assert.equal(result.equalHighs?.count, 2);
  assert.equal(result.equalHighs?.price, 110.6);
  assert.ok(result.equalLows, "equal lows cluster found");
  assert.equal(result.equalLows?.count, 2);
  assert.equal(result.equalLows?.price, 89.4);
});

scenario("Wick pierces a confirmed swing high but closes back below it -> nearest sweep reported", () => {
  const start = "2026-01-01";
  const chrono: MarketCandle[] = [
    candleFromValue(100, addDays(start, 0)),
    candleFromValue(100, addDays(start, 1)),
    candleFromValue(110, addDays(start, 2)), // H1, high=110.5
    candleFromValue(100, addDays(start, 3)),
    candleFromValue(100, addDays(start, 4)),
    candleFromValue(100, addDays(start, 5)),
    candleFromValue(100, addDays(start, 6)),
    candleFromValue(90, addDays(start, 7)), // L1
    candleFromValue(100, addDays(start, 8)),
    candleFromValue(100, addDays(start, 9)),
    { datetime: addDays(start, 10), open: 105, high: 112, low: 104, close: 108 }, // pierces 110.5, closes back at 108
    candleFromValue(100, addDays(start, 11)),
    candleFromValue(100, addDays(start, 12)),
    candleFromValue(100, addDays(start, 13)),
    candleFromValue(100, addDays(start, 14)),
  ];
  const tfc: TimeframeCandles = { timeframe: "daily", candles: toCandles(chrono), quality: "complete" };
  const result = computeLiquidity("EURUSD", tfc, 100);
  assert.ok(result.nearestSweep, "a sweep was found");
  assert.equal(result.nearestSweep?.side, "high");
  assert.equal(result.nearestSweep?.sweptPrice, 110.5);
});

scenario("Unavailable timeframe (empty candles) -> every field null/empty, never fabricated", () => {
  const tfc: TimeframeCandles = { timeframe: "h4", candles: [], quality: "unavailable" };
  const result = computeLiquidity("US30", tfc, 43000);
  assert.equal(result.quality, "unavailable");
  assert.equal(result.buySideLiquidity, null);
  assert.equal(result.nearestSweep, null);
  assert.deepEqual(result.internalLiquidity, []);
});

scenario("currentPrice null -> unavailable, never computed off a missing live price", () => {
  const result = computeLiquidity("EURUSD", tfFromValues([100, 100, 110, 100, 100, 100, 100]), null);
  assert.equal(result.quality, "unavailable");
});

console.log(`\n${pass} scenario(s) passed.`);
