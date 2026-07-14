import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getMarketDataFromGateway } from "../src/lib/market/marketDataGateway";
import { getTimeframeGatewayHistory } from "../src/lib/edge-pulse/timeframeGateway";
import { computeStructure, TimeframeStructureRow } from "../src/lib/edge-pulse/engines/structureEngine";
import { classifyStructureCondition, composeStructureInterpretation } from "../src/lib/edge-pulse/engines/structureInterpretationEngine";
import { MultiTimeframeHistory } from "../src/lib/edge-pulse/types";

// ============================================================
// Edge Pulse — XAUUSD live Market Structure calibration (ONE-OFF, NETWORK)
// ============================================================
// Not a deterministic scenario script. Hits the real TwelveData API to
// exercise the CORRECTED structureEngine.ts (Sprint 2 / Phase 2) against
// real D1/H4/H1/M15 XAUUSD data and prints the actual computeStructure()
// output — sequence trend, correction/reversal, BOS/CHoCH, phase
// surfacing, and timeframe hierarchy — for direct before/after comparison
// against the Phase 1 audit's live findings.
// Run: npx tsx scripts/xauusd-structure-calibration.ts

function loadEnvLocal() {
  try {
    const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf-8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {
    // ignore
  }
}
loadEnvLocal();

function printRow(row: TimeframeStructureRow) {
  console.log(`\n──────────── ${row.label} ────────────`);
  console.log(`quality: ${row.quality}`);
  if (row.quality === "unavailable") {
    console.log("(unavailable on this plan/route for this timeframe)");
    return;
  }
  console.log(`bias (existing UI label, unchanged): ${row.bias} (${row.color})`);
  console.log(`latestHH=${row.latestHH} latestHL=${row.latestHL} latestLH=${row.latestLH} latestLL=${row.latestLL}`);

  console.log(`\nSequence trend (3-5 swing read, NEW): ${row.sequenceTrend} (consistency: ${row.sequenceConsistency})`);
  console.log(`Higher-timeframe alignment: ${row.higherTimeframeAlignment}`);

  console.log(`\nCompression: ${row.compression} | Expansion: ${row.expansion} | Rotation: ${row.rotation} | Correction: ${row.correction}`);

  console.log(`\nLast BOS: ${row.lastBOS ? `${row.lastBOS.direction} at ${row.lastBOS.price} (broken swing formed ${row.lastBOS.brokenSwingDatetime}, confirmed ${row.lastBOS.confirmedAt})` : "(none)"}`);
  console.log(`Last CHoCH: ${row.lastCHoCH ? `${row.lastCHoCH.direction} at ${row.lastCHoCH.price} (broken swing formed ${row.lastCHoCH.brokenSwingDatetime}, confirmed ${row.lastCHoCH.confirmedAt})` : "(none)"}`);
  console.log(`Last Failed Break: ${row.lastFailedBreak ? `${row.lastFailedBreak.direction} at ${row.lastFailedBreak.price} (${row.lastFailedBreak.candleDatetime})` : "(none)"}`);
  console.log(`Reversal confirmed: ${row.reversal}`);
  console.log(`Secondary condition (Sprint 2 / Phase 3, NEW): ${classifyStructureCondition(row) ?? "(none — existing bias label already captures this cleanly)"}`);
}

async function main() {
  const symbol = "XAUUSD";
  const [dailyWeekly, intraday] = await Promise.all([getMarketDataFromGateway(symbol), getTimeframeGatewayHistory(symbol)]);

  const history: MultiTimeframeHistory = {
    symbol,
    currentPrice: dailyWeekly.history.currentPrice,
    daily: { timeframe: "daily", candles: dailyWeekly.history.dailyCandles, quality: dailyWeekly.history.dataQuality.dailyHistory },
    h4: intraday.intraday.h4,
    h1: intraday.intraday.h1,
    m15: intraday.intraday.m15,
    weeklyCandles: dailyWeekly.history.weeklyCandles,
  };

  console.log(`XAUUSD — currentPrice: ${history.currentPrice}`);
  const structure = computeStructure(symbol, history);
  console.log(`\noverall disagreement (existing field): ${structure.disagreement}`);

  structure.rows.forEach(printRow);

  console.log("\n\n==================== Overall Structure Interpretation (Sprint 2 / Phase 3, NEW) ====================");
  const interpretation = composeStructureInterpretation(structure);
  console.log(`overall: ${interpretation.overall}`);
  console.log(`alignment: ${interpretation.alignment}`);
  console.log(`primaryCondition (D1): ${interpretation.primaryCondition}`);
  console.log(`executionCondition (H4): ${interpretation.executionCondition}`);
  console.log(`lowerTimeframeCondition (H1+M15): ${interpretation.lowerTimeframeCondition}`);
  console.log("evidence:");
  interpretation.evidence.forEach((e) => console.log(`  - ${e}`));
}

main().catch((err) => {
  console.error("Calibration run failed:", err);
  process.exit(1);
});
