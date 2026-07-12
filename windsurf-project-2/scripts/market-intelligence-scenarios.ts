import assert from "node:assert/strict";
import {
  normalizeNews,
  normalizeCalendar,
  normalizeImpact,
  normalizeInstrumentFromTD,
  scoreNewsRelevance,
  dedupeNews,
  topGlobalNews,
  newsForInstrument,
} from "../src/lib/market/marketIntelligence";
import { buildUnavailableIntelligence, isMarketIntelligence } from "../src/lib/market/types";
import { FinnhubRawNews, FinnhubRawEvent } from "../src/lib/market/providers/finnhub";
import { TwelveDataResult } from "../src/lib/market/providers/twelvedata";

// ============================================================
// PropEdge — Market Intelligence deterministic scenarios
// ============================================================
// No network. Every provider response is a fixture; we assert the pure
// normalizers produce the right normalized shapes and safe fallbacks.
// Run: npx tsx scripts/market-intelligence-scenarios.ts

let pass = 0;
function scenario(name: string, fn: () => void) {
  fn();
  pass++;
  console.log(`  ok — ${name}`);
}

const UNIX_NOW = Math.floor(Date.now() / 1000);

// ── News fixtures ─────────────────────────────────────────────────────────

function news(overrides: Partial<FinnhubRawNews>): FinnhubRawNews {
  return { id: Math.floor(Math.random() * 1e9), datetime: UNIX_NOW, headline: "", summary: "", source: "Reuters", url: "https://x", ...overrides };
}

scenario("Relevant news is scored + tagged; unrelated is filtered out", () => {
  const raw: FinnhubRawNews[] = [
    news({ id: 1, headline: "Gold climbs as Federal Reserve signals a rate cut", summary: "Bullion rallies" }),
    news({ id: 2, headline: "ECB holds rates; EUR/USD ticks higher" }),
    news({ id: 3, headline: "Local bakery opens third location downtown" }), // unrelated
  ];
  const out = normalizeNews(raw);
  const headlines = out.map((n) => n.headline);
  assert.ok(headlines.some((h) => h.includes("Gold")), "gold story kept");
  assert.ok(headlines.some((h) => h.includes("ECB")), "ecb story kept");
  assert.ok(!headlines.some((h) => h.includes("bakery")), "unrelated story dropped");
  const gold = out.find((n) => n.headline.includes("Gold"))!;
  assert.ok(gold.relatedInstruments.includes("XAUUSD"), "gold tagged XAUUSD");
  assert.ok(gold.relatedInstruments.includes("NDX"), "macro (Fed) also tags index instruments");
  assert.ok(gold.relevanceScore > 0);
});

scenario("A company merely listed on Nasdaq is NOT tagged as NDX", () => {
  const { instruments } = scoreNewsRelevance("Acme Corp, a Nasdaq-listed biotech, reports earnings", "");
  assert.ok(!instruments.includes("NDX"), "bare 'Nasdaq' mention must not tag NDX");
  const { instruments: idx } = scoreNewsRelevance("Nasdaq 100 falls 2% on tech selloff", "");
  assert.ok(idx.includes("NDX"), "explicit 'Nasdaq 100' tags NDX");
});

scenario("'gold' word-boundary does not false-match 'Goldman'", () => {
  const { instruments } = scoreNewsRelevance("Goldman Sachs raises price target on Apple", "");
  assert.ok(!instruments.includes("XAUUSD"), "'Goldman' must not tag gold");
});

scenario("Duplicate / reprinted headlines dedupe to one", () => {
  const raw: FinnhubRawNews[] = [
    news({ id: 10, headline: "Fed signals interest rate cut in 2026", source: "Reuters" }),
    news({ id: 11, headline: "Fed signals interest rate cut in 2026", source: "Bloomberg" }),
    news({ id: 12, headline: "Fed  signals  interest  rate  cut  in  2026!!", source: "CNBC" }), // punctuation/space variant
  ];
  const out = normalizeNews(raw);
  const fedItems = out.filter((n) => n.headline.toLowerCase().includes("interest rate cut"));
  assert.equal(fedItems.length, 1, "near-identical headlines collapse to one");
});

scenario("Display caps: 3 global, 2 per instrument", () => {
  const raw: FinnhubRawNews[] = [];
  for (let i = 0; i < 6; i++) raw.push(news({ id: 100 + i, headline: `Gold update ${i} amid Fed policy`, summary: "" }));
  for (let i = 0; i < 6; i++) raw.push(news({ id: 200 + i, headline: `EUR/USD note ${i} from the ECB`, summary: "" }));
  const out = normalizeNews(raw);
  assert.ok(topGlobalNews(out).length <= 3, "global capped at 3");
  assert.ok(newsForInstrument(out, "XAUUSD").length <= 2, "per-instrument capped at 2");
  assert.ok(newsForInstrument(out, "EURUSD").every((n) => n.relatedInstruments.includes("EURUSD")));
});

scenario("Malformed news items don't throw and are skipped", () => {
  const raw = [{}, { headline: "" }, { headline: "   " }, news({ headline: "Gold rises on inflation data" })] as FinnhubRawNews[];
  const out = normalizeNews(raw);
  assert.equal(out.length, 1, "only the one real, relevant item survives");
});

// ── Economic calendar fixtures ─────────────────────────────────────────────

scenario("Valid economic calendar normalizes with tz-agnostic ISO", () => {
  const raw: FinnhubRawEvent[] = [
    { event: "CPI y/y", country: "US", currency: "USD", time: "2026-07-12 12:30:00", impact: "high", prev: 3.1, estimate: 3.0, actual: 2.9 },
  ];
  const [e] = normalizeCalendar(raw);
  assert.equal(e.title, "CPI y/y");
  assert.equal(e.currency, "USD");
  assert.equal(e.impact, "high");
  assert.equal(e.scheduledAt, "2026-07-12T12:30:00Z");
  assert.equal(e.actual, 2.9);
  assert.equal(e.source, "finnhub");
});

scenario("Empty calendar returns []", () => {
  assert.deepEqual(normalizeCalendar([]), []);
});

scenario("Missing / unreliable impact becomes 'unknown' (never promoted)", () => {
  assert.equal(normalizeImpact(undefined), "unknown");
  assert.equal(normalizeImpact(""), "unknown");
  assert.equal(normalizeImpact("3"), "unknown"); // numeric string is not a trusted impact
  assert.equal(normalizeImpact("HIGH"), "high");
  assert.equal(normalizeImpact("Medium"), "medium");
  const [e] = normalizeCalendar([{ event: "Some speech", time: "2026-07-12 09:00:00" }]);
  assert.equal(e.impact, "unknown");
});

// ── Instrument price / key-level fixtures ──────────────────────────────────

function tdOk(symbol: string): TwelveDataResult {
  return {
    error: null,
    data: {
      symbol,
      candles: [
        { datetime: "2026-07-12", open: 1.14174, high: 1.14197, low: 1.14136, close: 1.14172 },
        { datetime: "2026-07-11", open: 1.142, high: 1.1435, low: 1.1402, close: 1.1418 },
      ],
    },
  };
}

scenario("Available FX normalizes to price + key levels from real OHLC", () => {
  const d = normalizeInstrumentFromTD("EURUSD", tdOk("EUR/USD"));
  assert.equal(d.status, "available");
  assert.equal(d.provider, "twelvedata");
  assert.equal(d.currentPrice, 1.14172);
  assert.equal(d.dailyOpen, 1.14174);
  assert.equal(d.previousClose, 1.1418);
  assert.ok(d.keyLevels);
  assert.equal(d.keyLevels!.previousDayHigh, 1.1435);
  assert.equal(d.keyLevels!.previousDayLow, 1.1402);
  assert.equal(d.keyLevels!.previousDayClose, 1.1418);
});

scenario("Unavailable symbol (404/premium) -> explicit unavailable, no invented data", () => {
  const d = normalizeInstrumentFromTD("NDX", { data: null, error: { domain: "prices", code: "unavailable_symbol", message: "not on plan" } });
  assert.equal(d.status, "unavailable");
  assert.equal(d.provider, null);
  assert.equal(d.currentPrice, null);
  assert.equal(d.keyLevels, null); // -> UI shows "Key levels unavailable from current provider."
});

scenario("Incomplete OHLC: current price shown, missing levels stay null", () => {
  const partial: TwelveDataResult = {
    error: null,
    data: { symbol: "XAU/USD", candles: [{ datetime: "2026-07-12", open: null, high: null, low: null, close: 4111.5 }] },
  };
  const d = normalizeInstrumentFromTD("XAUUSD", partial);
  assert.equal(d.status, "available");
  assert.equal(d.currentPrice, 4111.5);
  assert.equal(d.dailyOpen, null);
  // No previous candle -> no prev-day levels; keyLevels is null (nothing real to show).
  assert.equal(d.keyLevels, null);
});

// ── Error / fallback fixtures ──────────────────────────────────────────────

scenario("Safe unavailable fallback is a well-formed MarketIntelligence", () => {
  const fb = buildUnavailableIntelligence("Europe/Paris", [{ domain: "prices", code: "429", message: "rate limited" }]);
  assert.equal(fb.status, "unavailable");
  assert.equal(fb.timezone, "Europe/Paris");
  assert.equal(fb.sentiment.label, "unknown");
  assert.equal(fb.sentiment.methodology, "not_configured");
  assert.equal(fb.instruments.NDX.status, "unavailable");
  assert.equal(fb.provider, "finnhub");
  assert.ok(isMarketIntelligence(fb), "passes the client-side shape guard");
  assert.equal(fb.errors[0].code, "429");
});

scenario("Shape guard rejects malformed API payloads", () => {
  assert.equal(isMarketIntelligence(null), false);
  assert.equal(isMarketIntelligence({ date: "x" }), false);
  assert.equal(isMarketIntelligence("nope"), false);
});

scenario("dedupeNews is order-stable and keeps the first occurrence", () => {
  const a = normalizeNews([news({ id: 1, headline: "Gold up on Fed", source: "A" }), news({ id: 2, headline: "Gold up on Fed", source: "B" })]);
  assert.equal(a.length, 1);
  assert.equal(a[0].sourceName, "A");
  // dedupe of an already-unique list is a no-op
  assert.equal(dedupeNews(a).length, 1);
});

console.log(`\n${pass} scenario(s) passed.`);
