import assert from "node:assert/strict";
import { computeMarketPhase } from "../src/lib/market/engines/marketPhase";
import type { MarketRegimeResult } from "../src/lib/market/engines/marketRegime";
import { InstrumentMarketHistory, MarketCandle } from "../src/lib/market/types";

// ============================================================
// PropEdge — Market Phase Engine deterministic scenarios
// ============================================================
// No network. Every history fixture is hand-built so the exact
// contraction/expansion/alternation numbers are known in advance; we
// assert the pure engine produces the documented phase/confidence/
// evidence for each documented decision rule.
// Run: npx tsx scripts/market-phase-scenarios.ts

let pass = 0;
function scenario(name: string, fn: () => void) {
  fn();
  pass++;
  console.log(`  ok — ${name}`);
}

// ── Fixture helpers ─────────────────────────────────────────────────────

function candle(datetime: string, open: number, high: number, low: number, close: number): MarketCandle {
  return { datetime, open, high, low, close };
}

// A "flat" candle centered on V with a fixed +-0.5 spread — used whenever
// a scenario only cares about price level / close direction, not range
// size (range is always exactly 1 for these, so it never trips the
// contraction/expansion checks by accident).
function flat(v: number, datetime: string): MarketCandle {
  return candle(datetime, v, v + 0.5, v - 0.5, v);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// chrono: chronological (oldest first), already fully-specified OHLC.
// Returns dailyCandles newest-first with an outlier forming candle
// prepended at index 0, which must never influence the result.
function toDailyCandles(chrono: MarketCandle[]): MarketCandle[] {
  const lastDate = chrono[chrono.length - 1].datetime;
  const forming = candle(addDays(lastDate, 1), 99999, 100000, 99998, 99999);
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

function regimeOf(regime: MarketRegimeResult["regime"]): MarketRegimeResult {
  return { symbol: "TEST", regime, confidence: "high", evidence: [] };
}

function dateFrom(i: number): string {
  return addDays("2026-01-01", i);
}

// ── 1. Clean compression: tight recent range, heavy overlap, contained ──

scenario("Clean compression -> compression, high confidence", () => {
  const baseline = Array.from({ length: 12 }, (_, i) => candle(dateFrom(i), 100, 104, 96, 100));
  const recent = Array.from({ length: 6 }, (_, i) => candle(dateFrom(12 + i), 100, 101, 99, 100));
  const result = computeMarketPhase(historyFrom("EURUSD", [...baseline, ...recent]));
  assert.equal(result.phase, "compression");
  assert.equal(result.confidence, "high");
  assert.ok(result.evidence.some((e) => e.includes("median range")), "evidence cites the contraction ratio");
  assert.ok(result.evidence.some((e) => e.includes("overlap")), "evidence cites overlap");
  assert.ok(result.evidence.some((e) => e.includes("baseline's high/low envelope")), "evidence cites containment");
});

// ── 2. Expansion: baseline range 4, breakout candle range 18, directional close ──

scenario("Directional breakout candle -> expansion", () => {
  const baseline = Array.from({ length: 12 }, (_, i) => candle(dateFrom(i), 100, 102, 98, 100));
  const recentPrior = Array.from({ length: 5 }, (_, i) => candle(dateFrom(12 + i), 100, 102, 98, 100));
  const breakout = candle(dateFrom(17), 100, 118, 100, 116);
  const result = computeMarketPhase(historyFrom("XAUUSD", [...baseline, ...recentPrior, breakout]));
  assert.equal(result.phase, "expansion");
  assert.equal(result.confidence, "medium"); // strong range, but only 18 candles (not >=24 "ample")
  assert.ok(result.evidence.some((e) => e.includes("directional expansion confirmed")), "evidence explains the directional-close rule");
});

// ── 2b. Large wick, flat close: range expands but close stays inside structure -> NOT expansion ──

scenario("Large wick without directional close -> not expansion (falls through to unknown)", () => {
  const baseline = Array.from({ length: 12 }, (_, i) => candle(dateFrom(i), 100, 102, 98, 100));
  const recentPrior = Array.from({ length: 5 }, (_, i) => candle(dateFrom(12 + i), 100, 102, 98, 100));
  const bigWick = candle(dateFrom(17), 100, 112, 94, 100); // huge range, but closes flat at 100 (inside [98,102])
  const result = computeMarketPhase(historyFrom("XAUUSD", [...baseline, ...recentPrior, bigWick]));
  assert.notEqual(result.phase, "expansion");
  assert.ok(
    result.evidence.some((e) => e.includes("a large wick alone is not enough for expansion")),
    "evidence explicitly explains why the wick did not qualify"
  );
});

// ── 3. Bullish pullback: uptrend to a high, then 4 declining closes within the corrective band ──

function pullbackTailValues(): number[] {
  return [92, 96, 100, 104, 108, 112, 110, 107, 105, 104];
}

scenario("Bullish trend + corrective decline -> pullback, high confidence", () => {
  const early = Array.from({ length: 8 }, (_, i) => flat(90, dateFrom(i)));
  const tail = pullbackTailValues().map((v, i) => flat(v, dateFrom(8 + i)));
  const history = historyFrom("EURUSD", [...early, ...tail]);
  const result = computeMarketPhase(history, regimeOf("bullish_trend"));
  assert.equal(result.phase, "pullback");
  assert.equal(result.confidence, "high");
  assert.ok(result.evidence.some((e) => e.includes("Bullish trend context confirmed via regime")), "evidence names the regime gate");
  assert.ok(result.evidence.some((e) => e.includes("Retracement from recent high")), "evidence states the retracement");
});

scenario("Same price action WITHOUT a trend regime -> never labelled pullback", () => {
  const early = Array.from({ length: 8 }, (_, i) => flat(90, dateFrom(i)));
  const tail = pullbackTailValues().map((v, i) => flat(v, dateFrom(8 + i)));
  const history = historyFrom("EURUSD", [...early, ...tail]);

  const noRegimeResult = computeMarketPhase(history);
  assert.notEqual(noRegimeResult.phase, "pullback");

  const rangeRegimeResult = computeMarketPhase(history, regimeOf("range"));
  assert.notEqual(rangeRegimeResult.phase, "pullback");
});

// ── 4. Bearish pullback: downtrend to a low, then 4 rising closes within the corrective band ──

scenario("Bearish trend + corrective rally -> pullback, high confidence", () => {
  const early = Array.from({ length: 8 }, (_, i) => flat(110, dateFrom(i)));
  const tailValues = [108, 104, 100, 96, 92, 88, 90, 93, 95, 96];
  const tail = tailValues.map((v, i) => flat(v, dateFrom(8 + i)));
  const history = historyFrom("XAUUSD", [...early, ...tail]);
  const result = computeMarketPhase(history, regimeOf("bearish_trend"));
  assert.equal(result.phase, "pullback");
  assert.equal(result.confidence, "high");
  assert.ok(result.evidence.some((e) => e.includes("Bearish trend context confirmed via regime")), "evidence names the regime gate");
});

// ── 5. Rotation: alternating closes inside stable (non-contracting) boundaries ──

scenario("Alternating closes inside stable boundaries -> rotation, low confidence (minimum threshold)", () => {
  const values = [100, 104, 108, 104, 100, 104, 108, 104, 100, 104, 108, 104, 100, 104, 108, 104, 100, 104];
  const chrono = values.map((v, i) => flat(v, dateFrom(i)));
  const result = computeMarketPhase(historyFrom("EURUSD", chrono));
  assert.equal(result.phase, "rotation");
  assert.equal(result.confidence, "low");
  assert.ok(result.evidence.some((e) => e.includes("directional alternation")), "evidence cites the alternation count");
  assert.ok(result.evidence.some((e) => e.includes("distinguishes rotation from compression")), "evidence explains the rotation/compression distinction");
});

scenario("Strong alternation + ample history -> rotation, high confidence", () => {
  const flatPadding = Array.from({ length: 22 }, (_, i) => flat(100, dateFrom(i)));
  const alternating = [100, 104, 100, 104, 100, 104, 100, 104].map((v, i) => flat(v, dateFrom(22 + i)));
  const result = computeMarketPhase(historyFrom("EURUSD", [...flatPadding, ...alternating]));
  assert.equal(result.phase, "rotation");
  assert.equal(result.confidence, "high");
});

// ── 6. Insufficient candles ──

scenario("Insufficient candles -> unknown, low confidence", () => {
  const chrono = Array.from({ length: 10 }, (_, i) => flat(100 + i, dateFrom(i)));
  const result = computeMarketPhase(historyFrom("EURUSD", chrono));
  assert.equal(result.phase, "unknown");
  assert.equal(result.confidence, "low");
  assert.ok(result.evidence.some((e) => e.includes("Only 10 usable completed candle(s)")), "evidence states the exact shortfall");
});

// ── 7. Malformed history ──

scenario("Malformed history (missing OHLC fields) -> unknown, low confidence", () => {
  const good = Array.from({ length: 8 }, (_, i) => flat(100, dateFrom(i)));
  const malformed: MarketCandle[] = Array.from({ length: 6 }, (_, i) => ({
    datetime: dateFrom(8 + i),
    open: null,
    high: null,
    low: null,
    close: null,
  }));
  const dailyCandles = [candle(dateFrom(14), 999, 1000, 998, 999), ...malformed, ...good];
  const history: InstrumentMarketHistory = {
    symbol: "EURUSD",
    currentPrice: null,
    dailyCandles,
    weeklyCandles: [],
    dataQuality: { dailyHistory: "partial", weeklyHistory: "unavailable" },
  };
  const result = computeMarketPhase(history);
  assert.equal(result.phase, "unknown");
  assert.equal(result.confidence, "low");
  assert.ok(result.evidence.some((e) => e.includes("excluded for missing/malformed OHLC fields")), "evidence flags the malformed candles specifically");
});

// ── 8. Empty history ──

scenario("Empty daily candle array -> unknown, low confidence", () => {
  const history: InstrumentMarketHistory = {
    symbol: "NDX",
    currentPrice: null,
    dailyCandles: [],
    weeklyCandles: [],
    dataQuality: { dailyHistory: "unavailable", weeklyHistory: "unavailable" },
  };
  const result = computeMarketPhase(history);
  assert.equal(result.phase, "unknown");
  assert.equal(result.confidence, "low");
});

// ── 9. Index 0 (forming candle) must never influence the result ──

scenario("Currently-forming candle (index 0) is never analysed", () => {
  const baseline = Array.from({ length: 12 }, (_, i) => candle(dateFrom(i), 100, 104, 96, 100));
  const recent = Array.from({ length: 6 }, (_, i) => candle(dateFrom(12 + i), 100, 101, 99, 100));
  const historyA = historyFrom("EURUSD", [...baseline, ...recent]);
  const resultA = computeMarketPhase(historyA);

  const historyB: InstrumentMarketHistory = {
    ...historyA,
    dailyCandles: [candle("2099-01-01", -1, -1, -99999, -1), ...historyA.dailyCandles.slice(1)],
  };
  const resultB = computeMarketPhase(historyB);

  assert.deepEqual(resultA, resultB, "changing only index 0 must not change the result");
});

console.log(`\n${pass} scenario(s) passed.`);
