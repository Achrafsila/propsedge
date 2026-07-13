// ============================================================
// PropEdge — Market Intelligence types (provider-independent)
// ============================================================
// Pure types + a couple of pure builders. NO server-only imports here
// (no process.env, no provider modules) so this file is safe to import
// from client components as well as server code. Every provider normalizes
// its raw response INTO these shapes; the UI only ever sees these.
//
// The MarketPulse import below is `import type` only — it is fully erased
// at compile time (isolatedModules already requires this), so it creates
// no runtime module dependency and no runtime circularity, even though
// marketPulse.ts itself imports several types from this file. TypeScript
// resolves circular type-only references fine; only circular VALUE
// imports would be a problem, and there are none here.
import type { MarketPulse } from "./marketPulse";

export type MarketProvider = "finnhub" | "twelvedata";

export type ImpactLevel = "low" | "medium" | "high" | "unknown";

// One economic-calendar event. `impact` is "unknown" whenever the provider
// didn't return a reliable impact — never manually upgraded to "high".
export interface EconomicEvent {
  id: string;
  title: string;
  country: string | null;
  currency: string | null;
  scheduledAt: string; // ISO 8601 (UTC); the UI formats to the user's tz
  impact: ImpactLevel;
  previous: number | string | null;
  estimate: number | string | null;
  actual: number | string | null;
  source: "finnhub";
}

export interface MarketNewsItem {
  id: string;
  headline: string;
  summary: string | null;
  sourceName: string;
  publishedAt: string; // ISO 8601 (UTC)
  url: string;
  imageUrl: string | null;
  relatedInstruments: string[];
  relevanceScore: number;
  provider: "finnhub";
}

// Deterministic levels, only ever computed from real OHLC (never invented).
// Weekly fields added for the Market Context phase — same rule as daily:
// null unless the provider actually returned that candle.
export interface KeyLevels {
  dailyOpen: number | null;
  previousDayHigh: number | null;
  previousDayLow: number | null;
  previousDayClose: number | null;
  weeklyOpen: number | null;
  previousWeekHigh: number | null;
  previousWeekLow: number | null;
}

export type InstrumentStatus = "available" | "delayed" | "unavailable";

// Deterministic structural read from price vs. real levels only — never a
// news-derived or LLM-derived sentiment. "unknown" whenever the reference
// levels needed to judge it aren't available (never guessed).
export type StructuralBias = "bullish" | "neutral" | "bearish" | "unknown";

export interface KeyLevelDistance {
  label: string; // e.g. "Daily Open", "Prev Week High"
  price: number;
  distance: number; // currentPrice - level (signed)
  distancePercent: number; // distance / level * 100 (signed)
}

export interface MarketContext {
  bias: StructuralBias;
  nearestLevel: KeyLevelDistance | null;
  distances: KeyLevelDistance[]; // every level actually available, closest first
  insight: string; // one concise deterministic sentence, template-built only
}

export interface InstrumentMarketData {
  symbol: string;
  currentPrice: number | null;
  dailyOpen: number | null;
  previousClose: number | null;
  timestamp: string | null; // ISO 8601 (UTC) of the underlying data point
  status: InstrumentStatus;
  provider: MarketProvider | null; // null when unavailable from every provider
  keyLevels: KeyLevels | null; // null => "Key levels unavailable from current provider."
  marketContext: MarketContext | null; // null whenever keyLevels/currentPrice aren't available
  // null only when there is no history to build a Pulse from at all (e.g.
  // NDX/US30, never fetched from TwelveData). Whenever a fetch WAS
  // attempted, Pulse is still populated — its own status/dataQuality
  // fields report degradation honestly rather than being replaced by null.
  marketPulse: MarketPulse | null;
}

// One OHLC candle, provider-independent normalized shape (mirrors the raw
// provider Candle field-for-field — see providers/twelvedata.ts). Nulls
// only, never guessed, same rule as every other field in this file.
export interface MarketCandle {
  datetime: string; // "YYYY-MM-DD"
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
}

export type HistoryQuality = "complete" | "partial" | "unavailable";

// Market Data foundation only — no Pulse/Regime/Phase/Conviction/Volatility/
// Opportunity/Liquidity/Breakout logic reads this yet. Candles are
// newest-first (index 0 = currently-forming, per the empirical TwelveData
// verification); any consumer that requires only completed candles must
// explicitly skip index 0.
export interface InstrumentMarketHistory {
  symbol: string;
  currentPrice: number | null;
  dailyCandles: MarketCandle[];
  weeklyCandles: MarketCandle[];
  dataQuality: {
    dailyHistory: HistoryQuality;
    weeklyHistory: HistoryQuality;
  };
}

// V1 sentiment is deliberately never generated from headlines — always
// "unknown" until an objective market-context model is wired up.
export interface MarketSentiment {
  label: "unknown";
  confidence: number | null;
  drivers: string[];
  methodology: "not_configured";
}

export type MarketDomain = "calendar" | "news" | "prices";

// Safe, frontend-facing error — a stable code + a human message, never an
// internal stack trace and never anything that could echo an API key.
export interface MarketError {
  domain: MarketDomain;
  code: string;
  message: string;
}

export type InstrumentKey = "XAUUSD" | "NDX" | "US30" | "EURUSD";

// Explicit per-domain attribution — never a single global "provider" string.
// A domain is null whenever that domain's fetch failed or wasn't
// configured, even if a different domain succeeded (e.g. calendar can be
// null while news is "finnhub" and prices is "twelvedata" — exactly today's
// real state on the free tiers).
export interface MarketProviders {
  news: MarketProvider | null;
  calendar: MarketProvider | null;
  prices: MarketProvider | null;
}

export interface MarketIntelligence {
  date: string; // YYYY-MM-DD (user tz)
  timezone: string;
  economicEvents: EconomicEvent[];
  news: MarketNewsItem[];
  instruments: Record<InstrumentKey, InstrumentMarketData>;
  sentiment: MarketSentiment;
  fetchedAt: string; // ISO 8601 (UTC)
  providers: MarketProviders;
  status: "complete" | "partial" | "unavailable";
  errors: MarketError[];
}

export const INSTRUMENT_KEYS: InstrumentKey[] = ["XAUUSD", "NDX", "US30", "EURUSD"];

export function unavailableInstrument(symbol: string): InstrumentMarketData {
  return {
    symbol,
    currentPrice: null,
    dailyOpen: null,
    previousClose: null,
    timestamp: null,
    status: "unavailable",
    provider: null,
    keyLevels: null,
    marketContext: null,
    marketPulse: null,
  };
}

export function notConfiguredSentiment(): MarketSentiment {
  return { label: "unknown", confidence: null, drivers: [], methodology: "not_configured" };
}

export function noProviders(): MarketProviders {
  return { news: null, calendar: null, prices: null };
}

// Shared safe fallback — used server-side on a catastrophic failure and
// client-side when the API request itself fails, so the UI always gets a
// well-formed object it can render as clean empty states.
export function buildUnavailableIntelligence(timezone: string, errors: MarketError[] = []): MarketIntelligence {
  const now = new Date();
  return {
    date: now.toISOString().slice(0, 10),
    timezone: timezone || "UTC",
    economicEvents: [],
    news: [],
    instruments: {
      XAUUSD: unavailableInstrument("XAUUSD"),
      NDX: unavailableInstrument("NDX"),
      US30: unavailableInstrument("US30"),
      EURUSD: unavailableInstrument("EURUSD"),
    },
    sentiment: notConfiguredSentiment(),
    fetchedAt: now.toISOString(),
    providers: noProviders(),
    status: "unavailable",
    errors,
  };
}

// Minimal runtime shape guard for the client fetch — never trusts the
// network blindly, mirrors the isMarketBrief guard the old code used.
export function isMarketIntelligence(value: unknown): value is MarketIntelligence {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.date === "string" &&
    typeof v.timezone === "string" &&
    Array.isArray(v.economicEvents) &&
    Array.isArray(v.news) &&
    typeof v.instruments === "object" &&
    v.instruments !== null &&
    typeof v.providers === "object" &&
    v.providers !== null &&
    typeof v.fetchedAt === "string" &&
    typeof v.status === "string"
  );
}
