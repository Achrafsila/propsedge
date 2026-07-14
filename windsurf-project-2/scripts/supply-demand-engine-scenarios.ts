import assert from "node:assert/strict";
import { computeSupplyDemand } from "../src/lib/edge-pulse/engines/supplyDemandEngine";
import { MarketCandle } from "../src/lib/market/types";
import { TimeframeCandles } from "../src/lib/edge-pulse/types";

// ============================================================
// Edge Pulse — Supply & Demand Engine deterministic scenarios
// ============================================================
// No network. Every fixture's expected zone/state was independently
// verified against the pure engine before being hardcoded here — same
// discipline as scripts/market-regime-scenarios.ts. Baseline/recentPrior
// segments use a flat range=2 shape (12 + 6 candles, matching
// marketPhase.ts's BASELINE_WINDOW/RECENT_WINDOW) so the 1.5x expansion
// threshold and "prior structure high/low" are easy to reason about.
// Run: npx tsx scripts/supply-demand-engine-scenarios.ts

let pass = 0;
function scenario(name: string, fn: () => void) {
  fn();
  pass++;
  console.log(`  ok — ${name}`);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function c(i: number, open: number, high: number, low: number, close: number): MarketCandle {
  return { datetime: addDays("2026-01-01", i), open, high, low, close };
}
function toCandles(chrono: MarketCandle[]): MarketCandle[] {
  const lastDate = chrono[chrono.length - 1].datetime;
  const forming: MarketCandle = { datetime: addDays(lastDate, 1), open: 9999, high: 10000, low: 9998, close: 9999 };
  return [forming, ...chrono.slice().reverse()];
}

// 12 baseline (range=2) + 6 recentPrior (range=2, structural high=101/low=99)
// + an origin down-close candle (range=2.6, below the 1.5x/2=3 threshold so
// it never self-triggers as its own break) + a breakout candle (range=9,
// closes at 105 > structural high 101).
function baseChrono(): MarketCandle[] {
  return [
    ...Array.from({ length: 12 }, (_, i) => c(i, 100, 101, 99, 100)),
    ...Array.from({ length: 6 }, (_, i) => c(12 + i, 100, 101, 99, 100)),
    c(18, 100, 100.3, 97.7, 98), // origin, down-close
    c(19, 98, 106, 97, 105), // breakout, confirms the demand zone [97.7, 100.3]
  ];
}

scenario("Impulsive bullish break -> Demand zone at the origin candle's [low, high], Fresh (untouched since confirmation)", () => {
  const tfc: TimeframeCandles = { timeframe: "daily", candles: toCandles(baseChrono()), quality: "complete" };
  const result = computeSupplyDemand("EURUSD", tfc, 105);
  assert.equal(result.nearestSupply, null);
  assert.ok(result.nearestDemand);
  assert.equal(result.nearestDemand?.low, 97.7);
  assert.equal(result.nearestDemand?.high, 100.3);
  assert.equal(result.nearestDemand?.state, "fresh");
  assert.equal(result.nearestDemand?.distance, 4.7); // 105 - 100.3
});

scenario("A later candle's wick touches the zone but closes outside it -> Tested", () => {
  const chrono = [...baseChrono(), c(20, 105, 106, 104, 105), c(21, 105, 106, 104, 105), c(22, 105, 105.5, 99, 104)];
  const tfc: TimeframeCandles = { timeframe: "daily", candles: toCandles(chrono), quality: "complete" };
  const result = computeSupplyDemand("EURUSD", tfc, 104);
  assert.equal(result.nearestDemand?.state, "tested");
});

scenario("A later candle's CLOSE lands inside the zone -> Mitigated, distance 0 (price trading inside)", () => {
  const chrono = [...baseChrono(), c(20, 105, 106, 104, 105), c(21, 105, 106, 104, 105), c(22, 105, 105.5, 98.5, 99)];
  const tfc: TimeframeCandles = { timeframe: "daily", candles: toCandles(chrono), quality: "complete" };
  const result = computeSupplyDemand("EURUSD", tfc, 99);
  assert.equal(result.nearestDemand?.state, "mitigated");
  assert.equal(result.nearestDemand?.distance, 0);
});

scenario("A later candle CLOSES beyond the zone's far boundary -> Broken, permanently excluded from selection", () => {
  const chrono = [...baseChrono(), c(20, 105, 106, 104, 105), c(21, 105, 106, 104, 105), c(22, 100, 100.5, 95, 96)];
  const tfc: TimeframeCandles = { timeframe: "daily", candles: toCandles(chrono), quality: "complete" };
  const result = computeSupplyDemand("EURUSD", tfc, 96);
  assert.equal(result.nearestDemand, null);
});

scenario("Never more than one zone per side — the nearest-to-price unbroken zone wins", () => {
  // Two independent bullish breaks -> two demand zones; price sits closer
  // to the second (more recent) one.
  const secondLegBaseline = Array.from({ length: 12 }, (_, i) => c(30 + i, 110, 111, 109, 110));
  const secondLegRecent = Array.from({ length: 6 }, (_, i) => c(42 + i, 110, 111, 109, 110));
  const chrono = [
    ...baseChrono(),
    c(20, 105, 106, 104, 105),
    c(21, 105, 106, 104, 105),
    ...Array.from({ length: 8 }, (_, i) => c(22 + i, 108, 109, 107, 108)), // bridge candles, keep range small
    ...secondLegBaseline,
    ...secondLegRecent,
    c(48, 110, 110.4, 108.6, 109), // second origin, down-close, range 1.8 (< 3 threshold)
    c(49, 109, 118, 108, 116), // second breakout, range 10, closes above structural high 111
  ];
  const tfc: TimeframeCandles = { timeframe: "daily", candles: toCandles(chrono), quality: "complete" };
  const result = computeSupplyDemand("EURUSD", tfc, 116);
  assert.ok(result.nearestDemand, "a demand zone was found");
  // Nearest to currentPrice=116 is the second zone [108.6, 110.4], not the first [97.7, 100.3].
  assert.equal(result.nearestDemand?.low, 108.6);
  assert.equal(result.nearestDemand?.high, 110.4);
});

scenario("Fewer than 18 completed candles -> unavailable, never fabricated", () => {
  const chrono = Array.from({ length: 10 }, (_, i) => c(i, 100, 101, 99, 100));
  const tfc: TimeframeCandles = { timeframe: "m15", candles: toCandles(chrono), quality: "complete" };
  const result = computeSupplyDemand("EURUSD", tfc, 100);
  assert.equal(result.quality, "unavailable");
  assert.equal(result.nearestDemand, null);
  assert.equal(result.nearestSupply, null);
});

scenario("Unavailable timeframe (e.g. US30's M15) -> unavailable, never fabricated", () => {
  const tfc: TimeframeCandles = { timeframe: "m15", candles: [], quality: "unavailable" };
  const result = computeSupplyDemand("US30", tfc, 43000);
  assert.equal(result.quality, "unavailable");
});

console.log(`\n${pass} scenario(s) passed.`);
