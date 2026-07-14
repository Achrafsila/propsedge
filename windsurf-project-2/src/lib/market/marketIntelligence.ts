import {
  MarketIntelligence,
  MarketNewsItem,
  EconomicEvent,
  ImpactLevel,
  InstrumentMarketData,
  InstrumentMarketHistory,
  InstrumentKey,
  KeyLevels,
  MarketError,
  MarketProvider,
  MarketProviders,
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
import { TwelveDataResult } from "./providers/twelvedata";
import { buildMarketContext } from "./marketContext";
import { buildInstrumentMarketHistory } from "./marketHistory";
import { computeMarketPulse } from "./marketPulse";
import { getMarketDataFromGateway, MarketDataGatewayResult, MarketDataProviderId } from "./marketDataGateway";
import { RELEVANCE_RULES, keywordHit } from "./relevanceRules";

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

// `weekly` is optional/independent of `daily` — a weekly-fetch failure never
// makes the instrument unavailable, it just leaves the three weekly fields
// null (computeStructuralBias/insight already degrade gracefully for that).
//
// Unchanged since the Market Pulse backend integration: this only ever
// reads the first two candles of whatever array it's given (`result`/
// `weekly` may now carry up to 100/50 candles instead of 2 — TwelveData
// always returns newest-first, so candles[0]/[1] are identical either
// way), so currentPrice/keyLevels/marketContext are computed exactly as
// before. marketPulse is set to null here and attached separately by
// buildInstrumentMarketDataWithPulse — this function stays a pure,
// Pulse-agnostic normalizer.
export function normalizeInstrumentFromTD(symbol: string, result: TwelveDataResult, weekly?: TwelveDataResult): InstrumentMarketData {
  if (result.error || !result.data || result.data.candles.length === 0) {
    return unavailableInstrument(symbol);
  }
  const [today, prev] = result.data.candles;
  const currentPrice = today?.close ?? null;
  if (currentPrice === null) return unavailableInstrument(symbol);

  const [thisWeek, prevWeek] = weekly?.data?.candles ?? [];

  // Only real OHLC becomes a level; a level is null when its candle field is
  // missing. keyLevels is null only if nothing at all could be computed.
  const levels: KeyLevels = {
    dailyOpen: today?.open ?? null,
    previousDayHigh: prev?.high ?? null,
    previousDayLow: prev?.low ?? null,
    previousDayClose: prev?.close ?? null,
    weeklyOpen: thisWeek?.open ?? null,
    previousWeekHigh: prevWeek?.high ?? null,
    previousWeekLow: prevWeek?.low ?? null,
  };
  const hasAnyLevel = Object.values(levels).some((v) => v !== null);
  const keyLevels = hasAnyLevel ? levels : null;

  return {
    symbol,
    currentPrice,
    dailyOpen: today?.open ?? null,
    previousClose: prev?.close ?? null,
    timestamp: today?.datetime ? `${today.datetime}T00:00:00Z` : null,
    status: "available",
    provider: "twelvedata",
    keyLevels,
    marketContext: buildMarketContext(symbol, currentPrice, keyLevels),
    marketPulse: null,
  };
}

// Builds the full InstrumentMarketData for a TwelveData-backed instrument,
// including its Market Pulse, from ONE already-fetched pair of daily/
// weekly results — never a second fetch. Reuses normalizeInstrumentFromTD
// (unchanged analytical logic) for current price/key levels/bias, then
// builds InstrumentMarketHistory from the SAME two TwelveDataResult
// objects (buildInstrumentMarketHistory, from marketHistory.ts) and feeds
// that plus the already-computed Market Context into computeMarketPulse
// (from marketPulse.ts). Always attempts Pulse, even on a failed fetch —
// buildInstrumentMarketHistory/computeMarketPulse already degrade to an
// honest "unavailable"/"partial" Pulse from empty/short history, so there
// is no need to special-case failure here.
export function buildInstrumentMarketDataWithPulse(symbol: string, dailyResult: TwelveDataResult, weeklyResult: TwelveDataResult): InstrumentMarketData {
  const base = normalizeInstrumentFromTD(symbol, dailyResult, weeklyResult);
  const history = buildInstrumentMarketHistory(symbol, dailyResult, weeklyResult);
  const marketPulse = computeMarketPulse(history, base.marketContext);
  return { ...base, marketPulse };
}

// ── Gateway-backed instruments (Market Data Gateway integration) ──────────
// The Gateway already normalizes every provider (TwelveData, Alpha Vantage,
// FMP) into the same InstrumentMarketHistory shape, so unlike
// normalizeInstrumentFromTD (which is TwelveData-result-specific and kept
// above, unused, for backward compatibility with its existing tests), this
// reads directly from MarketCandle[] — provider-agnostic by construction,
// no per-provider branching needed here.
function toMarketProvider(providerUsed: MarketDataProviderId): MarketProvider | null {
  return providerUsed === "none" ? null : providerUsed;
}

// Same "first two candles" reading normalizeInstrumentFromTD already uses,
// just sourced from the Gateway's already-normalized history instead of a
// raw provider result. marketPulse is left null here and attached
// separately, same convention as normalizeInstrumentFromTD.
export function buildInstrumentMarketDataFromHistory(symbol: string, history: InstrumentMarketHistory, provider: MarketProvider | null): InstrumentMarketData {
  const [today, prev] = history.dailyCandles;
  const currentPrice = today?.close ?? null;
  if (currentPrice === null) return unavailableInstrument(symbol);

  const [thisWeek, prevWeek] = history.weeklyCandles;

  const levels: KeyLevels = {
    dailyOpen: today?.open ?? null,
    previousDayHigh: prev?.high ?? null,
    previousDayLow: prev?.low ?? null,
    previousDayClose: prev?.close ?? null,
    weeklyOpen: thisWeek?.open ?? null,
    previousWeekHigh: prevWeek?.high ?? null,
    previousWeekLow: prevWeek?.low ?? null,
  };
  const hasAnyLevel = Object.values(levels).some((v) => v !== null);
  const keyLevels = hasAnyLevel ? levels : null;

  return {
    symbol,
    currentPrice,
    dailyOpen: today?.open ?? null,
    previousClose: prev?.close ?? null,
    timestamp: today?.datetime ? `${today.datetime}T00:00:00Z` : null,
    status: "available",
    provider,
    keyLevels,
    marketContext: buildMarketContext(symbol, currentPrice, keyLevels),
    marketPulse: null,
  };
}

// Builds the full InstrumentMarketData (+ Market Pulse) for a Gateway-
// routed instrument from ONE already-fetched MarketDataGatewayResult —
// never a second fetch. `displaySymbol` is the UI-facing key (e.g.
// "US30"), which may differ from the Gateway's own routing symbol (e.g.
// "DJI") — the history (and therefore every downstream Pulse engine
// result, which all read history.symbol) is relabeled to displaySymbol so
// nothing downstream ever surfaces the internal Gateway symbol.
export function buildInstrumentMarketDataFromGatewayResult(displaySymbol: string, gatewayResult: MarketDataGatewayResult): InstrumentMarketData {
  const history: InstrumentMarketHistory = { ...gatewayResult.history, symbol: displaySymbol };
  const provider = toMarketProvider(gatewayResult.meta.providerUsed);
  const base = buildInstrumentMarketDataFromHistory(displaySymbol, history, provider);
  const marketPulse = computeMarketPulse(history, base.marketContext);
  return { ...base, marketPulse };
}

// ── Orchestrator ──────────────────────────────────────────────────────────

function dateInTimezone(now: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

// Rolls several instruments' individual `.provider` values into the one
// top-level MarketProviders.prices field. This is necessarily a
// simplification once different instruments can be served by different
// providers (unlike before this integration, when every price came from
// TwelveData or nothing) — it reports the "most primary" provider that
// served at least one instrument, in the same priority order the Gateway
// itself tries them (TwelveData before Alpha Vantage; FMP is a separate,
// unrelated route so it only wins when neither of the other two did).
export function summarizePricesProvider(providers: (MarketProvider | null)[]): MarketProvider | null {
  if (providers.includes("twelvedata")) return "twelvedata";
  if (providers.includes("alphavantage")) return "alphavantage";
  if (providers.includes("fmp")) return "fmp";
  return null;
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
    // ONE Gateway call per instrument — the Gateway itself makes exactly
    // one provider fetch per symbol/interval (see marketDataGateway.ts),
    // so there is no duplicate provider fetching here either. US30 is
    // requested from the Gateway as "DJI" (its actual routing symbol —
    // the Gateway has no "US30" entry) and relabeled back to "US30" by
    // buildInstrumentMarketDataFromGatewayResult so nothing downstream
    // ever surfaces the internal Gateway symbol. NDX has no Gateway route
    // at all (unavailable, never a substituted ETF) and is not requested.
    const [newsRes, calendarRes, eurGateway, xauGateway, djiGateway] = await Promise.all([
      fetchFinnhubGeneralNews(),
      fetchFinnhubEconomicCalendar(date, date),
      getMarketDataFromGateway("EURUSD"),
      getMarketDataFromGateway("XAUUSD"),
      getMarketDataFromGateway("DJI"),
    ]);

    const news = normalizeNews(newsRes.raw);
    const economicEvents = normalizeCalendar(calendarRes.raw);

    const instruments: Record<InstrumentKey, InstrumentMarketData> = {
      EURUSD: buildInstrumentMarketDataFromGatewayResult("EURUSD", eurGateway),
      XAUUSD: buildInstrumentMarketDataFromGatewayResult("XAUUSD", xauGateway),
      US30: buildInstrumentMarketDataFromGatewayResult("US30", djiGateway),
      // Nasdaq 100 has no route in the Gateway on any current plan —
      // explicit unavailable, never a substituted ETF (spec §5).
      // marketPulse is null: there is no history to build one from, and
      // none was fetched.
      NDX: unavailableInstrument("NDX"),
    };

    // Each Gateway result's primaryFailure (present whenever its fallback
    // was engaged, succeeded or not) is surfaced here — never silently
    // swallowed, same convention weekly-fetch failures already followed
    // before this integration.
    const gatewayErrors: MarketError[] = [eurGateway.meta.primaryFailure, xauGateway.meta.primaryFailure, djiGateway.meta.primaryFailure].filter(
      (e): e is MarketError => e !== null
    );
    const errors: MarketError[] = [newsRes.error, calendarRes.error, ...gatewayErrors].filter((e): e is MarketError => e !== null);

    const newsOk = newsRes.error === null;
    const anyPriceOk = instruments.EURUSD.status === "available" || instruments.XAUUSD.status === "available" || instruments.US30.status === "available";
    const nothing = !newsOk && !anyPriceOk && economicEvents.length === 0;
    // NDX is intentionally excluded here (same reason both indices were
    // excluded before this integration): it is categorically unavailable
    // on every current plan, so requiring it would make "complete"
    // permanently unreachable. US30 is now genuinely available via the
    // Gateway's DJI route, so — unlike before — it IS required for
    // "complete", the same way EURUSD/XAUUSD already are.
    const everythingClean =
      newsOk &&
      calendarRes.error === null &&
      instruments.EURUSD.status === "available" &&
      instruments.XAUUSD.status === "available" &&
      instruments.US30.status === "available";
    const status: MarketIntelligence["status"] = nothing ? "unavailable" : everythingClean ? "complete" : "partial";

    // Explicit per-domain attribution — never a single global provider
    // string. "prices" summarizes which provider served ANY instrument,
    // preferring TwelveData > Alpha Vantage > FMP for this rollup field
    // when providers differ across instruments; each instrument's own
    // .provider field remains the precise per-instrument source of truth.
    const providers: MarketProviders = {
      news: newsOk ? "finnhub" : null,
      calendar: calendarRes.error === null ? "finnhub" : null,
      prices: summarizePricesProvider([instruments.EURUSD.provider, instruments.XAUUSD.provider, instruments.US30.provider]),
    };

    const result: MarketIntelligence = {
      date,
      timezone: tz,
      economicEvents,
      news,
      instruments,
      sentiment: notConfiguredSentiment(),
      fetchedAt: now.toISOString(),
      providers,
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
