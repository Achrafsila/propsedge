// ============================================================
// Finnhub client — SERVER-ONLY
// ============================================================
// Reads process.env.FINNHUB_API_KEY, which is never NEXT_PUBLIC_-prefixed
// and therefore never bundled into client JS. This module must only ever
// be imported from server-side code (Route Handlers, Server Components) —
// the only current caller is src/app/api/market-brief/route.ts. Never
// import this from a "use client" file.
//
// The API key never appears in a log line anywhere in this file: error
// handling below only ever surfaces a status code or an Error's `name`,
// never a message/stack/URL that could echo the token back.

const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

function getApiKey(): string {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("FINNHUB_API_KEY is not configured");
  return key;
}

export interface FinnhubQuote {
  current: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  percentChange: number | null;
}

interface RawQuote {
  c: number;
  d: number | null;
  dp: number | null;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
  error?: string;
}

// Finnhub returns a 200 with every field zeroed (not an error) for a symbol
// this plan/token has no real data for — treated the same as an explicit
// error so callers never render a fabricated "$0" price.
function isEmptyQuote(raw: RawQuote): boolean {
  return raw.c === 0 && raw.o === 0 && raw.h === 0 && raw.l === 0 && raw.t === 0;
}

// Returns null on any failure (missing plan access, rate limit, network
// error, or an empty/zeroed quote) — callers treat null as "no data",
// which is exactly the Morning Briefing's existing "Data unavailable"
// placeholder behavior.
export async function getQuote(symbol: string): Promise<FinnhubQuote | null> {
  try {
    const url = `${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${getApiKey()}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const data: RawQuote = await res.json();
    if (data.error || isEmptyQuote(data)) return null;
    return {
      current: data.c,
      open: data.o,
      high: data.h,
      low: data.l,
      previousClose: data.pc,
      percentChange: typeof data.dp === "number" ? data.dp : null,
    };
  } catch (err) {
    console.error("[finnhub] getQuote failed:", err instanceof Error ? err.name : "unknown error");
    return null;
  }
}

export interface FinnhubNewsItem {
  headline: string;
  summary: string;
  datetime: number;
  source: string;
  url: string;
}

// General market news — the one endpoint this integration confirmed works
// on a free-tier key (quote/sentiment for forex, commodities, and indices
// require a paid Finnhub market-data plan and return an explicit error or
// an empty quote instead).
export async function getGeneralMarketNews(): Promise<FinnhubNewsItem[]> {
  try {
    const url = `${FINNHUB_BASE_URL}/news?category=general&token=${getApiKey()}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map((item: Record<string, unknown>) => ({
      headline: typeof item.headline === "string" ? item.headline : "",
      summary: typeof item.summary === "string" ? item.summary : "",
      datetime: typeof item.datetime === "number" ? item.datetime : 0,
      source: typeof item.source === "string" ? item.source : "",
      url: typeof item.url === "string" ? item.url : "",
    }));
  } catch (err) {
    console.error("[finnhub] getGeneralMarketNews failed:", err instanceof Error ? err.name : "unknown error");
    return [];
  }
}
