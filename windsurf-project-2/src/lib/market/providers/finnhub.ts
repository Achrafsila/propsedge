import { MarketError, MarketDomain } from "../types";

// ============================================================
// PropEdge — Finnhub provider (SERVER-ONLY)
// ============================================================
// Reads process.env.FINNHUB_API_KEY (never NEXT_PUBLIC_-prefixed, never
// bundled into client JS). Import this ONLY from server code (Route
// Handlers / server modules). Responsibilities are provider-specific ONLY:
// HTTP, auth, timeout, JSON parse, and turning provider errors into a safe
// MarketError. Normalization into the public shapes lives in
// marketIntelligence.ts.
//
// The key never appears in any log line: errors below surface a status code
// or an Error's `name`, never a message/stack/URL that could echo the token.
//
// Confirmed against this key's tier during integration (2026-07):
//   /news?category=general  -> 200 (works)
//   /calendar/economic      -> 403 "You don't have access to this resource."
//                              (requires a paid Finnhub plan)
// Forex quotes/candles also 403 on this tier — prices come from TwelveData
// (see providers/twelvedata.ts), never fabricated here.

const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";
const TIMEOUT_MS = 12_000;

// Cache durations (seconds) per spec §9, applied at the fetch layer via
// Next's Data Cache.
export const NEWS_REVALIDATE_SECONDS = 900; // 15 min
export const CALENDAR_REVALIDATE_SECONDS = 1800; // 30 min

function getApiKey(): string {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("FINNHUB_API_KEY is not configured");
  return key;
}

// Maps an HTTP status (or a thrown fetch error) to a stable, safe error
// code + message — no provider internals, no key, no URL.
function toMarketError(domain: MarketDomain, status: number | null, kind: "http" | "timeout" | "network" | "no_key" = "http"): MarketError {
  if (kind === "no_key") return { domain, code: "no_api_key", message: "Market data provider is not configured." };
  if (kind === "timeout") return { domain, code: "timeout", message: "The market data provider did not respond in time." };
  if (kind === "network") return { domain, code: "network_error", message: "Could not reach the market data provider." };
  if (status === 401 || status === 403) return { domain, code: String(status), message: "This data is not available on the current provider plan." };
  if (status === 429) return { domain, code: "429", message: "Market data provider rate limit reached — showing the most recent cached data." };
  return { domain, code: status ? String(status) : "unknown", message: "Market data provider returned an unexpected response." };
}

async function finnhubGet(path: string, revalidate: number): Promise<{ status: number; data: unknown } | { status: null; kind: "timeout" | "network" }> {
  const url = `${FINNHUB_BASE_URL}${path}${path.includes("?") ? "&" : "?"}token=${getApiKey()}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), next: { revalidate } });
    if (!res.ok) return { status: res.status, data: null };
    const data: unknown = await res.json();
    return { status: res.status, data };
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    return { status: null, kind: name === "TimeoutError" || name === "AbortError" ? "timeout" : "network" };
  }
}

// ── Raw provider shapes (exported for the normalizers + tests) ────────────

export interface FinnhubRawNews {
  category?: string;
  datetime?: number; // unix seconds
  headline?: string;
  id?: number;
  image?: string;
  related?: string;
  source?: string;
  summary?: string;
  url?: string;
}

export interface FinnhubRawEvent {
  event?: string;
  country?: string;
  currency?: string;
  time?: string; // "YYYY-MM-DD HH:mm:ss"
  impact?: string;
  prev?: number | string;
  estimate?: number | string;
  actual?: number | string;
}

export interface FinnhubFetchResult<T> {
  raw: T[];
  error: MarketError | null;
}

// ── Public fetches ────────────────────────────────────────────────────────

export async function fetchFinnhubGeneralNews(): Promise<FinnhubFetchResult<FinnhubRawNews>> {
  let key: string;
  try {
    key = getApiKey();
  } catch {
    return { raw: [], error: toMarketError("news", null, "no_key") };
  }
  void key;

  const result = await finnhubGet("/news?category=general", NEWS_REVALIDATE_SECONDS);
  if (result.status === null) return { raw: [], error: toMarketError("news", null, result.kind) };
  if (result.status !== 200) return { raw: [], error: toMarketError("news", result.status) };
  const data = result.data;
  if (!Array.isArray(data)) return { raw: [], error: toMarketError("news", result.status) };
  return { raw: data as FinnhubRawNews[], error: null };
}

export async function fetchFinnhubEconomicCalendar(from: string, to: string): Promise<FinnhubFetchResult<FinnhubRawEvent>> {
  try {
    getApiKey();
  } catch {
    return { raw: [], error: toMarketError("calendar", null, "no_key") };
  }

  const result = await finnhubGet(`/calendar/economic?from=${from}&to=${to}`, CALENDAR_REVALIDATE_SECONDS);
  if (result.status === null) return { raw: [], error: toMarketError("calendar", null, result.kind) };
  if (result.status !== 200) return { raw: [], error: toMarketError("calendar", result.status) };
  // Finnhub wraps the list in { economicCalendar: [...] }.
  const data = result.data as { economicCalendar?: unknown } | null;
  const list = data && Array.isArray(data.economicCalendar) ? data.economicCalendar : null;
  if (!list) return { raw: [], error: toMarketError("calendar", result.status) };
  return { raw: list as FinnhubRawEvent[], error: null };
}
