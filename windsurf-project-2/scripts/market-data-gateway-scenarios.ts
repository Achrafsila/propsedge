import assert from "node:assert/strict";
import { resolveGatewayHistory, getRoutingEntry, GatewayFetchResults } from "../src/lib/market/marketDataGateway";
import { MarketError } from "../src/lib/market/types";
import { TwelveDataResult } from "../src/lib/market/providers/twelvedata";
import { AlphaVantageResult } from "../src/lib/market/providers/alphavantage";
import { FmpResult } from "../src/lib/market/providers/fmp";

// ============================================================
// PropEdge — Market Data Gateway deterministic scenarios
// ============================================================
// No network. resolveGatewayHistory is the pure decision layer (routing +
// fallback + normalization) — every scenario constructs literal provider
// results by hand and asserts the exact routing/fallback/metadata
// decision, with no dependency on getMarketDataFromGateway's real fetches
// (those are exercised separately by live verification).
// Run: npx tsx scripts/market-data-gateway-scenarios.ts

let pass = 0;
function scenario(name: string, fn: () => void) {
  fn();
  pass++;
  console.log(`  ok — ${name}`);
}

function error(code: string, message = "test error"): MarketError {
  return { domain: "prices", code, message };
}

function tdResult(candles: { datetime: string; open: number | null; high: number | null; low: number | null; close: number | null }[]): TwelveDataResult {
  return { data: { symbol: "TEST", candles }, error: null };
}
function tdError(code: string): TwelveDataResult {
  return { data: null, error: error(code) };
}
function avResult(candles: { datetime: string; open: number | null; high: number | null; low: number | null; close: number | null }[]): AlphaVantageResult {
  return { data: { symbol: "TEST", candles }, error: null };
}
function avError(code: string): AlphaVantageResult {
  return { data: null, error: error(code) };
}
function fmpResult(candles: { datetime: string; open: number | null; high: number | null; low: number | null; close: number | null }[]): FmpResult {
  return { data: { symbol: "TEST", candles }, error: null };
}
function fmpError(code: string): FmpResult {
  return { data: null, error: error(code) };
}

function candle(datetime: string, close: number, overrides: Partial<{ open: number | null; high: number | null; low: number | null }> = {}) {
  return {
    datetime,
    open: "open" in overrides ? overrides.open! : close,
    high: "high" in overrides ? overrides.high! : close,
    low: "low" in overrides ? overrides.low! : close,
    close,
  };
}

// ── 1. TwelveData success ──

scenario("TwelveData success -> providerUsed twelvedata, no fallback", () => {
  const results: GatewayFetchResults = {
    twelveDataDaily: tdResult([candle("2026-07-13", 1.14), candle("2026-07-12", 1.13)]),
    twelveDataWeekly: tdResult([candle("2026-07-13", 1.14)]),
  };
  const result = resolveGatewayHistory("EURUSD", results);
  assert.equal(result.meta.providerUsed, "twelvedata");
  assert.equal(result.meta.fallbackUsed, false);
  assert.equal(result.meta.primaryFailure, null);
  assert.equal(result.history.dailyCandles.length, 2);
  assert.equal(result.history.weeklyCandles.length, 1);
  assert.equal(result.history.currentPrice, 1.14);
});

// ── 2. TwelveData failure -> Alpha Vantage fallback ──

scenario("TwelveData failure -> Alpha Vantage fallback succeeds", () => {
  const primaryError = tdError("429");
  const results: GatewayFetchResults = {
    twelveDataDaily: primaryError,
    alphaVantageDaily: avResult([candle("2026-07-13", 1.14)]),
    alphaVantageWeekly: avResult([candle("2026-07-13", 1.14)]),
  };
  const result = resolveGatewayHistory("EURUSD", results);
  assert.equal(result.meta.providerUsed, "alphavantage");
  assert.equal(result.meta.fallbackUsed, true);
  assert.deepEqual(result.meta.primaryFailure, primaryError.error);
  assert.equal(result.history.dailyCandles.length, 1);
});

// ── 3. Both providers fail ──

scenario("Both TwelveData and Alpha Vantage fail -> unavailable, no fabricated data", () => {
  const results: GatewayFetchResults = {
    twelveDataDaily: tdError("network_error"),
    alphaVantageDaily: avError("timeout"),
  };
  const result = resolveGatewayHistory("EURUSD", results);
  assert.equal(result.meta.providerUsed, "none");
  assert.equal(result.meta.fallbackUsed, true);
  assert.equal(result.history.dataQuality.dailyHistory, "unavailable");
  assert.equal(result.history.dailyCandles.length, 0);
  assert.equal(result.history.currentPrice, null);
});

scenario("FMP failure on an index -> unavailable; no fallback path exists for indices (V1 has none configured)", () => {
  const results: GatewayFetchResults = { fmpDaily: fmpError("plan_restricted") };
  const result = resolveGatewayHistory("SPX", results);
  assert.equal(result.meta.providerUsed, "none");
  assert.equal(result.meta.fallbackUsed, false, "indices have no fallback provider in V1 routing");
  assert.equal(result.history.dataQuality.dailyHistory, "unavailable");
  assert.deepEqual(result.meta.primaryFailure, results.fmpDaily?.error);
});

// ── 4. FMP S&P 500 success ──

scenario("FMP S&P 500 (SPX) success -> providerUsed fmp, weekly honestly unavailable", () => {
  const results: GatewayFetchResults = { fmpDaily: fmpResult([candle("2026-07-13", 6005), candle("2026-07-10", 5990)]) };
  const result = resolveGatewayHistory("SPX", results);
  assert.equal(result.meta.providerUsed, "fmp");
  assert.equal(result.meta.fallbackUsed, false);
  assert.equal(result.history.dailyCandles.length, 2);
  assert.equal(result.history.weeklyCandles.length, 0);
  assert.equal(result.history.dataQuality.weeklyHistory, "unavailable", "FMP has no weekly endpoint on this plan");
});

// ── 5. FMP Dow Jones success ──

scenario("FMP Dow Jones (DJI) success -> providerUsed fmp", () => {
  const results: GatewayFetchResults = { fmpDaily: fmpResult([candle("2026-07-13", 44500)]) };
  const result = resolveGatewayHistory("DJI", results);
  assert.equal(result.meta.providerUsed, "fmp");
  assert.equal(result.history.currentPrice, 44500);
});

// ── 6. Nasdaq unavailable ──

scenario("Nasdaq 100 (NDX) -> unavailable, never substituted with an ETF", () => {
  const result = resolveGatewayHistory("NDX", {});
  assert.equal(result.meta.providerUsed, "none");
  assert.equal(result.meta.fallbackUsed, false);
  assert.equal(result.history.dataQuality.dailyHistory, "unavailable");
  const entry = getRoutingEntry("NDX");
  assert.equal(entry?.assetClass, "us_index_unavailable");
  assert.equal(entry?.twelveDataSymbol, undefined, "no provider symbol configured for NDX at all");
  assert.equal(entry?.fmpSymbol, undefined, "no provider symbol configured for NDX at all");
});

// ── 7. Malformed provider response ──

scenario("Malformed provider response (candles with missing OHLC fields) -> nulls pass through, never fabricated", () => {
  const results: GatewayFetchResults = {
    twelveDataDaily: tdResult([candle("2026-07-13", 1.14, { open: null, high: null, low: null }), candle("2026-07-12", 1.13)]),
  };
  const result = resolveGatewayHistory("EURUSD", results);
  assert.equal(result.meta.providerUsed, "twelvedata");
  assert.equal(result.history.dailyCandles[0].open, null, "missing field stays null, never guessed");
  assert.equal(result.history.dailyCandles[0].close, 1.14);
  assert.equal(result.history.dailyCandles.length, 2);
  assert.equal(result.history.currentPrice, 1.14, "current price still derivable from a valid close even when other fields are null");
});

scenario("Malformed provider response (empty candle array despite no error) -> treated as primary failure, triggers fallback", () => {
  const results: GatewayFetchResults = {
    twelveDataDaily: tdResult([]), // no error field set, but zero candles
    alphaVantageDaily: avResult([candle("2026-07-13", 1.14)]),
  };
  const result = resolveGatewayHistory("EURUSD", results);
  assert.equal(result.meta.providerUsed, "alphavantage");
  assert.equal(result.meta.fallbackUsed, true);
  assert.ok(result.meta.primaryFailure, "an empty-but-error-free primary result still produces a primaryFailure reason");
});

// ── 8. Symbol normalization ──

scenario("Symbol normalization: canonical gateway symbols map to each provider's exact required format", () => {
  assert.equal(getRoutingEntry("EURUSD")?.twelveDataSymbol, "EUR/USD");
  assert.deepEqual(getRoutingEntry("EURUSD")?.alphaVantage, { base: "EUR", quote: "USD", kind: "forex" });
  assert.equal(getRoutingEntry("USDJPY")?.twelveDataSymbol, "USD/JPY");
  assert.deepEqual(getRoutingEntry("USDJPY")?.alphaVantage, { base: "USD", quote: "JPY", kind: "forex" });
  assert.equal(getRoutingEntry("XAUUSD")?.twelveDataSymbol, "XAU/USD");
  assert.deepEqual(getRoutingEntry("XAUUSD")?.alphaVantage, { base: "XAU", quote: "USD", kind: "forex" });
  assert.equal(getRoutingEntry("BTCUSD")?.twelveDataSymbol, "BTC/USD");
  assert.deepEqual(getRoutingEntry("BTCUSD")?.alphaVantage, { base: "BTC", quote: "USD", kind: "crypto" });
  assert.equal(getRoutingEntry("ETHUSD")?.twelveDataSymbol, "ETH/USD");
  assert.deepEqual(getRoutingEntry("ETHUSD")?.alphaVantage, { base: "ETH", quote: "USD", kind: "crypto" });
  assert.equal(getRoutingEntry("SPX")?.fmpSymbol, "^GSPC");
  assert.equal(getRoutingEntry("DJI")?.fmpSymbol, "^DJI");
  assert.equal(getRoutingEntry("UNKNOWN_SYMBOL"), null);
});

// ── 9. No provider mixing ──

scenario("No provider mixing: a healthy primary ignores fallback data even if present in the results object", () => {
  const results: GatewayFetchResults = {
    twelveDataDaily: tdResult([candle("2026-07-13", 1.14)]),
    twelveDataWeekly: tdResult([candle("2026-07-13", 1.14)]),
    // Present but must be ignored — primary succeeded.
    alphaVantageDaily: avResult([candle("2026-07-13", 999)]),
    alphaVantageWeekly: avResult([candle("2026-07-13", 999)]),
  };
  const result = resolveGatewayHistory("EURUSD", results);
  assert.equal(result.meta.providerUsed, "twelvedata");
  assert.equal(result.history.currentPrice, 1.14, "must not pick up the fallback's price even though fallback data was present");
});

scenario("No provider mixing: primary failure discards ALL primary data, including an independently-successful weekly", () => {
  const results: GatewayFetchResults = {
    twelveDataDaily: tdError("429"),
    // Weirdly succeeds even though daily failed — must still be discarded,
    // since the primary as a whole is being replaced by the fallback.
    twelveDataWeekly: tdResult([candle("2026-07-06", 9)]),
    alphaVantageDaily: avResult([candle("2026-07-13", 1.14)]),
    alphaVantageWeekly: avResult([candle("2026-07-06", 2)]),
  };
  const result = resolveGatewayHistory("EURUSD", results);
  assert.equal(result.meta.providerUsed, "alphavantage");
  assert.equal(result.history.weeklyCandles[0]?.close, 2, "weekly must come from Alpha Vantage, not TwelveData's independently-successful weekly result");
});

// ── 10. Source metadata correctness (all branches enumerated) ──

scenario("Source metadata is correct across every routing branch", () => {
  const primaryOnly = resolveGatewayHistory("EURUSD", { twelveDataDaily: tdResult([candle("2026-07-13", 1)]) });
  assert.deepEqual(primaryOnly.meta, { providerUsed: "twelvedata", fallbackUsed: false, primaryFailure: null });

  const fallbackSucceeded = resolveGatewayHistory("EURUSD", { twelveDataDaily: tdError("429"), alphaVantageDaily: avResult([candle("2026-07-13", 1)]) });
  assert.equal(fallbackSucceeded.meta.providerUsed, "alphavantage");
  assert.equal(fallbackSucceeded.meta.fallbackUsed, true);
  assert.ok(fallbackSucceeded.meta.primaryFailure);

  const bothFailed = resolveGatewayHistory("EURUSD", { twelveDataDaily: tdError("429"), alphaVantageDaily: avError("timeout") });
  assert.deepEqual(bothFailed.meta.providerUsed, "none");
  assert.equal(bothFailed.meta.fallbackUsed, true);
  assert.ok(bothFailed.meta.primaryFailure);

  const fmpOnly = resolveGatewayHistory("SPX", { fmpDaily: fmpResult([candle("2026-07-13", 6000)]) });
  assert.deepEqual(fmpOnly.meta, { providerUsed: "fmp", fallbackUsed: false, primaryFailure: null });

  const unavailable = resolveGatewayHistory("NDX", {});
  assert.deepEqual(unavailable.meta, { providerUsed: "none", fallbackUsed: false, primaryFailure: null });
});

console.log(`\n${pass} scenario(s) passed.`);
