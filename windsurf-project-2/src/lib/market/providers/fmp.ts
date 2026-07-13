import { MarketError } from "../types";

// ============================================================
// PropEdge — Financial Modeling Prep (FMP) provider (SERVER-ONLY)
// ============================================================
// Reads process.env.FMP_API_KEY. Server-only, same rules as every other
// provider file: no key in logs, timeout, safe errors.
//
// Confirmed against this key's plan during the provider compatibility
// audit (2026-07): S&P 500 (^GSPC) and Dow Jones (^DJI) historical daily
// OHLC are available; Nasdaq 100 (^NDX) historical OHLC, the economic
// calendar, and forex/crypto news are all HTTP 402 (plan-restricted).
// This file therefore only ever requests ^GSPC / ^DJI — it does not
// attempt ^NDX and never substitutes QQQ or any other ETF for it.
//
// Endpoint note: FMP's older `/api/v3/historical-price-full/:symbol`
// (wrapped `{ symbol, historical: [...] }` response) is a legacy endpoint
// no longer served on this plan (confirmed live: HTTP 403 "Legacy
// Endpoint"). This file uses the current `/stable/historical-price-eod/full`
// endpoint instead, which returns a flat array of `{ symbol, date, open,
// high, low, close, ... }` objects directly (no wrapper), newest-first.
// Bounded with `from`/`to` (~200 calendar days back) rather than fetching
// the provider's full multi-year default response, since only the last
// ~100 trading days are ever needed.
//
// Only a DAILY historical endpoint is available on this plan
// (historical-price-eod/full) — there is no weekly aggregation endpoint
// on this tier, and this file does not synthesize one by resampling daily
// bars (that would be a new analytical computation, not a fetch). Weekly
// candles for FMP-routed instruments are therefore always an empty array
// with dataQuality.weeklyHistory = "unavailable", honestly.
//
// Ordering / forming-candle note: FMP's historical-price-eod/full endpoint
// on this plan is end-of-day data, returned newest-first (re-sorted
// explicitly here, not just trusted). Unlike TwelveData/Alpha Vantage's continuously-trading FX/
// crypto feeds, US equity indices only update once per session close on
// this plan — so index 0 here is a CLOSED bar (the most recent completed
// session), not a forming one. This is the one provider in the gateway
// where index 0 does not need to be excluded from analysis for that
// reason (callers should still confirm this per their own use case; this
// file only documents FMP's own behavior, it does not decide how a
// consumer must treat it).

const FMP_BASE_URL = "https://financialmodelingprep.com/stable";
const TIMEOUT_MS = 12_000;
// Once-per-session-close data — a slower cache window than the
// continuously-updating FX/crypto feeds is appropriate.
export const FMP_DAILY_REVALIDATE_SECONDS = 1800; // 30 min
// Comfortably more calendar days than the ~140 needed to cover 100
// trading days once weekends/holidays are excluded.
const FMP_LOOKBACK_DAYS = 200;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getApiKey(): string {
  const key = process.env.FMP_API_KEY;
  if (!key) throw new Error("FMP_API_KEY is not configured");
  return key;
}

function toMarketError(code: string, message: string): MarketError {
  return { domain: "prices", code, message };
}

export interface Candle {
  datetime: string; // "YYYY-MM-DD"
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
}

export interface FmpSeries {
  symbol: string;
  candles: Candle[]; // newest first, as returned by FMP
}

export interface FmpResult {
  data: FmpSeries | null;
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

interface RawHistoricalEntry {
  date?: string;
  open?: number | string;
  high?: number | string;
  low?: number | string;
  close?: number | string;
}

// The stable endpoint returns a flat array directly — no `{ historical }`
// wrapper — on success. A plan/auth failure comes back as a JSON object
// with an "Error Message" field instead of an array.
type RawHistoricalResponse = RawHistoricalEntry[] | { "Error Message"?: string };

// `symbol` must already be an FMP-format ticker (e.g. "^GSPC", "^DJI") —
// this file does not map display names to tickers; that mapping lives in
// the gateway, which is the single place instrument routing decisions are
// made.
export async function fetchFmpDailyHistory(symbol: string): Promise<FmpResult> {
  let key: string;
  try {
    key = getApiKey();
  } catch {
    return { data: null, error: toMarketError("no_api_key", "Index price data provider is not configured.") };
  }

  const to = isoDate(new Date());
  const from = isoDate(new Date(Date.now() - FMP_LOOKBACK_DAYS * 24 * 60 * 60 * 1000));
  const url = `${FMP_BASE_URL}/historical-price-eod/full?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&apikey=${key}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), next: { revalidate: FMP_DAILY_REVALIDATE_SECONDS } });
    if (!res.ok) {
      if (res.status === 402) return { data: null, error: toMarketError("plan_restricted", `${symbol} historical data is not available on the current provider plan.`) };
      if (res.status === 429) return { data: null, error: toMarketError("429", "Index price provider rate limit reached.") };
      if (res.status === 401 || res.status === 403) return { data: null, error: toMarketError(String(res.status), "Index price provider rejected the API key.") };
      return { data: null, error: toMarketError(String(res.status), "Index price provider returned an unexpected response.") };
    }

    const body: RawHistoricalResponse = await res.json().catch(() => []);
    if (!Array.isArray(body)) {
      if (body["Error Message"]) return { data: null, error: toMarketError("unavailable_symbol", `${symbol} is not available from the index price provider.`) };
      return { data: null, error: toMarketError("unexpected_shape", "Index price provider returned an unexpected response.") };
    }

    if (body.length === 0) return { data: null, error: toMarketError("empty", `No historical data returned for ${symbol}.`) };

    // Explicitly re-sorted newest-first rather than trusting the
    // provider's own ordering, same defensive convention as the Alpha
    // Vantage adapter.
    const sorted = [...body].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    const candles: Candle[] = sorted.map((h) => ({
      datetime: typeof h.date === "string" ? h.date : "",
      open: num(h.open),
      high: num(h.high),
      low: num(h.low),
      close: num(h.close),
    }));

    return { data: { symbol, candles }, error: null };
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    const isTimeout = name === "TimeoutError" || name === "AbortError";
    return {
      data: null,
      error: toMarketError(isTimeout ? "timeout" : "network_error", isTimeout ? "The index price provider did not respond in time." : "Could not reach the index price provider."),
    };
  }
}
