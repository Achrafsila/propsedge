import {
  MarketIntelligence,
  MarketNewsItem,
  EconomicEvent,
  ImpactLevel,
  InstrumentMarketData,
  InstrumentKey,
  KeyLevels,
  MarketError,
  unavailableInstrument,
  notConfiguredSentiment,
  buildUnavailableIntelligence,
} from "./types";
import {
  fetchFinnhubGeneralNews,
  fetchFinnhubEconomicCalendar,
  FinnhubRawNews,
  FinnhubRawEvent,
} from "./providers/finnhub";
import { fetchTwelveDataDaily, TwelveDataResult } from "./providers/twelvedata";

// ============================================================
// PropEdge — Market Intelligence orchestrator (SERVER-ONLY)
// ============================================================
// Normalizes each provider's raw response into the provider-independent
// shapes in types.ts, applies deterministic relevance filtering, and
// assembles one MarketIntelligence object. Never invents data: a field is
// null / an instrument is "unavailable" whenever the provider didn't return
// it. All the normalizers here are pure and exported for the deterministic
// tests (scripts/market-intelligence-scenarios.ts).

const NEWS_LIST_CAP = 12; // UI slices 3 global + 2/instrument from this
const MAX_GLOBAL_NEWS = 3;
const MAX_INSTRUMENT_NEWS = 2;

// ── News relevance (deterministic keyword scoring) ────────────────────────
// Index keywords are intentionally specific ("nasdaq 100", not bare
// "nasdaq") so an unrelated company article that merely mentions it's
// Nasdaq-listed is NOT tagged as NDX market news (spec §4). "euro" alone is
// avoided for the same reason (ambiguous) in favour of eur/usd, ecb, etc.

interface RelevanceRule {
  keywords: string[];
  instruments: InstrumentKey[];
  weight: number;
}

const RELEVANCE_RULES: RelevanceRule[] = [
  // Macro USD — moves every USD-quoted instrument.
  {
    keywords: ["federal reserve", "fomc", "interest rate", "interest rates", "rate cut", "rate hike", "rate decision", "inflation", "treasury yield", "treasury yields", "u.s. dollar", "us dollar", "dollar index", "dxy", "nonfarm", "payrolls", "jobs report"],
    instruments: ["XAUUSD", "NDX", "US30", "EURUSD"],
    weight: 2,
  },
  { keywords: ["gold", "xau", "bullion"], instruments: ["XAUUSD"], weight: 3 },
  { keywords: ["nasdaq 100", "nasdaq-100", "nasdaq composite", "nasdaq index", "ndx"], instruments: ["NDX"], weight: 3 },
  { keywords: ["dow jones", "dow 30", "djia", "dow industrials", "us30"], instruments: ["US30"], weight: 3 },
  { keywords: ["eur/usd", "eurusd", "ecb", "european central bank", "eurozone", "euro zone", "lagarde"], instruments: ["EURUSD"], weight: 3 },
];

// Single alphanumeric tokens (gold, xau, ndx, djia, us30, eurusd…) match on
// a word boundary so "gold" doesn't hit "Goldman"; multi-word / symbol
// phrases ("nasdaq 100", "eur/usd") match as substrings.
function keywordHit(haystack: string, keyword: string): boolean {
  if (/^[a-z0-9]+$/.test(keyword)) return new RegExp(`\\b${keyword}\\b`, "i").test(haystack);
  return haystack.includes(keyword);
}

export function scoreNewsRelevance(headline: string, summary: string): { score: number; instruments: InstrumentKey[] } {
  const haystack = `${headline} ${summary}`.toLowerCase();
  let score = 0;
  const instruments = new Set<InstrumentKey>();
  for (const rule of RELEVANCE_RULES) {
    if (rule.keywords.some((k) => keywordHit(haystack, k))) {
      score += rule.weight;
      rule.instruments.forEach((i) => instruments.add(i));
    }
  }
  return { score, instruments: Array.from(instruments) };
}

function hashId(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
  return `finnhub-${(h >>> 0).toString(36)}`;
}

function isoFromUnixSeconds(sec: number | undefined): string {
  if (typeof sec !== "number" || sec <= 0) return "";
  const d = new Date(sec * 1000);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

// Collapses a headline to a comparison key so near-identical wire stories
// (same headline reprinted by multiple sources) dedupe to one.
function dedupeKey(headline: string): string {
  return headline.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 60);
}

export function dedupeNews(items: MarketNewsItem[]): MarketNewsItem[] {
  const seen = new Set<string>();
  const out: MarketNewsItem[] = [];
  for (const item of items) {
    const key = dedupeKey(item.headline);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function normalizeNews(raw: FinnhubRawNews[]): MarketNewsItem[] {
  const mapped: MarketNewsItem[] = raw.map((r) => {
    const headline = (r.headline ?? "").trim();
    const summary = (r.summary ?? "").trim();
    const { score, instruments } = scoreNewsRelevance(headline, summary);
    return {
      id: typeof r.id === "number" ? `finnhub-${r.id}` : hashId(`${r.url ?? ""}${headline}`),
      headline,
      summary: summary || null,
      sourceName: (r.source ?? "").trim(),
      publishedAt: isoFromUnixSeconds(r.datetime),
      url: (r.url ?? "").trim(),
      imageUrl: (r.image ?? "").trim() || null,
      relatedInstruments: instruments,
      relevanceScore: score,
      provider: "finnhub",
    };
  });

  const relevant = mapped.filter((n) => n.headline !== "" && n.relevanceScore > 0);
  const deduped = dedupeNews(relevant);
  deduped.sort((a, b) => b.relevanceScore - a.relevanceScore || b.publishedAt.localeCompare(a.publishedAt));
  return deduped.slice(0, NEWS_LIST_CAP);
}

// UI helpers (also exported for tests) — enforce the spec's display caps.
export function topGlobalNews(news: MarketNewsItem[]): MarketNewsItem[] {
  return news.slice(0, MAX_GLOBAL_NEWS);
}
export function newsForInstrument(news: MarketNewsItem[], instrument: InstrumentKey): MarketNewsItem[] {
  return news.filter((n) => n.relatedInstruments.includes(instrument)).slice(0, MAX_INSTRUMENT_NEWS);
}

// ── Economic calendar ─────────────────────────────────────────────────────

// Finnhub impact is only trusted when it's exactly low/medium/high; anything
// else (empty, numeric, unknown string) becomes "unknown" — never manually
// promoted to high (spec §3).
export function normalizeImpact(raw: string | undefined): ImpactLevel {
  const v = (raw ?? "").toString().trim().toLowerCase();
  return v === "low" || v === "medium" || v === "high" ? v : "unknown";
}

// Finnhub event time is "YYYY-MM-DD HH:mm:ss" in UTC → ISO.
function eventTimeToIso(time: string | undefined): string {
  if (typeof time !== "string") return "";
  const m = time.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/);
  if (m) return `${m[1]}T${m[2]}Z`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(time)) return `${time}T00:00:00Z`;
  return "";
}

export function normalizeCalendar(raw: FinnhubRawEvent[]): EconomicEvent[] {
  return raw
    .map((e, idx): EconomicEvent => ({
      id: hashId(`${e.event ?? ""}${e.time ?? ""}${e.country ?? ""}${idx}`),
      title: (e.event ?? "").trim(),
      country: (e.country ?? "").trim() || null,
      currency: (e.currency ?? "").trim() || null,
      scheduledAt: eventTimeToIso(e.time),
      impact: normalizeImpact(e.impact),
      previous: e.prev ?? null,
      estimate: e.estimate ?? null,
      actual: e.actual ?? null,
      source: "finnhub",
    }))
    .filter((e) => e.title !== "");
}

// ── Instrument prices + key levels (from real OHLC only) ──────────────────

export function normalizeInstrumentFromTD(symbol: string, result: TwelveDataResult): InstrumentMarketData {
  if (result.error || !result.data || result.data.candles.length === 0) {
    return unavailableInstrument(symbol);
  }
  const [today, prev] = result.data.candles;
  const currentPrice = today?.close ?? null;
  if (currentPrice === null) return unavailableInstrument(symbol);

  // Only real OHLC becomes a level; a level is null when its candle field is
  // missing. keyLevels is null only if nothing at all could be computed.
  const levels: KeyLevels = {
    dailyOpen: today?.open ?? null,
    previousDayHigh: prev?.high ?? null,
    previousDayLow: prev?.low ?? null,
    previousDayClose: prev?.close ?? null,
  };
  const hasAnyLevel = Object.values(levels).some((v) => v !== null);

  return {
    symbol,
    currentPrice,
    dailyOpen: today?.open ?? null,
    previousClose: prev?.close ?? null,
    timestamp: today?.datetime ? `${today.datetime}T00:00:00Z` : null,
    status: "available",
    provider: "twelvedata",
    keyLevels: hasAnyLevel ? levels : null,
  };
}

// ── Orchestrator ──────────────────────────────────────────────────────────

function dateInTimezone(now: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

// Whole-object fallback if a refresh throws catastrophically — the Next Data
// Cache already serves per-endpoint last-good within each revalidate window;
// this covers a total failure so the UI still gets the previous good build.
let lastGood: MarketIntelligence | null = null;

export async function getMarketIntelligence(timezone: string): Promise<MarketIntelligence> {
  const tz = timezone || "UTC";
  const now = new Date();
  const date = dateInTimezone(now, tz);

  try {
    const [newsRes, calendarRes, eurRes, xauRes] = await Promise.all([
      fetchFinnhubGeneralNews(),
      fetchFinnhubEconomicCalendar(date, date),
      fetchTwelveDataDaily("EUR/USD"),
      fetchTwelveDataDaily("XAU/USD"),
    ]);

    const news = normalizeNews(newsRes.raw);
    const economicEvents = normalizeCalendar(calendarRes.raw);

    const instruments: Record<InstrumentKey, InstrumentMarketData> = {
      EURUSD: normalizeInstrumentFromTD("EURUSD", eurRes),
      XAUUSD: normalizeInstrumentFromTD("XAUUSD", xauRes),
      // Indices aren't covered by either free tier — explicit unavailable,
      // never a substituted ETF (spec §5).
      NDX: unavailableInstrument("NDX"),
      US30: unavailableInstrument("US30"),
    };

    const errors: MarketError[] = [newsRes.error, calendarRes.error, eurRes.error, xauRes.error].filter(
      (e): e is MarketError => e !== null
    );

    const newsOk = newsRes.error === null;
    const anyPriceOk = instruments.EURUSD.status === "available" || instruments.XAUUSD.status === "available";
    const nothing = !newsOk && !anyPriceOk && economicEvents.length === 0;
    const everythingClean = newsOk && calendarRes.error === null && instruments.EURUSD.status === "available" && instruments.XAUUSD.status === "available";
    const status: MarketIntelligence["status"] = nothing ? "unavailable" : everythingClean ? "complete" : "partial";

    const result: MarketIntelligence = {
      date,
      timezone: tz,
      economicEvents,
      news,
      instruments,
      sentiment: notConfiguredSentiment(),
      fetchedAt: now.toISOString(),
      provider: "finnhub",
      status,
      errors,
    };

    if (status !== "unavailable") lastGood = result;
    return result;
  } catch {
    // Never leak internals — return the last good build if we have one.
    if (lastGood) return { ...lastGood, fetchedAt: lastGood.fetchedAt };
    return buildUnavailableIntelligence(tz, [{ domain: "news", code: "internal", message: "Market intelligence temporarily unavailable." }]);
  }
}
