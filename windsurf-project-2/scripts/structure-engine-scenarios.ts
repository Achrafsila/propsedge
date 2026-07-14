import assert from "node:assert/strict";
import { computeStructure } from "../src/lib/edge-pulse/engines/structureEngine";
import { MultiTimeframeHistory, Timeframe, TimeframeCandles } from "../src/lib/edge-pulse/types";
import { MarketCandle } from "../src/lib/market/types";

// ============================================================
// Edge Pulse — Structure Engine deterministic scenarios
// ============================================================
// No network. Fixtures reuse the exact same synthetic-candle patterns
// already validated in scripts/market-regime-scenarios.ts and
// scripts/market-phase-scenarios.ts (same regime/phase engines underneath,
// just fed through a different timeframe slot) — every regime/phase this
// engine reports has already been independently confirmed correct at the
// engine level; this script only asserts the multi-timeframe composition
// and trader-facing labelling on top of that.
// Run: npx tsx scripts/structure-engine-scenarios.ts

let pass = 0;
function scenario(name: string, fn: () => void) {
  fn();
  pass++;
  console.log(`  ok — ${name}`);
}

// ── Fixture helpers (same convention as market-regime-scenarios.ts) ──────

function candleFromValue(v: number, datetime: string): MarketCandle {
  return { datetime, open: v, high: v + 0.5, low: v - 0.5, close: v };
}
function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function buildCandles(values: number[]): MarketCandle[] {
  const start = "2026-01-01";
  const chrono = values.map((v, i) => candleFromValue(v, addDays(start, i)));
  const lastValue = values[values.length - 1];
  const forming = candleFromValue(lastValue + 999, addDays(chrono[chrono.length - 1].datetime, 1));
  return [forming, ...chrono.slice().reverse()];
}
function tf(timeframe: Timeframe, values: number[]): TimeframeCandles {
  return { timeframe, candles: buildCandles(values), quality: values.length >= 100 ? "complete" : "partial" };
}
function unavailableTf(timeframe: Timeframe): TimeframeCandles {
  return { timeframe, candles: [], quality: "unavailable" };
}
function fullCandle(datetime: string, open: number, high: number, low: number, close: number): MarketCandle {
  return { datetime, open, high, low, close };
}
function tfFromChrono(timeframe: Timeframe, chrono: MarketCandle[]): TimeframeCandles {
  const lastDate = chrono[chrono.length - 1].datetime;
  const forming = fullCandle(addDays(lastDate, 1), 99999, 100000, 99998, 99999);
  return { timeframe, candles: [forming, ...chrono.slice().reverse()], quality: "complete" };
}

const BULLISH = [100, 102, 106, 103, 100, 104, 108, 112, 109, 106, 110, 114, 118, 115, 112, 116, 120, 124];
const BEARISH = BULLISH.map((v) => 224 - v);
const RANGE = [100, 104, 108, 112, 108, 104, 100, 104, 108, 112, 108, 104, 100, 104, 108, 112, 108, 104, 100];
const TRANSITION_BULLISH_BREAKOUT = [100, 104, 108, 112, 108, 104, 100, 104, 108, 112, 108, 104, 100, 104, 108, 130];
const BULLISH_PULLBACK = [...BULLISH, 122, 119, 117, 116]; // verified: bullish_trend/high + pullback/high

function history(overrides: Partial<Record<Timeframe, TimeframeCandles>>): MultiTimeframeHistory {
  const base: MultiTimeframeHistory = {
    symbol: "TEST",
    currentPrice: 100,
    daily: tf("daily", BULLISH),
    h4: tf("h4", BULLISH),
    h1: tf("h1", BULLISH),
    m15: tf("m15", BULLISH),
    weeklyCandles: [],
  };
  return { ...base, ...overrides };
}

scenario("All 4 timeframes bullish -> every row Bullish/green, no disagreement", () => {
  const result = computeStructure("EURUSD", history({}));
  for (const row of result.rows) {
    assert.equal(row.bias, "Bullish");
    assert.equal(row.color, "green");
    assert.ok(row.latestHH !== null && row.latestHL !== null, `${row.timeframe} reports HH/HL`);
    assert.equal(row.latestLH, null);
  }
  assert.equal(result.disagreement, false);
});

scenario("Daily bullish, H1 bearish -> disagreement true", () => {
  const result = computeStructure("EURUSD", history({ h1: tf("h1", BEARISH) }));
  const daily = result.rows.find((r) => r.timeframe === "daily")!;
  const h1 = result.rows.find((r) => r.timeframe === "h1")!;
  assert.equal(daily.bias, "Bullish");
  assert.equal(h1.bias, "Bearish");
  assert.equal(h1.color, "red");
  assert.ok(h1.latestLH !== null && h1.latestLL !== null, "bearish row reports LH/LL");
  assert.equal(result.disagreement, true);
});

scenario("Bullish trend + corrective decline -> Bullish Pullback", () => {
  const result = computeStructure("EURUSD", history({ daily: tf("daily", BULLISH_PULLBACK) }));
  const daily = result.rows.find((r) => r.timeframe === "daily")!;
  assert.equal(daily.bias, "Bullish Pullback");
  assert.equal(daily.color, "green");
});

scenario("Clean range -> Ranging/yellow, both HH/HL and LH/LL reported", () => {
  const result = computeStructure("EURUSD", history({ m15: tf("m15", RANGE) }));
  const m15 = result.rows.find((r) => r.timeframe === "m15")!;
  assert.equal(m15.bias, "Ranging");
  assert.equal(m15.color, "yellow");
  assert.ok(m15.latestHH !== null && m15.latestLH !== null, "range row shows both sides");
});

scenario("Unconfirmed bullish breakout -> Bullish Shift/yellow", () => {
  const result = computeStructure("EURUSD", history({ h4: tf("h4", TRANSITION_BULLISH_BREAKOUT) }));
  const h4 = result.rows.find((r) => r.timeframe === "h4")!;
  assert.equal(h4.bias, "Bullish Shift");
  assert.equal(h4.color, "yellow");
});

scenario("Timeframe with no intraday route (e.g. US30's H4/H1/M15) -> Unavailable/gray, excluded from disagreement", () => {
  const result = computeStructure(
    "US30",
    history({ h4: unavailableTf("h4"), h1: unavailableTf("h1"), m15: unavailableTf("m15"), daily: tf("daily", BEARISH) })
  );
  const h4 = result.rows.find((r) => r.timeframe === "h4")!;
  assert.equal(h4.bias, "Unavailable");
  assert.equal(h4.color, "gray");
  assert.deepEqual(h4.latestHH, null);
  // Only Daily (bearish) resolved — no bullish row exists, so no disagreement despite 3 unavailable rows.
  assert.equal(result.disagreement, false);
});

// ── Sprint 2 / Phase 2 additions: sequence trend, correction, reversal, ──
// ── phase surfacing, timeframe hierarchy ──────────────────────────────────

const UPTREND_FOR_EVENTS = [90, 95, 100, 92, 88, 96, 104, 112, 102, 94, 106, 116, 126, 112, 98, 110, 124, 138, 148];

scenario("Correction: a 20-50% retracement in an established bullish sequence, no CHoCH yet -> correction=true, bias stays Bullish (not yet a pullback-band retracement)", () => {
  const correctionValues = [...UPTREND_FOR_EVENTS, 140, 130, 118, 108, 100];
  const result = computeStructure("XAUUSD", history({ daily: tf("daily", correctionValues) }));
  const daily = result.rows.find((r) => r.timeframe === "daily")!;
  assert.equal(daily.sequenceTrend, "bullish");
  assert.equal(daily.correction, true);
  assert.equal(daily.lastCHoCH, null);
});

scenario("Reversal: a confirmed CHoCH followed by a proper bearish zigzag confirms a second opposite swing -> reversal=true, sequenceTrend flips to bearish", () => {
  const reversalValues = [...UPTREND_FOR_EVENTS, 82, 78, 74, 76, 79, 70, 66, 63, 66, 69, 60, 56, 53, 56, 59, 50, 46, 43, 46, 49];
  const result = computeStructure("XAUUSD", history({ daily: tf("daily", reversalValues) }));
  const daily = result.rows.find((r) => r.timeframe === "daily")!;
  assert.equal(daily.sequenceTrend, "bearish");
  assert.ok(daily.lastCHoCH);
  assert.equal(daily.lastCHoCH?.direction, "bearish");
  assert.equal(daily.reversal, true);
});

scenario("A CHoCH with no second confirming swing yet (still mid-decline, no new swing low confirmed) -> reversal stays false", () => {
  // Monotonic crash: no local minimum forms within it, so no NEW swing low ever confirms —
  // the sequence read still reflects the stale, pre-crash (bullish) swing lows.
  const monotonicCrash = [...UPTREND_FOR_EVENTS, 98, 82, 78, 74, 70, 66, 62, 58, 54, 50];
  const result = computeStructure("XAUUSD", history({ daily: tf("daily", monotonicCrash) }));
  const daily = result.rows.find((r) => r.timeframe === "daily")!;
  assert.ok(daily.lastCHoCH, "a CHoCH still fires on the initial break");
  assert.equal(daily.reversal, false, "no second confirming swing has formed yet");
});

scenario("Compression is now surfaced on the row (previously computed by marketPhase.ts and silently discarded) — same fixture as market-phase-scenarios.ts's 'Clean compression' scenario", () => {
  const baseline = Array.from({ length: 12 }, (_, i) => fullCandle(addDays("2026-01-01", i), 100, 104, 96, 100));
  const recent = Array.from({ length: 6 }, (_, i) => fullCandle(addDays("2026-01-01", 12 + i), 100, 101, 99, 100));
  const result = computeStructure("XAUUSD", history({ daily: tfFromChrono("daily", [...baseline, ...recent]) }));
  const daily = result.rows.find((r) => r.timeframe === "daily")!;
  assert.equal(daily.compression, true);
  assert.equal(daily.expansion, false);
  assert.equal(daily.rotation, false);
});

scenario("Expansion is now surfaced on the row — same fixture as market-phase-scenarios.ts's 'Directional breakout candle' scenario", () => {
  const baseline = Array.from({ length: 12 }, (_, i) => fullCandle(addDays("2026-01-01", i), 100, 102, 98, 100));
  const recentPrior = Array.from({ length: 5 }, (_, i) => fullCandle(addDays("2026-01-01", 12 + i), 100, 102, 98, 100));
  const breakoutCandle = fullCandle(addDays("2026-01-01", 17), 100, 118, 100, 116);
  const result = computeStructure("XAUUSD", history({ daily: tfFromChrono("daily", [...baseline, ...recentPrior, breakoutCandle]) }));
  const daily = result.rows.find((r) => r.timeframe === "daily")!;
  assert.equal(daily.expansion, true);
  assert.equal(daily.compression, false);
});

scenario("Timeframe hierarchy: Daily and H4 both bullish -> H4 aligned; H1 bearish under a bullish H4 -> conflicting", () => {
  const bearishTail = BULLISH.map((v) => 224 - v);
  const result = computeStructure("XAUUSD", history({ h1: tf("h1", bearishTail), m15: tf("m15", bearishTail) }));
  const daily = result.rows.find((r) => r.timeframe === "daily")!;
  const h4 = result.rows.find((r) => r.timeframe === "h4")!;
  const h1 = result.rows.find((r) => r.timeframe === "h1")!;
  assert.equal(daily.higherTimeframeAlignment, "not_applicable", "Daily has no higher timeframe");
  assert.equal(h4.higherTimeframeAlignment, "aligned");
  assert.equal(h1.higherTimeframeAlignment, "conflicting");
});

scenario("Timeframe hierarchy: an unavailable row never reports aligned/conflicting", () => {
  const result = computeStructure("US30", history({ h4: unavailableTf("h4") }));
  const h4 = result.rows.find((r) => r.timeframe === "h4")!;
  assert.equal(h4.higherTimeframeAlignment, "not_applicable");
});

console.log(`\n${pass} scenario(s) passed.`);
