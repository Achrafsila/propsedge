import assert from "node:assert/strict";
import { composeEdgePulse } from "../src/lib/edge-pulse/composeEdgePulse";
import { computeMarketPulse } from "../src/lib/market/marketPulse";
import { InstrumentMarketHistory, MarketCandle } from "../src/lib/market/types";
import { MultiTimeframeHistory, TimeframeCandles } from "../src/lib/edge-pulse/types";

// ============================================================
// Edge Pulse — composeEdgePulse deterministic scenarios
// ============================================================
// No network. Uses the REAL computeMarketPulse (unmodified) fed a
// hand-built fixture, combined with hand-built multi-timeframe candles, so
// the composition is exercised end-to-end exactly as production would
// call it. Run: npx tsx scripts/compose-edge-pulse-scenarios.ts

let pass = 0;
function scenario(name: string, fn: () => void) {
  fn();
  pass++;
  console.log(`  ok — ${name}`);
}

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
function tf(timeframe: MultiTimeframeHistory["daily"]["timeframe"], values: number[]): TimeframeCandles {
  return { timeframe, candles: buildCandles(values), quality: "complete" };
}

const BULLISH = [100, 102, 106, 103, 100, 104, 108, 112, 109, 106, 110, 114, 118, 115, 112, 116, 120, 124];
const BEARISH = BULLISH.map((v) => 224 - v);

function bullishHistoryForPulse(): InstrumentMarketHistory {
  const dailyCandles = buildCandles(BULLISH);
  return {
    symbol: "EURUSD",
    currentPrice: dailyCandles[0].close,
    dailyCandles,
    weeklyCandles: [],
    dataQuality: { dailyHistory: "partial", weeklyHistory: "unavailable" },
  };
}

const BANNED_WORDS = ["conviction", "environment", "regime", "confidence", "engine", "model"];
function assertNoBannedWords(strings: (string | null)[], context: string) {
  for (const s of strings) {
    if (!s) continue;
    const lower = s.toLowerCase();
    for (const word of BANNED_WORDS) {
      assert.ok(!lower.includes(word), `"${context}" contains banned word "${word}": "${s}"`);
    }
  }
}

scenario("All 4 timeframes bullish and aligned -> Strongly Bullish/Bullish overall bias, no execution posture, Excellent structure alignment", () => {
  const pulse = computeMarketPulse(bullishHistoryForPulse(), null);
  const history: MultiTimeframeHistory = {
    symbol: "EURUSD",
    currentPrice: 124,
    daily: tf("daily", BULLISH),
    h4: tf("h4", BULLISH),
    h1: tf("h1", BULLISH),
    m15: tf("m15", BULLISH),
    weeklyCandles: [],
  };
  const brief = composeEdgePulse("EURUSD", 124, pulse, null, history, [], new Date("2026-02-01T12:00:00Z"));

  assert.ok(["Strongly Bullish", "Bullish"].includes(brief.overallBias));
  assert.equal(brief.executionPosture, null);
  assert.equal(brief.marketQuality.structureAlignment, "Excellent");
  assert.ok(brief.outlookNarrative.length >= 1);
  assert.ok(brief.catalyst.fallbackMessage, "no economic events supplied -> fallback message present");

  assertNoBannedWords(
    [...brief.outlookNarrative, brief.executionPosture, ...brief.marketContext, ...brief.sessionPlaybook, ...brief.warnings],
    "generated copy"
  );

  // Sprint 2 / Phase 4 — the CALIBRATED headline. All 4 timeframes are a
  // clean ascending sequence -> strongly_bullish, fully_aligned, exactly 3
  // narrative sentences, no session posture needed (nothing to watch for).
  assert.equal(brief.structureInterpretation.overall, "strongly_bullish");
  assert.equal(brief.structureInterpretation.alignment, "fully_aligned");
  assert.equal(brief.structureNarrative.length, 3);
  assert.equal(brief.structureSessionPosture, null);
});

scenario("Daily bullish, H1 bearish -> execution posture fires, Weak structure alignment", () => {
  const pulse = computeMarketPulse(bullishHistoryForPulse(), null);
  const history: MultiTimeframeHistory = {
    symbol: "EURUSD",
    currentPrice: 124,
    daily: tf("daily", BULLISH),
    h4: tf("h4", BULLISH),
    h1: tf("h1", BEARISH),
    m15: tf("m15", BULLISH),
    weeklyCandles: [],
  };
  const brief = composeEdgePulse("EURUSD", 124, pulse, null, history, [], new Date("2026-02-01T12:00:00Z"));

  assert.ok(brief.executionPosture !== null);
  assert.ok(brief.executionPosture?.includes("H1"));
  assert.equal(brief.marketQuality.structureAlignment, "Weak");

  // Sprint 2 / Phase 4 — the calibrated read flags this as a genuine
  // cross-timeframe conflict, same underlying disagreement the legacy
  // executionPosture already caught, now surfaced through the new field too.
  assert.equal(brief.structureInterpretation.alignment, "conflicting");
});

scenario("Unavailable intraday timeframes (e.g. US30) -> Structure/Supply-Demand degrade honestly, brief still composes", () => {
  const pulse = computeMarketPulse(bullishHistoryForPulse(), null);
  const unavailableTf = (timeframe: "h4" | "h1" | "m15"): TimeframeCandles => ({ timeframe, candles: [], quality: "unavailable" });
  const history: MultiTimeframeHistory = {
    symbol: "US30",
    currentPrice: 124,
    daily: tf("daily", BULLISH),
    h4: unavailableTf("h4"),
    h1: unavailableTf("h1"),
    m15: unavailableTf("m15"),
    weeklyCandles: [],
  };
  const brief = composeEdgePulse("US30", 124, pulse, null, history, [], new Date("2026-02-01T12:00:00Z"));

  const h4Row = brief.structure.rows.find((r) => r.timeframe === "h4")!;
  assert.equal(h4Row.bias, "Unavailable");
  assert.equal(brief.supplyDemandByTimeframe.find((s) => s.timeframe === "h4")?.nearestDemand, null);
  assert.ok(brief.overallBias); // still composes a top-level bias from Daily/MarketPulse alone
});

console.log(`\n${pass} scenario(s) passed.`);
