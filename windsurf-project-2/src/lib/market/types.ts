// ============================================================
// PropEdge — Market Intelligence types (provider-independent)
// ============================================================
// Pure types + a couple of pure builders. NO server-only imports here
// (no process.env, no provider modules) so this file is safe to import
// from client components as well as server code. Every provider normalizes
// its raw response INTO these shapes; the UI only ever sees these.

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
export interface KeyLevels {
  dailyOpen: number | null;
  previousDayHigh: number | null;
  previousDayLow: number | null;
  previousDayClose: number | null;
}

export type InstrumentStatus = "available" | "delayed" | "unavailable";

export interface InstrumentMarketData {
  symbol: string;
  currentPrice: number | null;
  dailyOpen: number | null;
  previousClose: number | null;
  timestamp: string | null; // ISO 8601 (UTC) of the underlying data point
  status: InstrumentStatus;
  provider: MarketProvider | null; // null when unavailable from every provider
  keyLevels: KeyLevels | null; // null => "Key levels unavailable from current provider."
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

export interface MarketIntelligence {
  date: string; // YYYY-MM-DD (user tz)
  timezone: string;
  economicEvents: EconomicEvent[];
  news: MarketNewsItem[];
  instruments: Record<InstrumentKey, InstrumentMarketData>;
  sentiment: MarketSentiment;
  fetchedAt: string; // ISO 8601 (UTC)
  // The primary / news provider. Per-instrument price provider is on each
  // InstrumentMarketData.provider (may be "twelvedata"), so this staying
  // "finnhub" is accurate for the news + calendar domains it covers.
  provider: "finnhub";
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
  };
}

export function notConfiguredSentiment(): MarketSentiment {
  return { label: "unknown", confidence: null, drivers: [], methodology: "not_configured" };
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
    provider: "finnhub",
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
    typeof v.fetchedAt === "string" &&
    typeof v.status === "string"
  );
}
