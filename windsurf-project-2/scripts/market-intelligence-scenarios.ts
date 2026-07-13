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
  buildInstrumentMarketDataFromHistory,
  buildInstrumentMarketDataFromGatewayResult,
  summarizePricesProvider,
} from "../src/lib/market/marketIntelligence";
import {
  computeKeyLevelDistances,
  findNearestLevel,
  computeStructuralBias,
  buildMarketContextInsight,
  buildMarketContext,
} from "../src/lib/market/marketContext";
import { buildUnavailableIntelligence, isMarketIntelligence, KeyLevels, InstrumentMarketHistory } from "../src/lib/market/types";
import { FinnhubRawNews, FinnhubRawEvent } from "../src/lib/market/providers/finnhub";
import { TwelveDataResult } from "../src/lib/market/providers/twelvedata";
import { MarketDataGatewayResult } from "../src/lib/market/marketDataGateway";

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

function tdWeeklyOk(symbol: string): TwelveDataResult {
  return {
    error: null,
    data: {
      symbol,
      candles: [
        { datetime: "2026-07-06", open: 1.144, high: 1.146, low: 1.139, close: 1.14172 }, // this week (forming)
        { datetime: "2026-06-29", open: 1.135, high: 1.15, low: 1.128, close: 1.144 }, // previous complete week
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
  // No weekly fixture passed -> weekly fields stay null, never guessed.
  assert.equal(d.keyLevels!.weeklyOpen, null);
});

scenario("Weekly candles merge into keyLevels + drive marketContext", () => {
  const d = normalizeInstrumentFromTD("EURUSD", tdOk("EUR/USD"), tdWeeklyOk("EUR/USD"));
  assert.equal(d.keyLevels!.weeklyOpen, 1.144);
  assert.equal(d.keyLevels!.previousWeekHigh, 1.15);
  assert.equal(d.keyLevels!.previousWeekLow, 1.128);
  assert.ok(d.marketContext, "marketContext computed once price+levels are available");
});

scenario("Unavailable symbol (404/premium) -> explicit unavailable, no invented data", () => {
  const d = normalizeInstrumentFromTD("NDX", { data: null, error: { domain: "prices", code: "unavailable_symbol", message: "not on plan" } });
  assert.equal(d.status, "unavailable");
  assert.equal(d.provider, null);
  assert.equal(d.currentPrice, null);
  assert.equal(d.keyLevels, null); // -> UI shows "Key levels unavailable from current provider."
  assert.equal(d.marketContext, null);
});

scenario("Weekly fetch failure alone does not make the instrument unavailable", () => {
  const d = normalizeInstrumentFromTD("XAUUSD", tdOk("XAU/USD"), { data: null, error: { domain: "prices", code: "429", message: "rate limited" } });
  assert.equal(d.status, "available", "daily succeeded, so the instrument is still available");
  assert.equal(d.keyLevels!.weeklyOpen, null, "weekly fields stay null, never guessed");
  assert.equal(d.keyLevels!.dailyOpen, 1.14174, "daily levels are unaffected by the weekly failure");
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
  assert.equal(d.marketContext, null);
});

// ── Market Context fixtures ─────────────────────────────────────────────────

const FULL_LEVELS: KeyLevels = {
  dailyOpen: 100,
  previousDayHigh: 105,
  previousDayLow: 95,
  previousDayClose: 99,
  weeklyOpen: 98,
  previousWeekHigh: 110,
  previousWeekLow: 90,
};

// currentPrice 99.2 is unambiguously closest to Prev Day Close (99): |0.2|
// vs. |0.8| to Daily Open (100) and everything else farther still.
const NEAR_PREV_CLOSE_PRICE = 99.2;

scenario("computeKeyLevelDistances: sorted nearest-first, nulls excluded", () => {
  const distances = computeKeyLevelDistances(NEAR_PREV_CLOSE_PRICE, FULL_LEVELS);
  assert.equal(distances.length, 7, "all 7 real levels included");
  assert.equal(distances[0].label, "Prev Day Close", "closest level (|99.2-99|=0.2) sorts first");
  assert.ok(distances.every((d, i) => i === 0 || Math.abs(d.distance) >= Math.abs(distances[i - 1].distance)), "non-decreasing |distance|");

  const partial: KeyLevels = { ...FULL_LEVELS, weeklyOpen: null, previousWeekHigh: null, previousWeekLow: null };
  const partialDistances = computeKeyLevelDistances(NEAR_PREV_CLOSE_PRICE, partial);
  assert.equal(partialDistances.length, 4, "only the 4 daily levels — weekly nulls excluded, never zero-filled");
});

scenario("findNearestLevel returns the closest, or null with no data", () => {
  const nearest = findNearestLevel(computeKeyLevelDistances(NEAR_PREV_CLOSE_PRICE, FULL_LEVELS));
  assert.equal(nearest!.label, "Prev Day Close");
  assert.equal(findNearestLevel([]), null);
});

scenario("computeStructuralBias: bullish/bearish/neutral/unknown", () => {
  assert.equal(computeStructuralBias(102, FULL_LEVELS), "bullish", "above both weekly (98) and daily (100) open");
  assert.equal(computeStructuralBias(97, FULL_LEVELS), "bearish", "below both weekly (98) and daily (100) open");
  assert.equal(computeStructuralBias(99, FULL_LEVELS), "neutral", "above weekly open but below daily open — split");
  assert.equal(computeStructuralBias(101, { ...FULL_LEVELS, weeklyOpen: null }), "unknown", "missing weeklyOpen -> never guessed");
});

scenario("buildMarketContextInsight is one concise deterministic sentence per case", () => {
  const nearest = findNearestLevel(computeKeyLevelDistances(NEAR_PREV_CLOSE_PRICE, FULL_LEVELS))!;
  const full = buildMarketContextInsight("EURUSD", "bullish", nearest);
  assert.ok(full.startsWith("EURUSD is holding above both its weekly and daily open"));
  assert.ok(full.includes("Prev Day Close"));
  assert.ok(full.trim().endsWith("."), "ends as a single closed sentence");
  assert.ok(full.split(". ").length === 1, "no sentence break — one concise sentence, not a paragraph");
  assert.ok(full.length < 200, "concise, not a paragraph");

  const noLevel = buildMarketContextInsight("EURUSD", "bullish", null);
  assert.ok(noLevel.startsWith("EURUSD is holding above"), "degrades gracefully with bias only");

  const noBias = buildMarketContextInsight("EURUSD", "unknown", nearest);
  assert.ok(!noBias.includes("holding"), "no bias clause when bias is unknown");

  const nothing = buildMarketContextInsight("EURUSD", "unknown", null);
  assert.ok(nothing.includes("Not enough key-level data"), "honest empty state, never a fabricated read");
});

scenario("buildMarketContext returns null without a live price or levels", () => {
  assert.equal(buildMarketContext("EURUSD", null, FULL_LEVELS), null);
  assert.equal(buildMarketContext("EURUSD", 101, null), null);
  const ctx = buildMarketContext("EURUSD", 101, FULL_LEVELS)!;
  assert.ok(ctx);
  assert.equal(ctx.distances.length, 7);
  assert.equal(ctx.bias, "bullish");
});

// ── Error / fallback fixtures ──────────────────────────────────────────────

scenario("Safe unavailable fallback is a well-formed MarketIntelligence with explicit null providers", () => {
  const fb = buildUnavailableIntelligence("Europe/Paris", [{ domain: "prices", code: "429", message: "rate limited" }]);
  assert.equal(fb.status, "unavailable");
  assert.equal(fb.timezone, "Europe/Paris");
  assert.equal(fb.sentiment.label, "unknown");
  assert.equal(fb.sentiment.methodology, "not_configured");
  assert.equal(fb.instruments.NDX.status, "unavailable");
  assert.deepEqual(fb.providers, { news: null, calendar: null, prices: null }, "no domain silently claims a provider it didn't get data from");
  assert.ok(isMarketIntelligence(fb), "passes the client-side shape guard");
  assert.equal(fb.errors[0].code, "429");
});

scenario("Providers attribution is per-domain, never one global value", () => {
  // Mirrors today's real state on these keys: news works, calendar is
  // paid-only, prices work via TwelveData — three different truths, not one
  // "provider: finnhub" field that would misrepresent calendar and prices.
  const providers = { news: "finnhub" as const, calendar: null, prices: "twelvedata" as const };
  assert.equal(providers.news, "finnhub");
  assert.equal(providers.calendar, null);
  assert.equal(providers.prices, "twelvedata");
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

// ── Market Data Gateway integration ───────────────────────────────────────

function marketCandle(datetime: string, close: number) {
  return { datetime, open: close, high: close, low: close, close };
}

function historyFixture(symbol: string, dailyCloses: number[]): InstrumentMarketHistory {
  return {
    symbol,
    currentPrice: dailyCloses[0] ?? null,
    dailyCandles: dailyCloses.map((c, i) => marketCandle(`2026-07-${13 - i}`, c)),
    weeklyCandles: [marketCandle("2026-07-13", dailyCloses[0] ?? 0), marketCandle("2026-07-06", dailyCloses[1] ?? 0)],
    dataQuality: { dailyHistory: "complete", weeklyHistory: "complete" },
  };
}

scenario("buildInstrumentMarketDataFromHistory reads current price/key levels from MarketCandle[], provider-agnostic", () => {
  const history = historyFixture("EURUSD", [1.14, 1.13]);
  const data = buildInstrumentMarketDataFromHistory("EURUSD", history, "alphavantage");
  assert.equal(data.status, "available");
  assert.equal(data.currentPrice, 1.14);
  assert.equal(data.provider, "alphavantage");
  assert.equal(data.keyLevels?.previousDayClose, 1.13);
  assert.notEqual(data.marketContext, null);
});

scenario("buildInstrumentMarketDataFromHistory: empty history -> unavailableInstrument", () => {
  const history: InstrumentMarketHistory = {
    symbol: "EURUSD",
    currentPrice: null,
    dailyCandles: [],
    weeklyCandles: [],
    dataQuality: { dailyHistory: "unavailable", weeklyHistory: "unavailable" },
  };
  const data = buildInstrumentMarketDataFromHistory("EURUSD", history, null);
  assert.equal(data.status, "unavailable");
  assert.equal(data.provider, null);
});

scenario("buildInstrumentMarketDataFromGatewayResult relabels the Gateway's internal symbol to the display symbol everywhere, including nested Pulse", () => {
  const gatewayResult: MarketDataGatewayResult = {
    symbol: "DJI",
    history: historyFixture("DJI", [44500, 44300]),
    meta: { providerUsed: "fmp", fallbackUsed: false, primaryFailure: null },
  };
  const data = buildInstrumentMarketDataFromGatewayResult("US30", gatewayResult);
  assert.equal(data.symbol, "US30");
  assert.equal(data.provider, "fmp");
  assert.equal(data.marketPulse?.symbol, "US30", "nested Pulse must use the display symbol, never the Gateway's internal 'DJI'");
  assert.equal(data.marketPulse?.regime.symbol, "US30");
});

scenario("buildInstrumentMarketDataFromGatewayResult: Gateway failure -> unavailable, but Pulse is still attempted and honestly reports unavailable", () => {
  const gatewayResult: MarketDataGatewayResult = {
    symbol: "DJI",
    history: { symbol: "DJI", currentPrice: null, dailyCandles: [], weeklyCandles: [], dataQuality: { dailyHistory: "unavailable", weeklyHistory: "unavailable" } },
    meta: { providerUsed: "none", fallbackUsed: false, primaryFailure: { domain: "prices", code: "402", message: "plan restricted" } },
  };
  const data = buildInstrumentMarketDataFromGatewayResult("US30", gatewayResult);
  assert.equal(data.status, "unavailable");
  assert.equal(data.marketPulse?.status, "unavailable");
  assert.equal(data.marketPulse?.symbol, "US30");
});

scenario("summarizePricesProvider prefers TwelveData, then Alpha Vantage, then FMP", () => {
  assert.equal(summarizePricesProvider(["twelvedata", "fmp", null]), "twelvedata");
  assert.equal(summarizePricesProvider(["alphavantage", "fmp"]), "alphavantage");
  assert.equal(summarizePricesProvider(["fmp", null]), "fmp");
  assert.equal(summarizePricesProvider([null, null]), null);
});

console.log(`\n${pass} scenario(s) passed.`);
