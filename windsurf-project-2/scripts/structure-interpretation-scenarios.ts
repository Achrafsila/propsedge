import assert from "node:assert/strict";
import { computeStructure } from "../src/lib/edge-pulse/engines/structureEngine";
import type { TimeframeStructureRow } from "../src/lib/edge-pulse/engines/structureEngine";
import { classifyStructureCondition, composeStructureInterpretation, mostRecentStructuralEvent } from "../src/lib/edge-pulse/engines/structureInterpretationEngine";
import { MarketCandle } from "../src/lib/market/types";
import { MultiTimeframeHistory, TimeframeCandles, Timeframe } from "../src/lib/edge-pulse/types";

// ============================================================
// Structure Interpretation Engine deterministic scenarios (Sprint 2 / Phase 3)
// ============================================================
// No network. Direct-row scenarios construct a TimeframeStructureRow by
// hand to isolate the pure classification logic (same discipline as
// Sprint 1's direct clusterEqualLevels unit test); full-pipeline scenarios
// reuse fixtures already verified against computeStructure in
// scripts/structure-engine-scenarios.ts.
// Run: npx tsx scripts/structure-interpretation-scenarios.ts

let pass = 0;
function scenario(name: string, fn: () => void) {
  fn();
  pass++;
  console.log(`  ok — ${name}`);
}

// ── Direct-row fixture helper ──────────────────────────────────────────────

function baseRow(overrides: Partial<TimeframeStructureRow>): TimeframeStructureRow {
  return {
    timeframe: "daily",
    label: "Daily",
    bias: "Ranging",
    color: "yellow",
    latestHH: null,
    latestHL: null,
    latestLH: null,
    latestLL: null,
    quality: "complete",
    sequenceTrend: "mixed",
    sequenceConsistency: "weak",
    sequenceHighs: { higher: 0, lower: 0, equal: 0 },
    sequenceLows: { higher: 0, lower: 0, equal: 0 },
    compression: false,
    expansion: false,
    rotation: false,
    correction: false,
    lastBOS: null,
    lastCHoCH: null,
    lastFailedBreak: null,
    reversal: false,
    higherTimeframeAlignment: "not_applicable",
    ...overrides,
  };
}

// ── Direct-row classification scenarios ───────────────────────────────────

scenario("Mixed with a net bullish lean in the raw direction counts -> mixed_bullish_pressure", () => {
  const row = baseRow({ sequenceTrend: "mixed", sequenceHighs: { higher: 1, lower: 1, equal: 0 }, sequenceLows: { higher: 2, lower: 0, equal: 0 } });
  assert.equal(classifyStructureCondition(row), "mixed_bullish_pressure");
});

scenario("Mixed with a net bearish lean in the raw direction counts -> mixed_bearish_pressure", () => {
  const row = baseRow({ sequenceTrend: "mixed", sequenceHighs: { higher: 0, lower: 2, equal: 0 }, sequenceLows: { higher: 1, lower: 1, equal: 0 } });
  assert.equal(classifyStructureCondition(row), "mixed_bearish_pressure");
});

scenario("Mixed with an exactly balanced lean (net zero) -> unresolved, never guessed toward either side", () => {
  const row = baseRow({ sequenceTrend: "mixed", sequenceHighs: { higher: 1, lower: 3, equal: 0 }, sequenceLows: { higher: 3, lower: 1, equal: 0 } });
  assert.equal(classifyStructureCondition(row), "unresolved");
});

scenario("Classic equal/equal range -> balanced_range", () => {
  const row = baseRow({ sequenceTrend: "range" });
  assert.equal(classifyStructureCondition(row), "balanced_range");
});

scenario("Too few confirmed swings -> unresolved", () => {
  const row = baseRow({ sequenceTrend: "unknown" });
  assert.equal(classifyStructureCondition(row), "unresolved");
});

scenario("Clean bullish sequence, no CHoCH/correction/compression -> no secondary condition (existing bias label already suffices)", () => {
  const row = baseRow({ sequenceTrend: "bullish", sequenceConsistency: "strong", bias: "Bullish", color: "green" });
  assert.equal(classifyStructureCondition(row), null);
});

scenario("Conflicting with the higher timeframe takes priority over everything else", () => {
  const row = baseRow({ sequenceTrend: "bullish", correction: true, compression: true, higherTimeframeAlignment: "conflicting" });
  assert.equal(classifyStructureCondition(row), "conflicting_timeframes");
});

scenario("An unconfirmed CHoCH (reversal not yet confirmed) takes priority over correction/compression", () => {
  const row = baseRow({
    sequenceTrend: "bearish",
    lastCHoCH: { type: "CHoCH", direction: "bearish", price: 100, brokenSwingDatetime: "d1", confirmedAt: "d2", status: "confirmed" },
    reversal: false,
    correction: true,
    compression: true,
  });
  assert.equal(classifyStructureCondition(row), "bearish_reversal_attempt");
});

scenario("A stale CHoCH superseded by a MORE RECENT BOS in the opposite direction is no longer an active 'reversal attempt' (caught via live XAUUSD validation)", () => {
  const row = baseRow({
    sequenceTrend: "mixed",
    lastCHoCH: { type: "CHoCH", direction: "bullish", price: 4659.8, brokenSwingDatetime: "2026-04-28", confirmedAt: "2026-05-06", status: "confirmed" },
    lastBOS: { type: "BOS", direction: "bearish", price: 4122.5, brokenSwingDatetime: "2026-06-15", confirmedAt: "2026-06-23", status: "confirmed" },
    reversal: false,
  });
  assert.equal(classifyStructureCondition(row), "unresolved"); // mixed with a net-zero lean, since neither reversal nor correction/compression apply
});

scenario("A CHoCH that IS still the most recent event (no later BOS) correctly reports as an active reversal attempt", () => {
  const row = baseRow({
    sequenceTrend: "mixed",
    lastCHoCH: { type: "CHoCH", direction: "bearish", price: 100, brokenSwingDatetime: "2026-06-01", confirmedAt: "2026-06-10", status: "confirmed" },
    lastBOS: { type: "BOS", direction: "bullish", price: 90, brokenSwingDatetime: "2026-01-01", confirmedAt: "2026-01-15", status: "confirmed" }, // older than the CHoCH
    reversal: false,
  });
  assert.equal(classifyStructureCondition(row), "bearish_reversal_attempt");
});

scenario("A CONFIRMED reversal (reversal=true) is no longer a 'reversal attempt' — falls through to the clean-trend null", () => {
  const row = baseRow({
    sequenceTrend: "bearish",
    sequenceConsistency: "strong",
    lastCHoCH: { type: "CHoCH", direction: "bearish", price: 100, brokenSwingDatetime: "d1", confirmedAt: "d2", status: "confirmed" },
    reversal: true,
  });
  assert.equal(classifyStructureCondition(row), null);
});

scenario("Correction takes priority over compression when both happen to be true", () => {
  const row = baseRow({ sequenceTrend: "bullish", correction: true, compression: true });
  assert.equal(classifyStructureCondition(row), "corrective_bullish_move");
});

scenario("Compression alone -> compression_before_break", () => {
  const row = baseRow({ sequenceTrend: "mixed", compression: true });
  assert.equal(classifyStructureCondition(row), "compression_before_break");
});

scenario("Rotation takes its own distinct label, not folded into compression", () => {
  const row = baseRow({ sequenceTrend: "mixed", rotation: true, compression: false });
  assert.equal(classifyStructureCondition(row), "two_sided_rotation");
});

scenario("mostRecentStructuralEvent picks whichever of lastBOS/lastCHoCH has the later confirmedAt", () => {
  const bos: NonNullable<TimeframeStructureRow["lastBOS"]> = { type: "BOS", direction: "bullish", price: 100, brokenSwingDatetime: "d1", confirmedAt: "2026-06-01", status: "confirmed" };
  const choch: NonNullable<TimeframeStructureRow["lastCHoCH"]> = { type: "CHoCH", direction: "bearish", price: 90, brokenSwingDatetime: "d2", confirmedAt: "2026-07-01", status: "confirmed" };
  const rowChochLater = baseRow({ lastBOS: bos, lastCHoCH: choch });
  assert.equal(mostRecentStructuralEvent(rowChochLater)?.type, "CHoCH");

  const rowBosLater = baseRow({ lastBOS: { ...bos, confirmedAt: "2026-08-01" }, lastCHoCH: choch });
  assert.equal(mostRecentStructuralEvent(rowBosLater)?.type, "BOS");

  const rowOnlyChoch = baseRow({ lastBOS: null, lastCHoCH: choch });
  assert.equal(mostRecentStructuralEvent(rowOnlyChoch)?.type, "CHoCH");

  const rowNeither = baseRow({ lastBOS: null, lastCHoCH: null });
  assert.equal(mostRecentStructuralEvent(rowNeither), null);
});

scenario("Unavailable row -> no classification (null), never fabricated", () => {
  const row = baseRow({ quality: "unavailable" });
  assert.equal(classifyStructureCondition(row), null);
});

// ── Full-pipeline fixtures (reusing structure-engine-scenarios.ts's own verified patterns) ──

function candleFromValue(v: number, datetime: string): MarketCandle {
  return { datetime, open: v, high: v + 0.5, low: v - 0.5, close: v };
}
function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function toCandles(chrono: MarketCandle[]): MarketCandle[] {
  const lastDate = chrono[chrono.length - 1].datetime;
  const forming = candleFromValue(9999, addDays(lastDate, 1));
  return [forming, ...chrono.slice().reverse()];
}
function tf(timeframe: Timeframe, values: number[]): TimeframeCandles {
  return { timeframe, candles: toCandles(values.map((v, i) => candleFromValue(v, addDays("2026-01-01", i)))), quality: "complete" };
}
function unavailableTf(timeframe: Timeframe): TimeframeCandles {
  return { timeframe, candles: [], quality: "unavailable" };
}

const BULLISH = [100, 102, 106, 103, 100, 104, 108, 112, 109, 106, 110, 114, 118, 115, 112, 116, 120, 124];
const BEARISH = BULLISH.map((v) => 224 - v);

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

scenario("All 4 timeframes cleanly bullish -> strongly_bullish, fully_aligned, max weighted score", () => {
  const result = composeStructureInterpretation(computeStructure("TEST", history({})));
  assert.equal(result.overall, "strongly_bullish");
  assert.equal(result.alignment, "fully_aligned");
});

scenario("Daily+H4 bullish (weight 7) outweigh H1+M15 bearish (weight 3) -> slightly_bullish overall, but alignment flags the conflict", () => {
  const result = composeStructureInterpretation(computeStructure("TEST", history({ h1: tf("h1", BEARISH), m15: tf("m15", BEARISH) })));
  assert.equal(result.overall, "slightly_bullish");
  assert.equal(result.alignment, "conflicting");
});

scenario("All 4 timeframes cleanly bearish -> strongly_bearish, fully_aligned", () => {
  const result = composeStructureInterpretation(computeStructure("TEST", history({ daily: tf("daily", BEARISH), h4: tf("h4", BEARISH), h1: tf("h1", BEARISH), m15: tf("m15", BEARISH) })));
  assert.equal(result.overall, "strongly_bearish");
  assert.equal(result.alignment, "fully_aligned");
});

scenario("Every timeframe unavailable -> unresolved, alignment unknown, never fabricated", () => {
  const noData: MultiTimeframeHistory = {
    symbol: "TEST",
    currentPrice: null,
    daily: unavailableTf("daily"),
    h4: unavailableTf("h4"),
    h1: unavailableTf("h1"),
    m15: unavailableTf("m15"),
    weeklyCandles: [],
  };
  const result = composeStructureInterpretation(computeStructure("TEST", noData));
  assert.equal(result.overall, "unresolved");
  assert.equal(result.alignment, "unknown");
});

scenario("Only Daily available (bullish) -> a less extreme verdict than full agreement (fewer timeframes = less confidence, never forced to strongly_bullish)", () => {
  const result = composeStructureInterpretation(
    computeStructure("TEST", history({ h4: unavailableTf("h4"), h1: unavailableTf("h1"), m15: unavailableTf("m15") }))
  );
  assert.equal(result.overall, "slightly_bullish"); // weighted score = 4 (Daily only), below the strong threshold of 6
});

scenario("primaryCondition/executionCondition/lowerTimeframeCondition are populated per timeframe", () => {
  const result = composeStructureInterpretation(computeStructure("TEST", history({})));
  assert.ok(result.primaryCondition.startsWith("Daily"));
  assert.ok(result.executionCondition.startsWith("H4"));
  assert.ok(result.lowerTimeframeCondition.includes("H1") && result.lowerTimeframeCondition.includes("M15"));
});

console.log(`\n${pass} scenario(s) passed.`);
