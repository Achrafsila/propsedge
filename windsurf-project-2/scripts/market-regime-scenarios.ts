import assert from "node:assert/strict";
import { computeMarketRegime } from "../src/lib/market/engines/marketRegime";
import { InstrumentMarketHistory, MarketCandle } from "../src/lib/market/types";

// ============================================================
// PropEdge — Market Regime Engine deterministic scenarios
// ============================================================
// No network. Every history fixture is hand-built so the exact swing
// structure is known in advance; we assert the pure engine produces the
// documented regime/confidence/evidence for each documented decision rule.
// Run: npx tsx scripts/market-regime-scenarios.ts

let pass = 0;
function scenario(name: string, fn: () => void) {
  fn();
  pass++;
  console.log(`  ok — ${name}`);
}

// ── Fixture helpers ─────────────────────────────────────────────────────
// Every synthetic candle is symmetric around its "value" V: open=close=V,
// high=V+0.5, low=V-0.5. This keeps swing-point math (which reads high/low)
// directly traceable to the V sequence used to design each scenario.

function candleFromValue(v: number, datetime: string): MarketCandle {
  return { datetime, open: v, high: v + 0.5, low: v - 0.5, close: v };
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// values: chronological (oldest first). Returns dailyCandles newest-first
// with a synthetic forming candle prepended at index 0 (must never be
// analysed by the engine — deliberately set to an outlier value so any
// accidental inclusion would change the result and fail the assertions).
function buildDailyCandles(values: number[]): MarketCandle[] {
  const start = "2026-01-01";
  const chrono = values.map((v, i) => candleFromValue(v, addDays(start, i)));
  const lastValue = values[values.length - 1];
  const forming = candleFromValue(lastValue + 999, addDays(chrono[chrono.length - 1].datetime, 1));
  return [forming, ...chrono.slice().reverse()];
}

function historyFromValues(symbol: string, values: number[]): InstrumentMarketHistory {
  const dailyCandles = buildDailyCandles(values);
  return {
    symbol,
    currentPrice: dailyCandles[0].close,
    dailyCandles,
    weeklyCandles: [],
    dataQuality: { dailyHistory: values.length >= 100 ? "complete" : "partial", weeklyHistory: "unavailable" },
  };
}

// ── 1. Strong bullish trend: 3 ascending swing highs, 3 ascending swing lows ──

scenario("Strong bullish trend -> bullish_trend, high confidence", () => {
  const values = [100, 102, 106, 103, 100, 104, 108, 112, 109, 106, 110, 114, 118, 115, 112, 116, 120, 124];
  const result = computeMarketRegime(historyFromValues("EURUSD", values));
  assert.equal(result.regime, "bullish_trend");
  assert.equal(result.confidence, "high");
  assert.ok(result.evidence.some((e) => e.includes("Higher high and higher low")), "evidence explains the HH/HL rule");
  assert.ok(result.evidence.length >= 3, "evidence is non-trivial");
});

// ── 2. Strong bearish trend: mirror of scenario 1 (224 - V reflects max<->min) ──

scenario("Strong bearish trend -> bearish_trend, high confidence", () => {
  const bullish = [100, 102, 106, 103, 100, 104, 108, 112, 109, 106, 110, 114, 118, 115, 112, 116, 120, 124];
  const values = bullish.map((v) => 224 - v);
  const result = computeMarketRegime(historyFromValues("XAUUSD", values));
  assert.equal(result.regime, "bearish_trend");
  assert.equal(result.confidence, "high");
  assert.ok(result.evidence.some((e) => e.includes("Lower high and lower low")), "evidence explains the LH/LL rule");
});

// ── 3. Clean range: 3 equal swing highs, 2 equal swing lows ──

scenario("Clean range -> range, medium confidence", () => {
  const values = [100, 104, 108, 112, 108, 104, 100, 104, 108, 112, 108, 104, 100, 104, 108, 112, 108, 104, 100];
  const result = computeMarketRegime(historyFromValues("EURUSD", values));
  assert.equal(result.regime, "range");
  assert.equal(result.confidence, "medium");
  assert.ok(result.evidence.some((e) => e.includes("Equal swing highs and equal swing lows")), "evidence explains the equal/equal rule");
});

// ── 4. Transition after breakout: prior range, then an unconfirmed breakout on the latest completed candle ──

scenario("Transition after breakout -> transition, low confidence", () => {
  const values = [100, 104, 108, 112, 108, 104, 100, 104, 108, 112, 108, 104, 100, 104, 108, 130];
  const result = computeMarketRegime(historyFromValues("EURUSD", values));
  assert.equal(result.regime, "transition");
  assert.equal(result.confidence, "low");
  assert.ok(
    result.evidence.some((e) => e.includes("broke above the prior swing high") && e.includes("unconfirmed transition")),
    "evidence attributes the transition to the breakout override, not base disagreement"
  );
});

// ── 5. Insufficient candles: fewer than MIN_COMPLETED_CANDLES ──

scenario("Insufficient candles -> unknown, low confidence", () => {
  const values = [100, 102, 104, 103, 105]; // 5 completed candles, need >= 10
  const result = computeMarketRegime(historyFromValues("EURUSD", values));
  assert.equal(result.regime, "unknown");
  assert.equal(result.confidence, "low");
  assert.ok(result.evidence.some((e) => e.includes("Only 5 usable completed candle(s)")), "evidence states the exact shortfall");
});

// ── 6. Malformed history: many candles missing OHLC fields ──

scenario("Malformed history (missing OHLC fields) -> unknown, low confidence", () => {
  const good = buildDailyCandles([100, 102, 104, 103, 105]).slice(1); // 5 well-formed completed candles
  const malformed: MarketCandle[] = Array.from({ length: 10 }, (_, i) => ({
    datetime: addDays("2026-02-01", i),
    open: null,
    high: null,
    low: null,
    close: null,
  }));
  const forming = candleFromValue(999, addDays("2026-02-11", 0));
  const dailyCandles = [forming, ...malformed, ...good];
  const history: InstrumentMarketHistory = {
    symbol: "EURUSD",
    currentPrice: null,
    dailyCandles,
    weeklyCandles: [],
    dataQuality: { dailyHistory: "partial", weeklyHistory: "unavailable" },
  };
  const result = computeMarketRegime(history);
  assert.equal(result.regime, "unknown");
  assert.equal(result.confidence, "low");
  assert.ok(result.evidence.some((e) => e.includes("excluded for missing/malformed OHLC fields")), "evidence flags the malformed candles specifically");
});

// ── 7. Equal highs, rising lows -> transition (base disagreement, not breakout) ──

scenario("Equal highs with rising lows -> transition (equal highs rule)", () => {
  const values = [100, 104, 108, 112, 108, 104, 102, 106, 110, 112, 108, 105, 104, 106, 110];
  const result = computeMarketRegime(historyFromValues("EURUSD", values));
  assert.equal(result.regime, "transition");
  assert.ok(result.evidence.some((e) => e.includes("equal highs, higher lows")), "evidence names the exact disagreement (equal highs, higher lows)");
});

// ── 8. Equal lows, rising highs -> transition (base disagreement, not breakout) ──

scenario("Equal lows with rising highs -> transition (equal lows rule)", () => {
  const values = [100, 104, 108, 110, 106, 102, 100, 104, 108, 112, 108, 104, 100, 104, 108];
  const result = computeMarketRegime(historyFromValues("EURUSD", values));
  assert.equal(result.regime, "transition");
  assert.ok(result.evidence.some((e) => e.includes("higher highs, equal lows")), "evidence names the exact disagreement (higher highs, equal lows)");
});

// ── 9. Index 0 (forming candle) must never influence the result ──

scenario("Currently-forming candle (index 0) is never analysed", () => {
  const values = [100, 102, 106, 103, 100, 104, 108, 112, 109, 106, 110, 114, 118, 115, 112, 116, 120, 124];
  const historyA = historyFromValues("EURUSD", values);
  const resultA = computeMarketRegime(historyA);

  // Replace only index 0 with a wildly different forming candle; regime,
  // confidence, and evidence must be byte-identical.
  const historyB: InstrumentMarketHistory = {
    ...historyA,
    dailyCandles: [candleFromValue(-99999, "2099-01-01"), ...historyA.dailyCandles.slice(1)],
  };
  const resultB = computeMarketRegime(historyB);

  assert.deepEqual(resultA, resultB, "changing only index 0 must not change the result");
});

// ── 10. Empty history -> unknown ──

scenario("Empty daily candle array -> unknown, low confidence", () => {
  const history: InstrumentMarketHistory = {
    symbol: "NDX",
    currentPrice: null,
    dailyCandles: [],
    weeklyCandles: [],
    dataQuality: { dailyHistory: "unavailable", weeklyHistory: "unavailable" },
  };
  const result = computeMarketRegime(history);
  assert.equal(result.regime, "unknown");
  assert.equal(result.confidence, "low");
});

console.log(`\n${pass} scenario(s) passed.`);
