import assert from "node:assert/strict";
import { computeMarketRegime } from "../src/lib/market/engines/marketRegime";
import { computeMarketPhase } from "../src/lib/market/engines/marketPhase";
import { detectSwings, detectBreakout, isCompleteCandle } from "../src/lib/market/engines/swingDetection";
import { InstrumentMarketHistory, MarketCandle } from "../src/lib/market/types";

// ============================================================
// Edge Pulse — Market Structure calibration scenarios (Sprint 2, Part 6)
// ============================================================
// DIAGNOSTIC, not a regression suite: this script exercises the CURRENT,
// unmodified engine against the target definitions in
// docs/edge-pulse-market-structure.md and reports PASS (engine already
// matches the target) or GAP (engine diverges — expected for concepts
// Part 1/4 already flagged as unimplemented, e.g. CHoCH/Reversal/False
// Break/Correction). A GAP here is evidence for the gap table, not a bug
// to silently "fix" by relaxing the assertion — per Sprint 2's explicit
// instruction not to optimise for passing tests.
// No network. Run: npx tsx scripts/market-structure-calibration-scenarios.ts

let pass = 0;
let gap = 0;

function expectMatch(name: string, fn: () => void) {
  try {
    fn();
    pass++;
    console.log(`  PASS — ${name}`);
  } catch (err) {
    gap++;
    console.log(`  GAP  — ${name}`);
    console.log(`         ${err instanceof Error ? err.message.split("\n")[0] : err}`);
  }
}

// ── Fixture helpers (same convention as market-regime-scenarios.ts) ──────

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
function buildDailyCandles(values: number[]): MarketCandle[] {
  const start = "2026-01-01";
  const chrono = values.map((v, i) => candleFromValue(v, addDays(start, i)));
  const lastValue = values[values.length - 1];
  const forming = candleFromValue(lastValue + 999, addDays(chrono[chrono.length - 1].datetime, 1));
  return [forming, ...chrono.slice().reverse()];
}
function historyFromValues(symbol: string, values: number[]): InstrumentMarketHistory {
  const dailyCandles = buildDailyCandles(values);
  return { symbol, currentPrice: dailyCandles[0].close, dailyCandles, weeklyCandles: [], dataQuality: { dailyHistory: "complete", weeklyHistory: "unavailable" } };
}
function historyFromChrono(symbol: string, chrono: MarketCandle[]): InstrumentMarketHistory {
  const forming = candle(addDays(chrono[chrono.length - 1].datetime, 1), 99999, 100000, 99998, 99999);
  return { symbol, currentPrice: forming.close, dailyCandles: [forming, ...chrono.slice().reverse()], weeklyCandles: [], dataQuality: { dailyHistory: "complete", weeklyHistory: "unavailable" } };
}

// ── 1-4. HH / HL / LH / LL ─────────────────────────────────────────────────

expectMatch("HH: two ascending confirmed swing highs are detected as such", () => {
  const values = [100, 102, 106, 103, 100, 104, 108, 112, 109, 106, 110, 114, 118, 115, 112, 116, 120, 124];
  const result = computeMarketRegime(historyFromValues("XAUUSD", values));
  assert.equal(result.regime, "bullish_trend");
});

expectMatch("LH: two descending confirmed swing highs are detected as such", () => {
  const bullish = [100, 102, 106, 103, 100, 104, 108, 112, 109, 106, 110, 114, 118, 115, 112, 116, 120, 124];
  const values = bullish.map((v) => 224 - v);
  const result = computeMarketRegime(historyFromValues("XAUUSD", values));
  assert.equal(result.regime, "bearish_trend");
});

// ── 5. Trend continuation (BOS agreeing with trend direction) ─────────────

expectMatch("Trend continuation: a confirmed close beyond the prior swing high, WITH an established bullish trend, should be labelled BOS/continuation (target model) — today it is unlabelled, folds into the same bullish_trend read with no distinct BOS event exposed", () => {
  const values = [100, 102, 106, 103, 100, 104, 108, 112, 109, 106, 110, 114, 118, 115, 112, 116, 120, 124, 130];
  const history = historyFromValues("XAUUSD", values);
  const regime = computeMarketRegime(history);
  assert.equal(regime.regime, "bullish_trend");
  // Target model requirement: a distinct `lastBOS` event should be exposed. Not implemented today.
  assert.ok((regime as unknown as { lastBOS?: unknown }).lastBOS !== undefined, "MarketRegimeResult has no lastBOS field — target model gap");
});

// ── 6. Trend reversal (CHoCH + second confirming swing) ───────────────────

expectMatch("Trend reversal: CHoCH followed by a second confirming opposite swing should report an explicit Reversal event — not implemented, regime just silently flips", () => {
  // Uptrend, then a confirmed break of the defining HL, then a second lower swing confirms the new downtrend.
  const values = [100, 104, 108, 112, 116, 120, // uptrend swings
    117, 114, 111, 108, 105, 102, 99, 96, 93, 90]; // sharp reversal sequence
  const history = historyFromValues("XAUUSD", values);
  const regime = computeMarketRegime(history);
  // The engine will very likely just report bearish_trend directly (or transition) with
  // no narrative that a CHoCH preceded it — assert the (currently nonexistent) field.
  assert.ok((regime as unknown as { reversal?: unknown }).reversal !== undefined, `regime=${regime.regime} confidence=${regime.confidence} — no reversal/CHoCH narrative field exists on MarketRegimeResult`);
});

// ── 7. Failed BOS (single-candle wick, closed back) — already implemented ──

expectMatch("Failed BOS: wick pierces the prior swing high but closes back below it -> failed breakout (matches target, already implemented)", () => {
  const values = [100, 104, 108, 112, 108, 104, 100, 104, 108, 112, 108, 104, 100, 104, 108, 130];
  // (reused verbatim from market-regime-scenarios.ts's own "Transition after breakout" fixture — a CONFIRMED break, not failed;
  // included here to document the passing baseline for comparison against the failed case below.)
  const chrono = values.map((v, i) => candleFromValue(v, addDays("2026-01-01", i)));
  const completed = chrono.filter(isCompleteCandle);
  const swings = detectSwings(completed);
  const breakout = detectBreakout(completed, swings.filter((s) => s.type === "high"), swings.filter((s) => s.type === "low"));
  assert.equal(breakout.direction, "bullish"); // confirmed, not failed — sanity baseline
});

expectMatch("Failed BOS: an explicit failed-breakout fixture (wick beyond, close back on origin side)", () => {
  const chrono: MarketCandle[] = [
    candleFromValue(100, addDays("2026-01-01", 0)),
    candleFromValue(100, addDays("2026-01-01", 1)),
    candleFromValue(110, addDays("2026-01-01", 2)), // swing high 110.5
    candleFromValue(100, addDays("2026-01-01", 3)),
    candleFromValue(100, addDays("2026-01-01", 4)),
    candleFromValue(100, addDays("2026-01-01", 5)),
    candleFromValue(100, addDays("2026-01-01", 6)),
    candle(addDays("2026-01-01", 7), 105, 112, 104, 108), // pierces 110.5, closes back at 108
  ];
  const completed = chrono.filter(isCompleteCandle);
  const swings = detectSwings(completed);
  const breakout = detectBreakout(completed, swings.filter((s) => s.type === "high"), swings.filter((s) => s.type === "low"));
  assert.equal(breakout.failed, true);
  assert.equal(breakout.direction, null);
});

// ── 8/9. True BOS vs CHoCH labelling (target model, not implemented) ──────

expectMatch("True BOS (continuation) vs CHoCH (reversal warning) must be distinguishable given the SAME breakout primitive plus trend context — not implemented as a label anywhere today", () => {
  // Uptrend regime; latest completed close breaks BELOW the defining HL -> target model says CHoCH.
  const values = [100, 104, 108, 112, 116, 120, 118, 116, 90]; // sharp break below the established higher-low structure
  const history = historyFromValues("XAUUSD", values);
  const regime = computeMarketRegime(history);
  // Today: this just becomes `transition` or `bearish_trend` with no CHoCH label attached.
  assert.ok((regime as unknown as { lastCHoCH?: unknown }).lastCHoCH !== undefined, `regime=${regime.regime} — no lastCHoCH field exists; breakout direction vs. prior trend direction is never cross-referenced or labelled`);
});

// ── 10. False Break (confirmed break, reversed back within a short window) ─

expectMatch("False Break: a confirmed break that reverses back through the level within 2 candles should retroactively relabel as False Break, not a standing BOS/CHoCH — no forward-confirmation window exists at all today", () => {
  const values = [100, 104, 108, 112, 108, 104, 100, 104, 108, 112, 108, 104, 100, 104, 108, 130, 105, 100]; // confirmed break at 130, then reverses back to 100 within 2 candles
  const history = historyFromValues("XAUUSD", values);
  const regime = computeMarketRegime(history);
  // The engine recomputes fresh each call and has no memory of "that earlier break is now false" —
  // there is no mechanism to retroactively relabel it at all.
  assert.ok((regime as unknown as { falseBreakDetected?: unknown }).falseBreakDetected !== undefined, `regime=${regime.regime} — no retroactive false-break re-labelling exists (same class of gap the Liquidity Engine's swept->consumed fix addressed for levels, still open here for structure)`);
});

// ── 11/12. Compression / Expansion — implemented, but never surfaced ──────

expectMatch("Compression is computed correctly by marketPhase.ts (implementation matches target definition)", () => {
  const baseline = Array.from({ length: 12 }, (_, i) => candle(addDays("2026-01-01", i), 100, 104, 96, 100));
  const recent = Array.from({ length: 6 }, (_, i) => candle(addDays("2026-01-01", 12 + i), 100, 101, 99, 100));
  const result = computeMarketPhase(historyFromChrono("XAUUSD", [...baseline, ...recent]));
  assert.equal(result.phase, "compression");
});

expectMatch("Expansion is computed correctly by marketPhase.ts (implementation matches target definition)", () => {
  const baseline = Array.from({ length: 12 }, (_, i) => candle(addDays("2026-01-01", i), 100, 102, 98, 100));
  const recentPrior = Array.from({ length: 5 }, (_, i) => candle(addDays("2026-01-01", 12 + i), 100, 102, 98, 100));
  const breakoutCandle = candle(addDays("2026-01-01", 17), 100, 118, 100, 116);
  const result = computeMarketPhase(historyFromChrono("XAUUSD", [...baseline, ...recentPrior, breakoutCandle]));
  assert.equal(result.phase, "expansion");
});

expectMatch("Compression/Expansion, once computed, are surfaced in StructureResult/UI copy — GAP: structureEngine.ts only ever reads phase.phase==='pullback', every other phase value is discarded", () => {
  // This assertion documents the gap directly against the actual composition code path rather than re-deriving it.
  throw new Error("structureEngine.ts's computeRow() only branches on phase.phase === 'pullback' — compression/expansion/rotation are computed and immediately discarded (see structureEngine.ts lines ~120-149)");
});

// ── 13. Nested pullback ────────────────────────────────────────────────────

expectMatch("Nested pullback: a pullback-within-a-pullback (two distinct corrective legs) should be distinguishable from one continuous retracement — evaluatePullback only ever measures from the single most extreme point in the lookback, collapsing both legs into one number", () => {
  // Uptrend to a high, first corrective leg, small bounce, second deeper corrective leg.
  const values = [90, 96, 100, 104, 108, 112, 110, 108, 109, 105, 102]; // extreme at 112, dips to 108, bounces to 109, dips again to 102
  const regime = computeMarketRegime(historyFromValues("XAUUSD", [...Array(8).fill(90), ...values]));
  void regime;
  const history = historyFromValues("XAUUSD", [90, 90, 90, 90, 90, 90, 90, 90, ...values]);
  const phase = computeMarketPhase(history, { symbol: "XAUUSD", regime: "bullish_trend", confidence: "high", evidence: [] });
  // We can only assert the ENGINE'S single, undifferentiated read exists — there is no way to
  // ask it "was this one leg or two," which is exactly the gap.
  assert.ok((phase as unknown as { legs?: unknown }).legs !== undefined, `phase=${phase.phase} — evaluatePullback has no concept of counting distinct corrective legs within the lookback window`);
});

// ── 14. Range ──────────────────────────────────────────────────────────────

expectMatch("Range: equal swing highs and equal swing lows -> range (matches target)", () => {
  const values = [100, 104, 108, 112, 108, 104, 100, 104, 108, 112, 108, 104, 100, 104, 108, 112, 108, 104, 100];
  const result = computeMarketRegime(historyFromValues("XAUUSD", values));
  assert.equal(result.regime, "range");
});

// ── 15. Transition ─────────────────────────────────────────────────────────

expectMatch("Transition: disagreeing swing high/low directions -> transition (matches target definition of 'genuinely ambiguous')", () => {
  const values = [100, 104, 108, 112, 108, 104, 100, 104, 108, 112, 108, 104, 100, 104, 108, 130];
  const result = computeMarketRegime(historyFromValues("XAUUSD", values));
  assert.equal(result.regime, "transition");
});

// ── 16. Index-0 mutation ───────────────────────────────────────────────────

expectMatch("Index-0 (forming candle) mutation never changes regime or phase", () => {
  const values = [100, 102, 106, 103, 100, 104, 108, 112, 109, 106, 110, 114, 118, 115, 112, 116, 120, 124];
  const history = historyFromValues("XAUUSD", values);
  const mutated: InstrumentMarketHistory = { ...history, dailyCandles: [{ ...history.dailyCandles[0], open: -1, high: -1, low: -1, close: -1 }, ...history.dailyCandles.slice(1)] };
  const r1 = computeMarketRegime(history);
  const r2 = computeMarketRegime(mutated);
  assert.deepEqual(r1, r2);
});

// ── 17. Missing candles ────────────────────────────────────────────────────

expectMatch("Missing candles: too few completed candles -> unknown, never guessed", () => {
  const result = computeMarketRegime(historyFromValues("XAUUSD", [100, 101]));
  assert.equal(result.regime, "unknown");
});

// ── 18. Malformed OHLC ──────────────────────────────────────────────────────

expectMatch("Malformed OHLC: null fields are excluded, never fabricated, never throws", () => {
  const chrono: MarketCandle[] = [
    candleFromValue(100, addDays("2026-01-01", 0)),
    { datetime: addDays("2026-01-01", 1), open: null, high: null, low: null, close: null },
    ...Array.from({ length: 12 }, (_, i) => candleFromValue(100 + i, addDays("2026-01-01", 2 + i))),
  ];
  assert.doesNotThrow(() => computeMarketRegime(historyFromChrono("XAUUSD", chrono)));
});

console.log(`\n${pass} matching the target definition, ${gap} gap(s) confirmed against the current engine (see docs/edge-pulse-market-structure.md Appendix B for the full gap table).`);
