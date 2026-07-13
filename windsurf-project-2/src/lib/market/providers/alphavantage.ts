import { MarketError } from "../types";

// ============================================================
// PropEdge — Alpha Vantage provider (SERVER-ONLY)
// ============================================================
// Reads process.env.ALPHA_VANTAGE_API_KEY. Server-only, same rules as
// every other provider file: no key in logs, timeout, safe errors, never
// leaks the provider's raw response text (Alpha Vantage's error/rate-limit
// messages are generic doc-links, not sensitive, but the convention here
// is the same fixed code+message pairs every other provider uses, not a
// passthrough of arbitrary provider text).
//
// V1 Market Data Gateway fallback for Forex / Gold / Crypto when
// TwelveData fails or doesn't support the symbol. Two distinct Alpha
// Vantage endpoint families are used, selected by AssetKind:
//   - "forex": FX_DAILY / FX_WEEKLY (from_symbol/to_symbol) — also used
//     for Gold, since Alpha Vantage documents XAU as a supported
//     "physical currency" through the same forex endpoints (from_symbol=
//     XAU, to_symbol=USD), not a separate commodities endpoint.
//   - "crypto": DIGITAL_CURRENCY_DAILY / DIGITAL_CURRENCY_WEEKLY
//     (symbol/market).
//
// Ordering / forming-candle note (documented per the Market Data Gateway
// requirement): Alpha Vantage's FX and crypto time series are keyed by
// date in a plain JSON object; this file explicitly re-sorts them
// newest-first rather than trusting object key order. Forex and crypto
// trade continuously (24/5 and 24/7), so — same as TwelveData — the
// newest (index 0) entry can reflect the still-forming current session,
// not a closed bar. Callers must not analyse index 0 as a completed
// candle, same rule as every other provider in this codebase.

const ALPHA_VANTAGE_BASE_URL = "https://www.alphavantage.co/query";
const TIMEOUT_MS = 12_000;
// Matches TwelveData's live cadence — this is the fallback path for the
// same live consumer, so it needs the same freshness, not a slower one.
export const ALPHA_VANTAGE_DAILY_REVALIDATE_SECONDS = 300; // 5 min
export const ALPHA_VANTAGE_WEEKLY_REVALIDATE_SECONDS = 1800; // 30 min

function getApiKey(): string {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) throw new Error("ALPHA_VANTAGE_API_KEY is not configured");
  return key;
}

function toMarketError(code: string, message: string): MarketError {
  return { domain: "prices", code, message };
}

// One OHLC candle, already parsed from Alpha Vantage's string fields to
// numbers (null if a field was missing/unparseable — never guessed).
export interface Candle {
  datetime: string; // "YYYY-MM-DD"
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
}

export interface AlphaVantageSeries {
  symbol: string;
  candles: Candle[]; // newest first, explicitly re-sorted (see header note)
}

export interface AlphaVantageResult {
  data: AlphaVantageSeries | null;
  error: MarketError | null;
}

export type AlphaVantageAssetKind = "forex" | "crypto";

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// Alpha Vantage's daily-series objects are keyed like "1. open"/"2. high"
// etc. for forex and "1a. open (USD)"/"2a. high (USD)" etc. for crypto —
// rather than hardcoding the exact key text (which has shifted across API
// versions), find the first key containing the field name. Returns null,
// never a guess, if no matching key exists.
function findField(entry: Record<string, unknown>, fieldName: string): number | null {
  const key = Object.keys(entry).find((k) => k.toLowerCase().includes(fieldName));
  return key ? num(entry[key]) : null;
}

interface RawForexResponse {
  "Error Message"?: string;
  Note?: string;
  Information?: string;
  "Time Series FX (Daily)"?: Record<string, Record<string, unknown>>;
  "Time Series FX (Weekly)"?: Record<string, Record<string, unknown>>;
}

interface RawCryptoResponse {
  "Error Message"?: string;
  Note?: string;
  Information?: string;
  "Time Series (Digital Currency Daily)"?: Record<string, Record<string, unknown>>;
  "Time Series (Digital Currency Weekly)"?: Record<string, Record<string, unknown>>;
}

// Parses whichever time-series object is present into candles, sorted
// newest-first by date string (ISO "YYYY-MM-DD" sorts correctly as text).
function parseSeries(series: Record<string, Record<string, unknown>> | undefined): Candle[] {
  if (!series) return [];
  const dates = Object.keys(series).sort((a, b) => b.localeCompare(a));
  return dates.map((date) => {
    const entry = series[date];
    return {
      datetime: date,
      open: findField(entry, "open"),
      high: findField(entry, "high"),
      low: findField(entry, "low"),
      close: findField(entry, "close"),
    };
  });
}

async function fetchAlphaVantage(
  kind: AlphaVantageAssetKind,
  base: string,
  quote: string,
  interval: "daily" | "weekly",
  revalidate: number
): Promise<AlphaVantageResult> {
  let key: string;
  try {
    key = getApiKey();
  } catch {
    return { data: null, error: toMarketError("no_api_key", "Fallback price data provider is not configured.") };
  }

  const symbol = `${base}/${quote}`;
  const fn = kind === "forex" ? (interval === "daily" ? "FX_DAILY" : "FX_WEEKLY") : interval === "daily" ? "DIGITAL_CURRENCY_DAILY" : "DIGITAL_CURRENCY_WEEKLY";
  const params =
    kind === "forex"
      ? `from_symbol=${encodeURIComponent(base)}&to_symbol=${encodeURIComponent(quote)}&outputsize=full`
      : `symbol=${encodeURIComponent(base)}&market=${encodeURIComponent(quote)}`;
  const url = `${ALPHA_VANTAGE_BASE_URL}?function=${fn}&${params}&apikey=${key}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), next: { revalidate } });
    if (!res.ok) {
      if (res.status === 429) return { data: null, error: toMarketError("429", "Fallback price provider rate limit reached.") };
      return { data: null, error: toMarketError(String(res.status), "Fallback price provider returned an unexpected response.") };
    }

    const body: RawForexResponse & RawCryptoResponse = await res.json().catch(() => ({}));

    // Alpha Vantage returns HTTP 200 even for most failures — a rate
    // limit ("Note"), a premium-only endpoint ("Information"), or a bad
    // symbol ("Error Message") all come back as a 200 with no time
    // series key at all.
    if (body["Error Message"]) return { data: null, error: toMarketError("unavailable_symbol", `${symbol} is not available from the fallback provider.`) };
    if (body.Note) return { data: null, error: toMarketError("429", "Fallback price provider rate limit reached.") };
    if (body.Information) return { data: null, error: toMarketError("plan_restricted", "This data is not available on the current fallback provider plan.") };

    const rawSeries =
      kind === "forex"
        ? interval === "daily"
          ? body["Time Series FX (Daily)"]
          : body["Time Series FX (Weekly)"]
        : interval === "daily"
          ? body["Time Series (Digital Currency Daily)"]
          : body["Time Series (Digital Currency Weekly)"];

    const candles = parseSeries(rawSeries);
    if (candles.length === 0) return { data: null, error: toMarketError("empty", `No fallback price data returned for ${symbol}.`) };

    return { data: { symbol, candles }, error: null };
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    const isTimeout = name === "TimeoutError" || name === "AbortError";
    return {
      data: null,
      error: toMarketError(isTimeout ? "timeout" : "network_error", isTimeout ? "The fallback price provider did not respond in time." : "Could not reach the fallback price provider."),
    };
  }
}

export async function fetchAlphaVantageDaily(base: string, quote: string, kind: AlphaVantageAssetKind): Promise<AlphaVantageResult> {
  return fetchAlphaVantage(kind, base, quote, "daily", ALPHA_VANTAGE_DAILY_REVALIDATE_SECONDS);
}

export async function fetchAlphaVantageWeekly(base: string, quote: string, kind: AlphaVantageAssetKind): Promise<AlphaVantageResult> {
  return fetchAlphaVantage(kind, base, quote, "weekly", ALPHA_VANTAGE_WEEKLY_REVALIDATE_SECONDS);
}
