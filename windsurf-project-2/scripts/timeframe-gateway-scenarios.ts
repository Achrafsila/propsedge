import assert from "node:assert/strict";
import { resolveTimeframeGatewayHistory } from "../src/lib/edge-pulse/timeframeGateway";
import { TwelveDataResult } from "../src/lib/market/providers/twelvedata";

// ============================================================
// Edge Pulse — Timeframe Gateway deterministic scenarios
// ============================================================
// No network. Exercises the pure resolver only — same convention as
// scripts/market-data-gateway-scenarios.ts.
// Run: npx tsx scripts/timeframe-gateway-scenarios.ts

let pass = 0;
function scenario(name: string, fn: () => void) {
  fn();
  pass++;
  console.log(`  ok — ${name}`);
}

function okResult(count: number): TwelveDataResult {
  const candles = Array.from({ length: count }, (_, i) => ({
    datetime: `2026-07-${String(14 - i).padStart(2, "0")} 12:00:00`,
    open: 100 + i,
    high: 101 + i,
    low: 99 + i,
    close: 100.5 + i,
  }));
  return { data: { symbol: "EUR/USD", candles }, error: null };
}

function errorResult(): TwelveDataResult {
  return { data: null, error: { domain: "prices", code: "429", message: "rate limited" } };
}

scenario("Forex symbol with all 3 intervals healthy -> twelvedata, all 3 timeframes complete", () => {
  const result = resolveTimeframeGatewayHistory("EURUSD", { h4: okResult(180), h1: okResult(200), m15: okResult(200) });
  assert.equal(result.meta.providerUsed, "twelvedata");
  assert.equal(result.meta.primaryFailure, null);
  assert.equal(result.intraday.h4.quality, "complete");
  assert.equal(result.intraday.h1.quality, "complete");
  assert.equal(result.intraday.m15.quality, "complete");
});

scenario("Gold symbol with partial H1 depth -> h1 partial, others complete", () => {
  const result = resolveTimeframeGatewayHistory("XAUUSD", { h4: okResult(180), h1: okResult(50), m15: okResult(200) });
  assert.equal(result.intraday.h4.quality, "complete");
  assert.equal(result.intraday.h1.quality, "partial");
  assert.equal(result.intraday.m15.quality, "complete");
});

scenario("US30 (FMP-routed index) -> no intraday route, all 3 timeframes unavailable, never fetched", () => {
  const result = resolveTimeframeGatewayHistory("DJI", {});
  assert.equal(result.meta.providerUsed, "none");
  assert.equal(result.intraday.h4.quality, "unavailable");
  assert.equal(result.intraday.h1.quality, "unavailable");
  assert.equal(result.intraday.m15.quality, "unavailable");
  assert.deepEqual(result.intraday.h4.candles, []);
});

scenario("NDX (no route at all) -> unavailable, never a substituted symbol", () => {
  const result = resolveTimeframeGatewayHistory("NDX", {});
  assert.equal(result.meta.providerUsed, "none");
  assert.equal(result.intraday.m15.quality, "unavailable");
});

scenario("All 3 TwelveData calls fail -> unavailable, primary failure surfaced honestly", () => {
  const result = resolveTimeframeGatewayHistory("EURUSD", { h4: errorResult(), h1: errorResult(), m15: errorResult() });
  assert.equal(result.meta.providerUsed, "none");
  assert.equal(result.meta.primaryFailure?.code, "429");
  assert.equal(result.intraday.h4.quality, "unavailable");
});

scenario("Only M15 succeeds -> providerUsed twelvedata (partial success still counts), other two unavailable", () => {
  const result = resolveTimeframeGatewayHistory("EURUSD", { h4: errorResult(), h1: errorResult(), m15: okResult(200) });
  assert.equal(result.meta.providerUsed, "twelvedata");
  assert.equal(result.intraday.h4.quality, "unavailable");
  assert.equal(result.intraday.m15.quality, "complete");
});

console.log(`\n${pass} scenario(s) passed.`);
