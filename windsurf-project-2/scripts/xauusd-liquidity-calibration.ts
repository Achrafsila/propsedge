import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getMarketDataFromGateway } from "../src/lib/market/marketDataGateway";
import { getTimeframeGatewayHistory } from "../src/lib/edge-pulse/timeframeGateway";
import { computeMultiTimeframeLiquidity, LiquidityLevel, TimeframeLiquidityReport } from "../src/lib/edge-pulse/engines/liquidityEngine";
import { MultiTimeframeHistory } from "../src/lib/edge-pulse/types";

// ============================================================
// Edge Pulse — XAUUSD live liquidity calibration (ONE-OFF, NETWORK)
// ============================================================
// Not a deterministic scenario script — hits the real TwelveData API
// (same convention as scripts/verify-twelvedata-intraday.ts) to exercise
// the new candidate-based Liquidity Engine against real D1/H4/H1/M15
// XAUUSD data and print the report required by Sprint 1 / Phase 2 §7.
// Run: npx tsx scripts/xauusd-liquidity-calibration.ts

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

function fmtLevel(l: LiquidityLevel | null): string {
  if (!l) return "  (none)";
  const cluster = l.equalLevelCount ? ` [${l.equalLevelCount}-member cluster: ${l.equalLevelMembers?.join(", ")}]` : "";
  return [
    `  timeframe=${l.timeframe}`,
    `side=${l.side}`,
    `origin=${l.origin}${cluster}`,
    `price=${l.price}`,
    `state=${l.state}`,
    `strength=${l.strength}`,
    `distance=${l.distance} (${l.distancePercent}%)`,
    `formedAt=${l.formedAt}`,
  ].join(" | ");
}

function printTimeframeReport(report: TimeframeLiquidityReport) {
  console.log(`\n──────────── ${report.timeframe} ────────────`);
  console.log(`quality: ${report.quality}`);
  console.log(`currentPrice: ${report.currentPrice}`);
  if (report.quality === "unavailable") {
    console.log("(unavailable on this plan/route for this timeframe — honestly empty, not fabricated)");
    return;
  }
  console.log(`activeRange: ${report.activeRange ? `[${report.activeRange.low}, ${report.activeRange.high}]` : "(none)"}`);

  console.log("\nNearest active buy-side (external boundary, any active state):");
  console.log(fmtLevel(report.externalLiquidity.find((l) => l.side === "buy_side") ?? null));
  console.log("Nearest active sell-side (external boundary, any active state):");
  console.log(fmtLevel(report.externalLiquidity.find((l) => l.side === "sell_side") ?? null));

  console.log("\nNearest UNTOUCHED buy-side:");
  console.log(fmtLevel(report.nearestUntouchedBuySide));
  console.log("Strongest UNTOUCHED buy-side:");
  console.log(fmtLevel(report.strongestUntouchedBuySide));
  console.log("Nearest UNTOUCHED sell-side:");
  console.log(fmtLevel(report.nearestUntouchedSellSide));
  console.log("Strongest UNTOUCHED sell-side:");
  console.log(fmtLevel(report.strongestUntouchedSellSide));

  console.log("\nLatest valid sweep:");
  console.log(fmtLevel(report.latestValidSweep));

  console.log(`\nInternal liquidity (${report.internalLiquidity.length}):`);
  report.internalLiquidity.forEach((l) => console.log(fmtLevel(l)));

  console.log(`\nAll active candidates (${report.candidates.length}) — consumed/invalidated already excluded:`);
  report.candidates
    .slice()
    .sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance))
    .forEach((l) => console.log(fmtLevel(l)));
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

  console.log(`XAUUSD — provider used: ${dailyWeekly.meta.providerUsed}, currentPrice: ${history.currentPrice}`);
  console.log(`Daily quality: ${history.daily.quality}, H4: ${history.h4.quality}, H1: ${history.h1.quality}, M15: ${history.m15.quality}`);

  const result = computeMultiTimeframeLiquidity(symbol, history, history.currentPrice);

  printTimeframeReport(result.d1);
  printTimeframeReport(result.h4);
  printTimeframeReport(result.h1);
  printTimeframeReport(result.m15);

  // ── Specific investigation: the 4195 and 4122 levels from the Part 1 audit ──
  console.log("\n\n==================== INVESTIGATION: 4195 / 4122 ====================");
  const allLevels = [...result.d1.candidates, ...result.h4.candidates, ...result.h1.candidates, ...result.m15.candidates];
  const near4195 = allLevels.filter((l) => Math.abs(l.price - 4195) < 15);
  const near4122 = allLevels.filter((l) => Math.abs(l.price - 4122) < 15);
  console.log("\nActive candidates near 4195 (within 15):");
  near4195.forEach((l) => console.log(fmtLevel(l)));
  if (near4195.length === 0) console.log("  (none active — was this level consumed/invalidated since the Part 1 audit? see full candidate dump above)");
  console.log("\nActive candidates near 4122 (within 15):");
  near4122.forEach((l) => console.log(fmtLevel(l)));
  if (near4122.length === 0) console.log("  (none active — matches the Part 1 audit finding that 4122 was a sweep later fully broken; now correctly excluded as consumed)");

  console.log("\nNearer H4 highs above current price:");
  result.h4.candidates.filter((l) => l.side === "buy_side").sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance)).slice(0, 3).forEach((l) => console.log(fmtLevel(l)));
  console.log("\nNearer H1 highs above current price:");
  result.h1.candidates.filter((l) => l.side === "buy_side").sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance)).slice(0, 3).forEach((l) => console.log(fmtLevel(l)));
  console.log("\nNearer H4 lows below current price:");
  result.h4.candidates.filter((l) => l.side === "sell_side").sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance)).slice(0, 3).forEach((l) => console.log(fmtLevel(l)));
  console.log("\nNearer H1 lows below current price:");
  result.h1.candidates.filter((l) => l.side === "sell_side").sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance)).slice(0, 3).forEach((l) => console.log(fmtLevel(l)));
}

main().catch((err) => {
  console.error("Calibration run failed:", err);
  process.exit(1);
});
