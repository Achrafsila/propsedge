import { MarketError } from "../types";

// ============================================================
// PropEdge — TwelveData provider (SERVER-ONLY)
// ============================================================
// Reads process.env.TWELVEDATA_API_KEY. Server-only, same rules as the
// Finnhub provider: no key in logs, timeout, safe errors. Used for the FX /
// commodity price + OHLC that Finnhub's free tier can't serve.
//
// Confirmed against this key's tier during integration (2026-07):
//   /time_series EUR/USD, XAU/USD  -> 200 (open/high/low/close + prev day)
//   NDX / DJI (indices)            -> 404 "available on Grow/Venture plan"
// So indices return an explicit unavailable state, never a substituted ETF.

const TWELVEDATA_BASE_URL = "https://api.twelvedata.com";
const TIMEOUT_MS = 12_000;
export const PRICES_REVALIDATE_SECONDS = 300; // 5 min (spec §9)

function getApiKey(): string {
  const key = process.env.TWELVEDATA_API_KEY;
  if (!key) throw new Error("TWELVEDATA_API_KEY is not configured");
  return key;
}

function toMarketError(code: string, message: string): MarketError {
  return { domain: "prices", code, message };
}

// One daily OHLC candle, already parsed from TwelveData's string fields to
// numbers (null if a field was missing/unparseable — never guessed).
export interface DailyCandle {
  datetime: string; // "YYYY-MM-DD"
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
}

export interface TwelveDataDaily {
  symbol: string;
  candles: DailyCandle[]; // newest first: [today, previousDay]
}

export interface TwelveDataResult {
  data: TwelveDataDaily | null;
  error: MarketError | null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

interface RawTimeSeries {
  status?: string;
  code?: number;
  message?: string;
  values?: Array<{ datetime?: string; open?: string; high?: string; low?: string; close?: string }>;
}

// Fetches the last two daily candles (today forming + previous day) for a
// TwelveData FX/commodity symbol like "EUR/USD" or "XAU/USD".
export async function fetchTwelveDataDaily(symbol: string): Promise<TwelveDataResult> {
  let key: string;
  try {
    key = getApiKey();
  } catch {
    return { data: null, error: toMarketError("no_api_key", "Price data provider is not configured.") };
  }

  const url = `${TWELVEDATA_BASE_URL}/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=2&apikey=${key}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), next: { revalidate: PRICES_REVALIDATE_SECONDS } });
    // TwelveData returns 200 with an { status:"error", code } body for most
    // failures, and sometimes a real HTTP error — handle both.
    const body: RawTimeSeries = await res.json().catch(() => ({}) as RawTimeSeries);

    if (!res.ok || body.status === "error") {
      const code = body.code ?? res.status;
      if (code === 429) return { data: null, error: toMarketError("429", "Price provider rate limit reached — showing the most recent cached data.") };
      if (code === 401) return { data: null, error: toMarketError("401", "Price provider rejected the API key.") };
      if (code === 404) return { data: null, error: toMarketError("unavailable_symbol", `${symbol} is not available on the current provider plan.`) };
      return { data: null, error: toMarketError(String(code), "Price provider returned an unexpected response.") };
    }

    const values = Array.isArray(body.values) ? body.values : [];
    if (values.length === 0) return { data: null, error: toMarketError("empty", `No price data returned for ${symbol}.`) };

    const candles: DailyCandle[] = values.map((v) => ({
      datetime: typeof v.datetime === "string" ? v.datetime : "",
      open: num(v.open),
      high: num(v.high),
      low: num(v.low),
      close: num(v.close),
    }));
    return { data: { symbol, candles }, error: null };
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    const isTimeout = name === "TimeoutError" || name === "AbortError";
    return { data: null, error: toMarketError(isTimeout ? "timeout" : "network_error", isTimeout ? "The price provider did not respond in time." : "Could not reach the price provider.") };
  }
}
