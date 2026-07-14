// ============================================================
// PropEdge — TwelveData intraday feasibility probe (ONE-OFF, NETWORK)
// ============================================================
// NOT a deterministic scenario script — this hits the real TwelveData API
// with the real key in .env.local to answer one question before the Edge
// Pulse multi-timeframe engines are designed: does the current plan/key
// actually serve 4h/1h/15min OHLC for EUR/USD and XAU/USD? Prints raw
// status + first candles + any rate-limit headers. Run once, read the
// output, then this script's findings get baked into timeframeGateway.ts —
// it is not part of the regular scenario suite and is never run in CI.
//
// Run: npx tsx scripts/verify-twelvedata-intraday.ts  (needs .env.local)

import { readFileSync } from "node:fs";
import { join } from "node:path";

function loadEnvLocal() {
  try {
    const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf-8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {
    // ignore — env may already be set another way
  }
}
loadEnvLocal();

const KEY = process.env.TWELVEDATA_API_KEY;
if (!KEY) {
  console.error("TWELVEDATA_API_KEY not set (checked process.env and .env.local). Aborting.");
  process.exit(1);
}

const SYMBOLS = ["EUR/USD", "XAU/USD"];
const INTERVALS = ["4h", "1h", "15min", "1month"];

async function probe(symbol: string, interval: string) {
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=10&apikey=${KEY}`;
  const res = await fetch(url);
  const rateHeaders: Record<string, string> = {};
  for (const [k, v] of res.headers.entries()) {
    if (k.toLowerCase().includes("rate") || k.toLowerCase().includes("credit") || k.toLowerCase().includes("limit")) {
      rateHeaders[k] = v;
    }
  }
  const body: any = await res.json().catch(() => ({}));
  const values = Array.isArray(body?.values) ? body.values : [];
  console.log(`\n--- ${symbol} @ ${interval} ---`);
  console.log(`HTTP ${res.status}${body?.status ? ` | body.status=${body.status}` : ""}${body?.code ? ` | body.code=${body.code}` : ""}${body?.message ? ` | message=${body.message}` : ""}`);
  if (Object.keys(rateHeaders).length) console.log("rate/limit headers:", JSON.stringify(rateHeaders));
  if (values.length > 0) {
    console.log(`values.length=${values.length}, first 2:`, JSON.stringify(values.slice(0, 2)));
  } else {
    console.log("no values returned");
  }
}

async function main() {
  for (const symbol of SYMBOLS) {
    for (const interval of INTERVALS) {
      await probe(symbol, interval);
      // small delay to be polite to the free/low tier rate limiter
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
}

main().catch((err) => {
  console.error("Probe failed:", err);
  process.exit(1);
});
