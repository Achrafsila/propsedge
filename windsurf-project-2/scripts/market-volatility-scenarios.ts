import assert from "node:assert/strict";
import { computeMarketVolatility } from "../src/lib/market/engines/marketVolatility";
import { InstrumentMarketHistory, MarketCandle } from "../src/lib/market/types";

// ============================================================
// PropEdge — Market Volatility Engine deterministic scenarios
// ============================================================
// No network. Every history fixture is hand-built so the exact
// recent/baseline range ratio and large-candle counts are known in
// advance; we assert the pure engine produces the documented
// volatility/confidence/evidence for each documented decision rule.
// Run: npx tsx scripts/market-volatility-scenarios.ts

let pass = 0;
function scenario(name: string, fn: () => void) {
  fn();
  pass++;
  console.log(`  ok — ${name}`);
}

// ── Fixture helpers ─────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dateFrom(i: number): string {
  return addDays("2026-01-01", i);
}

// A candle centered on `center` with a given half-range — close always
// equals center (flat), so range is exactly 2*halfRange and close never
// carries directional information on its own.
function rangeCandle(datetime: string, center: number, halfRange: number): MarketCandle {
  return { datetime, open: center, high: center + halfRange, low: center - halfRange, close: center };
}

function toDailyCandles(chrono: MarketCandle[]): MarketCandle[] {
  const lastDate = chrono[chrono.length - 1].datetime;
  const forming = rangeCandle(addDays(lastDate, 1), 99999, 1); // outlier, must never influence the result
  return [forming, ...chrono.slice().reverse()];
}

function historyFrom(symbol: string, chrono: MarketCandle[]): InstrumentMarketHistory {
  const dailyCandles = toDailyCandles(chrono);
  return {
    symbol,
    currentPrice: dailyCandles[0].close,
    dailyCandles,
    weeklyCandles: [],
    dataQuality: { dailyHistory: chrono.length >= 100 ? "complete" : "partial", weeklyHistory: "unavailable" },
  };
}

// ── 1. Low volatility: recent range far below baseline ──

scenario("Recent ranges far below baseline -> low, medium confidence", () => {
  const baseline = Array.from({ length: 20 }, (_, i) => rangeCandle(dateFrom(i), 100, 5)); // range 10
  const recent = Array.from({ length: 5 }, (_, i) => rangeCandle(dateFrom(20 + i), 100, 1)); // range 2
  const result = computeMarketVolatility(historyFrom("EURUSD", [...baseline, ...recent]));
  assert.equal(result.volatility, "low");
  assert.equal(result.confidence, "medium");
  assert.ok(result.evidence.some((e) => e.includes("0.20x")), "evidence states the exact ratio");
});

// ── 2. Normal volatility: recent range matches baseline ──

scenario("Recent range matches baseline -> normal, medium confidence", () => {
  const baseline = Array.from({ length: 20 }, (_, i) => rangeCandle(dateFrom(i), 100, 5)); // range 10
  const recent = Array.from({ length: 5 }, (_, i) => rangeCandle(dateFrom(20 + i), 100, 5)); // range 10
  const result = computeMarketVolatility(historyFrom("EURUSD", [...baseline, ...recent]));
  assert.equal(result.volatility, "normal");
  assert.equal(result.confidence, "medium");
});

// ── 3. High volatility, ratio-driven, ample history -> high confidence ──

scenario("Ratio decisively in the high band with ample history -> high, high confidence", () => {
  const padding = Array.from({ length: 15 }, (_, i) => rangeCandle(dateFrom(i), 100, 5)); // range 10, pads total history only
  const baseline = Array.from({ length: 20 }, (_, i) => rangeCandle(dateFrom(15 + i), 100, 5)); // range 10
  const recent = Array.from({ length: 5 }, (_, i) => rangeCandle(dateFrom(35 + i), 100, 8)); // range 16 -> ratio 1.6
  const result = computeMarketVolatility(historyFrom("EURUSD", [...padding, ...baseline, ...recent]));
  assert.equal(result.volatility, "high");
  assert.equal(result.confidence, "high");
  assert.ok(result.evidence.some((e) => e.includes("1.60x")), "evidence states the exact ratio");
});

// ── 4. Extreme volatility, ratio-driven, ample history -> high confidence ──

scenario("Ratio decisively in the extreme band with ample history -> extreme, high confidence", () => {
  const padding = Array.from({ length: 15 }, (_, i) => rangeCandle(dateFrom(i), 100, 5));
  const baseline = Array.from({ length: 20 }, (_, i) => rangeCandle(dateFrom(15 + i), 100, 5)); // range 10
  const recent = Array.from({ length: 5 }, (_, i) => rangeCandle(dateFrom(35 + i), 100, 15)); // range 30 -> ratio 3.0
  const result = computeMarketVolatility(historyFrom("XAUUSD", [...padding, ...baseline, ...recent]));
  assert.equal(result.volatility, "extreme");
  assert.equal(result.confidence, "high");
  assert.ok(result.evidence.some((e) => e.includes("3.00x")), "evidence states the exact ratio");
});

// ── 5. Persistence promotion: median stays low, but 2 of 5 candles are independently large ──

scenario("Two of five candles independently large -> promotes low to high", () => {
  const baseline = Array.from({ length: 20 }, (_, i) => rangeCandle(dateFrom(i), 100, 5)); // range 10
  const recentHalfRanges = [1, 1, 1, 8, 8]; // ranges [2,2,2,16,16] -> median range 2 (ratio 0.2, "low" alone)
  const recent = recentHalfRanges.map((hr, i) => rangeCandle(dateFrom(20 + i), 100, hr));
  const result = computeMarketVolatility(historyFrom("EURUSD", [...baseline, ...recent]));
  assert.equal(result.volatility, "high");
  assert.equal(result.confidence, "low"); // promoted, but not decisively (only 2 of 5, not ample data)
  assert.ok(result.evidence.some((e) => e.includes('Ratio alone suggested "low"') && e.includes('promotes the result to "high"')), "evidence explains the promotion");
});

// ── 6. Single isolated outlier does NOT promote ──

scenario("Exactly one large candle -> does not promote, stays low", () => {
  const baseline = Array.from({ length: 20 }, (_, i) => rangeCandle(dateFrom(i), 100, 5)); // range 10
  const recentHalfRanges = [1, 1, 1, 1, 8]; // ranges [2,2,2,2,16] -> median range 2 (ratio 0.2)
  const recent = recentHalfRanges.map((hr, i) => rangeCandle(dateFrom(20 + i), 100, hr));
  const result = computeMarketVolatility(historyFrom("EURUSD", [...baseline, ...recent]));
  assert.equal(result.volatility, "low");
  assert.ok(
    result.evidence.some((e) => e.includes("a single outlier alone does not change the classification")),
    "evidence explicitly reports the outlier without letting it dominate"
  );
});

// ── 7. Direction independence: strongly trending closes, constant range -> classification unaffected ──

scenario("Strongly trending closes with constant range -> normal (direction never read)", () => {
  const baseline = Array.from({ length: 20 }, (_, i) => rangeCandle(dateFrom(i), 100 + i * 3, 5)); // steadily rising, range 10 throughout
  const recent = Array.from({ length: 5 }, (_, i) => rangeCandle(dateFrom(20 + i), 100 + (20 + i) * 3, 5)); // trend continues, range still 10
  const result = computeMarketVolatility(historyFrom("EURUSD", [...baseline, ...recent]));
  assert.equal(result.volatility, "normal");
  // Closes moved from 100 to 172 across the window (a large directional move) yet the
  // classification is unaffected — proving range, not close direction, drives the result.
});

// ── 8. Insufficient candles ──

scenario("Insufficient candles -> unknown, low confidence", () => {
  const chrono = Array.from({ length: 15 }, (_, i) => rangeCandle(dateFrom(i), 100, 5));
  const result = computeMarketVolatility(historyFrom("EURUSD", chrono));
  assert.equal(result.volatility, "unknown");
  assert.equal(result.confidence, "low");
  assert.ok(result.evidence.some((e) => e.includes("Only 15 usable completed candle(s)")), "evidence states the exact shortfall");
});

// ── 9. Malformed history ──

scenario("Malformed history (missing OHLC fields) -> unknown, low confidence", () => {
  const good = Array.from({ length: 10 }, (_, i) => rangeCandle(dateFrom(i), 100, 5));
  const malformed: MarketCandle[] = Array.from({ length: 20 }, (_, i) => ({
    datetime: dateFrom(10 + i),
    open: null,
    high: null,
    low: null,
    close: null,
  }));
  const dailyCandles = [rangeCandle(dateFrom(30), 999, 1), ...malformed, ...good];
  const history: InstrumentMarketHistory = {
    symbol: "EURUSD",
    currentPrice: null,
    dailyCandles,
    weeklyCandles: [],
    dataQuality: { dailyHistory: "partial", weeklyHistory: "unavailable" },
  };
  const result = computeMarketVolatility(history);
  assert.equal(result.volatility, "unknown");
  assert.equal(result.confidence, "low");
  assert.ok(result.evidence.some((e) => e.includes("excluded for missing/malformed OHLC fields")), "evidence flags the malformed candles specifically");
});

// ── 10. Empty history ──

scenario("Empty daily candle array -> unknown, low confidence", () => {
  const history: InstrumentMarketHistory = {
    symbol: "NDX",
    currentPrice: null,
    dailyCandles: [],
    weeklyCandles: [],
    dataQuality: { dailyHistory: "unavailable", weeklyHistory: "unavailable" },
  };
  const result = computeMarketVolatility(history);
  assert.equal(result.volatility, "unknown");
  assert.equal(result.confidence, "low");
});

// ── 11. Degenerate zero baseline ──

scenario("Zero-range baseline with real recent range -> extreme (unbounded ratio), low confidence", () => {
  const baseline = Array.from({ length: 20 }, (_, i) => rangeCandle(dateFrom(i), 100, 0)); // literally flat
  const recent = Array.from({ length: 5 }, (_, i) => rangeCandle(dateFrom(20 + i), 100, 5)); // range 10
  const result = computeMarketVolatility(historyFrom("EURUSD", [...baseline, ...recent]));
  assert.equal(result.volatility, "extreme");
  assert.equal(result.confidence, "low");
  assert.ok(result.evidence.some((e) => e.includes("unbounded, treated as extreme")), "evidence explains the degenerate-baseline handling");
});

scenario("Both windows completely flat -> low, low confidence", () => {
  const chrono = Array.from({ length: 25 }, (_, i) => rangeCandle(dateFrom(i), 100, 0));
  const result = computeMarketVolatility(historyFrom("EURUSD", chrono));
  assert.equal(result.volatility, "low");
  assert.equal(result.confidence, "low");
});

// ── 12. Index 0 (forming candle) must never influence the result ──

scenario("Currently-forming candle (index 0) is never analysed", () => {
  const baseline = Array.from({ length: 20 }, (_, i) => rangeCandle(dateFrom(i), 100, 5));
  const recent = Array.from({ length: 5 }, (_, i) => rangeCandle(dateFrom(20 + i), 100, 5));
  const historyA = historyFrom("EURUSD", [...baseline, ...recent]);
  const resultA = computeMarketVolatility(historyA);

  const historyB: InstrumentMarketHistory = {
    ...historyA,
    dailyCandles: [rangeCandle("2099-01-01", -1, 99999), ...historyA.dailyCandles.slice(1)],
  };
  const resultB = computeMarketVolatility(historyB);

  assert.deepEqual(resultA, resultB, "changing only index 0 must not change the result");
});

console.log(`\n${pass} scenario(s) passed.`);
