import assert from "node:assert/strict";
import { computeStructuralEvents } from "../src/lib/edge-pulse/engines/structuralEventEngine";
import { detectSwings, isCompleteCandle } from "../src/lib/market/engines/swingDetection";
import { MarketCandle } from "../src/lib/market/types";

// ============================================================
// Structural Event Engine deterministic scenarios (Sprint 2 / Phase 2)
// ============================================================
// No network. Every fixture's expected event/status was independently
// verified against the pure engine before being hardcoded here.
// Run: npx tsx scripts/structural-event-engine-scenarios.ts

let pass = 0;
function scenario(name: string, fn: () => void) {
  fn();
  pass++;
  console.log(`  ok — ${name}`);
}

function candleFromValue(v: number, datetime: string): MarketCandle {
  return { datetime, open: v, high: v + 0.5, low: v - 0.5, close: v };
}
function candle(datetime: string, open: number, high: number, low: number, close: number): MarketCandle {
  return { datetime, open, high, low, close };
}
function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function run(chrono: MarketCandle[]) {
  const completed = chrono.filter(isCompleteCandle);
  const swings = detectSwings(completed);
  return computeStructuralEvents(completed, swings.filter((s) => s.type === "high"), swings.filter((s) => s.type === "low"));
}

const UPTREND_VALUES = [90, 95, 100, 92, 88, 96, 104, 112, 102, 94, 106, 116, 126, 112, 98, 110, 124, 138, 148];

scenario("Confirmed close beyond the prior swing high, WITH an established bullish sequence -> BOS bullish, no CHoCH", () => {
  const chrono = [
    ...UPTREND_VALUES.map((v, i) => candleFromValue(v, addDays("2026-01-01", i))),
    candle(addDays("2026-01-01", UPTREND_VALUES.length), 148, 160, 147, 158),
  ];
  const result = run(chrono);
  assert.ok(result.lastBOS);
  assert.equal(result.lastBOS?.direction, "bullish");
  assert.equal(result.lastBOS?.status, "confirmed");
  assert.equal(result.lastCHoCH, null);
});

scenario("Confirmed close BELOW the prior swing low, WITH an established bullish sequence -> CHoCH bearish (reversal warning), not BOS", () => {
  const chrono = [
    ...UPTREND_VALUES.map((v, i) => candleFromValue(v, addDays("2026-01-01", i))),
    candle(addDays("2026-01-01", UPTREND_VALUES.length), 98, 100, 80, 82),
    candleFromValue(80, addDays("2026-01-01", UPTREND_VALUES.length + 1)),
    candleFromValue(80, addDays("2026-01-01", UPTREND_VALUES.length + 2)),
  ];
  const result = run(chrono);
  assert.ok(result.lastCHoCH);
  assert.equal(result.lastCHoCH?.direction, "bearish");
  assert.equal(result.lastBOS, null);
});

scenario("A confirmed CHoCH that reverses back through the level within the confirmation window -> retroactively relabelled False Break, no longer the reported lastCHoCH", () => {
  const chrono = [
    ...UPTREND_VALUES.map((v, i) => candleFromValue(v, addDays("2026-01-01", i))),
    candle(addDays("2026-01-01", UPTREND_VALUES.length), 98, 100, 80, 82), // CHoCH candle
    candleFromValue(85, addDays("2026-01-01", UPTREND_VALUES.length + 1)),
    candle(addDays("2026-01-01", UPTREND_VALUES.length + 2), 85, 100, 84, 98), // closes back above the broken level
  ];
  const result = run(chrono);
  assert.equal(result.lastCHoCH, null);
  const falseBreaks = result.events.filter((e) => e.status === "false_break");
  assert.ok(falseBreaks.length > 0, "at least one event was relabelled false_break");
});

scenario("Failed break: single-candle wick pierce, close back on origin side -> lastFailedBreak, no BOS/CHoCH", () => {
  const chrono: MarketCandle[] = [
    candleFromValue(90, addDays("2026-01-01", 0)),
    candleFromValue(90, addDays("2026-01-01", 1)),
    candleFromValue(100, addDays("2026-01-01", 2)),
    candleFromValue(90, addDays("2026-01-01", 3)),
    candleFromValue(90, addDays("2026-01-01", 4)),
    candleFromValue(90, addDays("2026-01-01", 5)),
    candleFromValue(90, addDays("2026-01-01", 6)),
    candle(addDays("2026-01-01", 7), 95, 112, 94, 98),
  ];
  const result = run(chrono);
  assert.ok(result.lastFailedBreak);
  assert.equal(result.lastFailedBreak?.direction, "bullish");
  assert.equal(result.lastFailedBreak?.price, 100.5);
});

scenario("A break of a range/mixed structure's boundary is neither BOS nor CHoCH (no established bull/bear sequence context)", () => {
  // Equal highs/equal lows (range sequence), then a break beyond the boundary.
  const values = [100, 104, 108, 112, 108, 104, 100, 104, 108, 112, 108, 104, 100, 104, 108, 130];
  const chrono = values.map((v, i) => candleFromValue(v, addDays("2026-01-01", i)));
  const result = run(chrono);
  assert.equal(result.lastBOS, null);
  assert.equal(result.lastCHoCH, null);
});

scenario("Each swing level is only broken ONCE — staying beyond an already-broken level never produces duplicate events", () => {
  const chrono = [
    ...UPTREND_VALUES.map((v, i) => candleFromValue(v, addDays("2026-01-01", i))),
    candle(addDays("2026-01-01", UPTREND_VALUES.length), 148, 160, 147, 158),
    candleFromValue(159, addDays("2026-01-01", UPTREND_VALUES.length + 1)),
    candleFromValue(160, addDays("2026-01-01", UPTREND_VALUES.length + 2)),
    candleFromValue(161, addDays("2026-01-01", UPTREND_VALUES.length + 3)),
  ];
  const result = run(chrono);
  const bosEvents = result.events.filter((e) => e.type === "BOS" && e.price === result.lastBOS?.price);
  assert.equal(bosEvents.length, 1, "the same broken swing level never produces more than one event");
});

console.log(`\n${pass} scenario(s) passed.`);
