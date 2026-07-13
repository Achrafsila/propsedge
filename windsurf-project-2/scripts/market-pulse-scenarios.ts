import assert from "node:assert/strict";
import { computeMarketPulse } from "../src/lib/market/marketPulse";
import { computeMarketRegime } from "../src/lib/market/engines/marketRegime";
import { computeMarketPhase } from "../src/lib/market/engines/marketPhase";
import { computeMarketVolatility } from "../src/lib/market/engines/marketVolatility";
import { computeMarketConviction } from "../src/lib/market/engines/marketConviction";
import { computeMarketEnvironment } from "../src/lib/market/engines/marketEnvironment";
import { InstrumentMarketHistory, MarketCandle, MarketContext } from "../src/lib/market/types";

// ============================================================
// PropEdge — Market Pulse deterministic scenarios
// ============================================================
// No network. Verifies Pulse (a) calls the five engines in the correct
// order and (b) composes their REAL outputs without recomputing or
// altering them — most assertions below compare pulse.<field> against a
// freshly-computed call to the same engine, which directly enforces "must
// not duplicate any upstream calculation" rather than just asserting a
// pre-guessed enum value.
// Run: npx tsx scripts/market-pulse-scenarios.ts

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
function dateFrom(i: number): string {
  return addDays("2026-01-01", i);
}

function candle(datetime: string, open: number, high: number, low: number, close: number): MarketCandle {
  return { datetime, open, high, low, close };
}

// Zigzag OHLC with real range variation (reused shape from the Regime
// engine's own "strong bullish trend" fixture, extended with a small
// wick so it also carries meaningful range for Volatility/Phase).
function zigzagCandle(v: number, datetime: string): MarketCandle {
  return candle(datetime, v - 1, v + 1.5, v - 1.5, v);
}

function toDailyCandles(chrono: MarketCandle[]): MarketCandle[] {
  const lastDate = chrono[chrono.length - 1].datetime;
  const forming = candle(addDays(lastDate, 1), 99999, 100000, 99998, 99999);
  return [forming, ...chrono.slice().reverse()];
}

function ampleHistory(symbol: string): InstrumentMarketHistory {
  // 30 completed candles: comfortably above every engine's minimum
  // (Regime 10, Phase 18, Volatility 25).
  const values = [
    100, 102, 106, 103, 100, 104, 108, 112, 109, 106, 110, 114, 118, 115, 112, 116, 120, 124, 121, 118, 122, 126, 130, 127, 124, 128, 132, 136, 133, 130,
  ];
  const chrono = values.map((v, i) => zigzagCandle(v, dateFrom(i)));
  return {
    symbol,
    currentPrice: values[values.length - 1],
    dailyCandles: toDailyCandles(chrono),
    weeklyCandles: [],
    dataQuality: { dailyHistory: "complete", weeklyHistory: "complete" },
  };
}

function sparseHistory(symbol: string, completedCount: number): InstrumentMarketHistory {
  const chrono = Array.from({ length: completedCount }, (_, i) => zigzagCandle(100 + i, dateFrom(i)));
  return {
    symbol,
    currentPrice: 100 + completedCount,
    dailyCandles: toDailyCandles(chrono),
    weeklyCandles: [],
    dataQuality: { dailyHistory: completedCount >= 100 ? "complete" : "partial", weeklyHistory: "unavailable" },
  };
}

// Genuinely nothing to report: zero completed candles, and dataQuality
// honestly marked unavailable (not just "low count").
function unavailableHistory(symbol: string): InstrumentMarketHistory {
  return {
    symbol,
    currentPrice: null,
    dailyCandles: [candle(dateFrom(0), 100, 101, 99, 100)], // only the forming candle — zero completed
    weeklyCandles: [],
    dataQuality: { dailyHistory: "unavailable", weeklyHistory: "unavailable" },
  };
}

// Empirically verified (via direct engine calls) to produce Regime =
// "unknown" (mostly-tied flat candles defeat fractal swing detection, and
// an irregular non-overlapping tail defeats Regime's own compression
// fallback) while Phase and Volatility both still resolve to real values
// from the same history — the exact combination the status rollup must
// treat as "partial", not "unavailable".
function regimeUnknownOthersResolvedHistory(symbol: string): InstrumentMarketHistory {
  const values = [
    100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, // 18 flat
    100, 140, 70, 155, 60, 130, 90, // 7 irregular
  ];
  const chrono = values.map((v, i) => candle(dateFrom(i), v - 3, v + 6, v - 6, v + 2));
  return {
    symbol,
    currentPrice: values[values.length - 1],
    dailyCandles: toDailyCandles(chrono),
    weeklyCandles: [],
    dataQuality: { dailyHistory: "complete", weeklyHistory: "complete" },
  };
}

function bullishContext(): MarketContext {
  return {
    bias: "bullish",
    nearestLevel: { label: "Daily Open", price: 130, distance: 3, distancePercent: 2.3 },
    distances: [{ label: "Daily Open", price: 130, distance: 3, distancePercent: 2.3 }],
    insight: "test insight",
  };
}

// ── 1. Full pipeline wiring: every field is exactly what calling the engine directly produces ──

scenario("Pulse composes real engine outputs, byte-identical to calling each engine directly", () => {
  const history = ampleHistory("EURUSD");
  const context = bullishContext();

  const pulse = computeMarketPulse(history, context);

  const expectedRegime = computeMarketRegime(history);
  const expectedVolatility = computeMarketVolatility(history);
  const expectedPhase = computeMarketPhase(history, expectedRegime);
  const expectedConviction = computeMarketConviction(expectedRegime, expectedPhase, expectedVolatility, context);
  const expectedEnvironment = computeMarketEnvironment(expectedRegime, expectedPhase, expectedVolatility, expectedConviction, context);

  assert.deepEqual(pulse.regime, expectedRegime, "regime must be identical to a direct call, not recomputed differently");
  assert.deepEqual(pulse.phase, expectedPhase, "phase must be identical to a direct call");
  assert.deepEqual(pulse.volatility, expectedVolatility, "volatility must be identical to a direct call");
  assert.deepEqual(pulse.conviction, expectedConviction, "conviction must be identical to a direct call");
  assert.deepEqual(pulse.environment, expectedEnvironment, "environment must be identical to a direct call");
  assert.equal(pulse.bias, "bullish");
  assert.deepEqual(pulse.nearestLevel, context.nearestLevel);
});

// ── 2. Evidence is a faithful, source-tagged concatenation, not new text ──

scenario("Evidence array is the tagged concatenation of every engine's own evidence, in order", () => {
  const history = ampleHistory("XAUUSD");
  const context = bullishContext();
  const pulse = computeMarketPulse(history, context);

  const regimeCount = pulse.regime.evidence.length;
  const phaseCount = pulse.phase.evidence.length;
  const volCount = pulse.volatility.evidence.length;
  const convCount = pulse.conviction.evidence.length;
  const envCount = pulse.environment.evidence.length;

  const regimeSlice = pulse.evidence.slice(0, regimeCount);
  const phaseSlice = pulse.evidence.slice(regimeCount, regimeCount + phaseCount);
  const volSlice = pulse.evidence.slice(regimeCount + phaseCount, regimeCount + phaseCount + volCount);
  const convSlice = pulse.evidence.slice(regimeCount + phaseCount + volCount, regimeCount + phaseCount + volCount + convCount);
  const envSlice = pulse.evidence.slice(regimeCount + phaseCount + volCount + convCount, regimeCount + phaseCount + volCount + convCount + envCount);

  assert.deepEqual(
    regimeSlice.map((e) => e.message),
    pulse.regime.evidence
  );
  assert.ok(regimeSlice.every((e) => e.source === "regime"));
  assert.deepEqual(
    phaseSlice.map((e) => e.message),
    pulse.phase.evidence
  );
  assert.ok(phaseSlice.every((e) => e.source === "phase"));
  assert.deepEqual(
    volSlice.map((e) => e.message),
    pulse.volatility.evidence
  );
  assert.ok(volSlice.every((e) => e.source === "volatility"));
  assert.deepEqual(
    convSlice.map((e) => e.message),
    pulse.conviction.evidence
  );
  assert.ok(convSlice.every((e) => e.source === "conviction"));
  assert.deepEqual(
    envSlice.map((e) => e.message),
    pulse.environment.evidence
  );
  assert.ok(envSlice.every((e) => e.source === "environment"));
});

// ── 3. Fully available status when everything resolves cleanly ──

scenario("Ample history + full context -> status available, no pulse-level degradation note", () => {
  const pulse = computeMarketPulse(ampleHistory("EURUSD"), bullishContext());
  assert.equal(pulse.status, "available");
  assert.ok(!pulse.evidence.some((e) => e.source === "pulse"), "no degradation evidence when nothing is degraded");
  assert.equal(pulse.dataQuality.marketContext, "available");
});

// ── 4. True unavailable: no usable history, no context, every engine unknown ──

scenario("No usable history + no context + everything unknown -> status unavailable", () => {
  const history = unavailableHistory("EURUSD");
  const pulse = computeMarketPulse(history, null);
  assert.equal(pulse.regime.regime, "unknown");
  assert.equal(pulse.phase.phase, "unknown");
  assert.equal(pulse.volatility.volatility, "unknown");
  assert.equal(pulse.status, "unavailable");
  assert.ok(pulse.summary.includes("could not be determined"));
});

// ── 4b. Regime unknown alone must NOT force unavailable when other engines resolve ──

scenario("Regime unknown but Phase and Volatility resolve -> status partial, not unavailable", () => {
  const history = regimeUnknownOthersResolvedHistory("EURUSD");

  // Sanity-check the fixture actually exercises the intended combination
  // before trusting the Pulse-level assertions below.
  const regimeCheck = computeMarketRegime(history);
  const phaseCheck = computeMarketPhase(history, regimeCheck);
  const volatilityCheck = computeMarketVolatility(history);
  assert.equal(regimeCheck.regime, "unknown");
  assert.notEqual(phaseCheck.phase, "unknown");
  assert.notEqual(volatilityCheck.volatility, "unknown");

  const pulse = computeMarketPulse(history, null);
  assert.equal(pulse.regime.regime, "unknown");
  assert.equal(pulse.status, "partial");
  assert.ok(pulse.evidence.some((e) => e.source === "pulse" && e.message.includes("regime could not be determined")));
});

// ── 4c. Regime unknown but Market Context available -> partial ──

scenario("Regime unknown but Market Context is available -> status partial", () => {
  const history = sparseHistory("EURUSD", 5); // too few candles for every engine
  const pulse = computeMarketPulse(history, bullishContext());
  assert.equal(pulse.regime.regime, "unknown");
  assert.equal(pulse.status, "partial");
});

// ── 5. Enough for Regime+Phase but not Volatility -> status partial, degradation names volatility ──

scenario("20 completed candles (enough for Regime+Phase, not Volatility) -> status partial", () => {
  const history = sparseHistory("EURUSD", 20);
  const regimeCheck = computeMarketRegime(history);
  const volatilityCheck = computeMarketVolatility(history);
  // Sanity-check the fixture actually exercises the intended boundary.
  assert.notEqual(regimeCheck.regime, "unknown");
  assert.equal(volatilityCheck.volatility, "unknown");

  const pulse = computeMarketPulse(history, bullishContext());
  assert.equal(pulse.status, "partial");
  assert.ok(pulse.evidence.some((e) => e.source === "pulse" && e.message.includes("volatility could not be determined")));
});

// ── 6. Missing MarketContext -> dataQuality.marketContext unavailable, bias/nearestLevel fall back honestly ──

scenario("No MarketContext -> dataQuality reflects it, bias is unknown, nearestLevel is null", () => {
  const pulse = computeMarketPulse(ampleHistory("EURUSD"), null);
  assert.equal(pulse.dataQuality.marketContext, "unavailable");
  assert.equal(pulse.bias, "unknown");
  assert.equal(pulse.nearestLevel, null);
  assert.equal(pulse.status, "partial"); // regime resolves, but context is missing
  assert.ok(pulse.evidence.some((e) => e.source === "pulse" && e.message.includes("market context is unavailable")));
});

// ── 7. dataQuality.dailyHistory/weeklyHistory are a direct passthrough of the input, not recomputed ──

scenario("history.dataQuality is passed through verbatim", () => {
  const history = ampleHistory("EURUSD");
  history.dataQuality = { dailyHistory: "partial", weeklyHistory: "unavailable" };
  const pulse = computeMarketPulse(history, bullishContext());
  assert.equal(pulse.dataQuality.dailyHistory, "partial");
  assert.equal(pulse.dataQuality.weeklyHistory, "unavailable");
  assert.equal(pulse.status, "partial");
});

// ── 8. generatedAt is a real, current ISO timestamp ──

scenario("generatedAt is a valid, current ISO 8601 timestamp", () => {
  const before = Date.now();
  const pulse = computeMarketPulse(ampleHistory("EURUSD"), bullishContext());
  const after = Date.now();
  const parsed = Date.parse(pulse.generatedAt);
  assert.ok(!Number.isNaN(parsed), "generatedAt parses as a valid date");
  assert.ok(parsed >= before && parsed <= after, "generatedAt falls within the call window");
});

// ── 9. Symbol is sourced from the history, consistently threaded through ──

scenario("Symbol is threaded consistently from the input history", () => {
  const pulse = computeMarketPulse(ampleHistory("US30"), bullishContext());
  assert.equal(pulse.symbol, "US30");
  assert.equal(pulse.regime.symbol, "US30");
  assert.equal(pulse.phase.symbol, "US30");
  assert.equal(pulse.volatility.symbol, "US30");
});

// ── 10. Market Context contributes tagged evidence (insight + nearest level) ──

scenario("Market Context contributes tagged evidence (insight + nearest level fact)", () => {
  const context = bullishContext();
  const pulse = computeMarketPulse(ampleHistory("EURUSD"), context);
  const contextEvidence = pulse.evidence.filter((e) => e.source === "market_context");
  assert.equal(contextEvidence.length, 2);
  assert.ok(contextEvidence.some((e) => e.message === context.insight), "insight is carried through verbatim");
  assert.ok(
    contextEvidence.some((e) => e.message.includes("Nearest level: Daily Open at 130")),
    "nearest-level fact is composed from MarketContext's own fields, not recomputed"
  );
});

scenario("No Market Context -> no market_context evidence entries", () => {
  const pulse = computeMarketPulse(ampleHistory("EURUSD"), null);
  assert.ok(!pulse.evidence.some((e) => e.source === "market_context"));
});

console.log(`\n${pass} scenario(s) passed.`);
