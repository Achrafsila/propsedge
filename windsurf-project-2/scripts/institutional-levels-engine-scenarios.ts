import assert from "node:assert/strict";
import { computeInstitutionalLevels } from "../src/lib/edge-pulse/engines/institutionalLevelsEngine";
import { KeyLevels, MarketCandle } from "../src/lib/market/types";
import { LiquidityResult } from "../src/lib/edge-pulse/engines/liquidityEngine";

// ============================================================
// Edge Pulse — Institutional Levels Engine deterministic scenarios
// ============================================================
// No network. Run: npx tsx scripts/institutional-levels-engine-scenarios.ts

let pass = 0;
function scenario(name: string, fn: () => void) {
  fn();
  pass++;
  console.log(`  ok — ${name}`);
}

function candle(datetime: string, open: number | null): MarketCandle {
  return { datetime, open, high: open, low: open, close: open };
}

const FULL_KEY_LEVELS: KeyLevels = {
  dailyOpen: 4020,
  previousDayHigh: 4035,
  previousDayLow: 4010,
  previousDayClose: 4018,
  weeklyOpen: 3990,
  previousWeekHigh: 4050,
  previousWeekLow: 3970,
};

function liquidityWith(buyPrice: number | null, sellPrice: number | null): LiquidityResult {
  const toLvl = (p: number) => ({ price: p, distance: 0, distancePercent: 0 });
  return {
    symbol: "XAUUSD",
    timeframe: "daily",
    quality: "complete",
    buySideLiquidity: buyPrice !== null ? toLvl(buyPrice) : null,
    sellSideLiquidity: sellPrice !== null ? toLvl(sellPrice) : null,
    liquidityRestingAbove: buyPrice !== null ? toLvl(buyPrice) : null,
    liquidityRestingBelow: sellPrice !== null ? toLvl(sellPrice) : null,
    equalHighs: null,
    equalLows: null,
    internalLiquidity: [],
    externalLiquidity: [],
    nearestSweep: null,
  };
}

scenario("Full KeyLevels + monthly open + swing levels + step table -> merged and sorted nearest-first", () => {
  // Forming candle "today" = 2026-07-14; one candle on 2026-07-01 (first
  // trading day of July) with open=4007 -> Monthly Open.
  const dailyCandles: MarketCandle[] = [
    candle("2026-07-14", 4020), // forming
    candle("2026-07-10", 4015),
    candle("2026-07-03", 4009),
    candle("2026-07-01", 4007), // oldest in-month -> Monthly Open
    candle("2026-06-30", 4200), // previous month, excluded
  ];
  const liquidity = liquidityWith(4034, 4011); // Nearest Swing High/Low
  const result = computeInstitutionalLevels("XAUUSD", 4020, FULL_KEY_LEVELS, dailyCandles, liquidity);

  const byLabel = (label: string) => result.levels.filter((l) => l.label === label);
  assert.equal(byLabel("Daily Open")[0].price, 4020);
  assert.equal(byLabel("Weekly Open")[0].price, 3990);
  assert.equal(byLabel("Monthly Open")[0].price, 4007);
  assert.equal(byLabel("Prev Day High")[0].price, 4035);
  assert.equal(byLabel("Prev Week Low")[0].price, 3970);
  assert.equal(byLabel("Nearest Swing High")[0].price, 4034);
  assert.equal(byLabel("Nearest Swing Low")[0].price, 4011);
  assert.equal(byLabel("Major Psychological Level").length, 2); // 4000 and 4100 (step 100)
  assert.equal(byLabel("Half Level").length, 2); // 4000 and 4050 (step 50)
  assert.equal(byLabel("Round Number").length, 2); // 4020 and 4010... actually step 10 -> 4020,4030

  // Sorted nearest-first: Daily Open (distance 0) must come before anything farther.
  assert.equal(result.levels[0].label, "Daily Open");
  assert.ok(result.levels[0].distance === 0);
  for (let i = 1; i < result.levels.length; i++) {
    assert.ok(Math.abs(result.levels[i - 1].distance) <= Math.abs(result.levels[i].distance), "levels are proximity-sorted");
  }
});

scenario("No KeyLevels available -> only monthly/swing/step levels present, never fabricated", () => {
  const dailyCandles: MarketCandle[] = [candle("2026-07-14", 4020), candle("2026-07-01", 4007)];
  const result = computeInstitutionalLevels("XAUUSD", 4020, null, dailyCandles, liquidityWith(4034, 4011));
  assert.ok(!result.levels.some((l) => l.label === "Daily Open"));
  assert.ok(result.levels.some((l) => l.label === "Monthly Open"));
  assert.ok(result.levels.some((l) => l.label === "Nearest Swing High"));
});

scenario("Forming candle's own open is malformed and no other candle falls in the current month -> Monthly Open omitted, never fabricated", () => {
  const dailyCandles: MarketCandle[] = [candle("2026-07-14", null), candle("2026-06-15", 4100), candle("2026-06-01", 4200)];
  const result = computeInstitutionalLevels("XAUUSD", 4020, null, dailyCandles, liquidityWith(null, null));
  assert.ok(!result.levels.some((l) => l.label === "Monthly Open"));
});

scenario("Today IS the first trading day of the month (only the forming candle falls in it) -> its open legitimately IS the Monthly Open", () => {
  const dailyCandles: MarketCandle[] = [candle("2026-08-01", 4300), candle("2026-07-31", 4250), candle("2026-07-01", 4007)];
  const result = computeInstitutionalLevels("XAUUSD", 4300, null, dailyCandles, liquidityWith(null, null));
  const monthlyOpen = result.levels.find((l) => l.label === "Monthly Open");
  assert.equal(monthlyOpen?.price, 4300);
});

scenario("Instrument with no documented step table (e.g. NDX) -> no psychological/half/round levels", () => {
  const dailyCandles: MarketCandle[] = [candle("2026-07-14", 20000)];
  const result = computeInstitutionalLevels("NDX", 20000, FULL_KEY_LEVELS, dailyCandles, liquidityWith(null, null));
  assert.ok(!result.levels.some((l) => l.label === "Major Psychological Level"));
  assert.ok(!result.levels.some((l) => l.label === "Half Level"));
  assert.ok(!result.levels.some((l) => l.label === "Round Number"));
});

scenario("currentPrice null -> empty level list", () => {
  const result = computeInstitutionalLevels("XAUUSD", null, FULL_KEY_LEVELS, [], liquidityWith(null, null));
  assert.deepEqual(result.levels, []);
});

console.log(`\n${pass} scenario(s) passed.`);
