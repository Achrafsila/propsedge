import { MarketError } from "../types";

// ============================================================
// PropEdge — TwelveData provider (SERVER-ONLY)
// ============================================================
// Reads process.env.TWELVEDATA_API_KEY. Server-only, same rules as the
// Finnhub provider: no key in logs, timeout, safe errors. Used for the FX /
// commodity price + OHLC that Finnhub's free tier can't serve.
//
// Confirmed against this key's tier during integration (2026-07):
//   /time_series EUR/USD, XAU/USD, interval=1day  -> 200 (OHLC + prev day)
//   /time_series EUR/USD, XAU/USD, interval=1week -> 200 (OHLC + prev week)
//   NDX / DJI (indices)                            -> 404 "available on
//                                                      Grow/Venture plan"
// So indices return an explicit unavailable state, never a substituted ETF.
//
// Confirmed again for the Edge Pulse multi-timeframe build (2026-07-14, via
// scripts/verify-twelvedata-intraday.ts against the live API):
//   /time_series EUR/USD, XAU/USD, interval=4h/1h/15min -> 200, real OHLC
// So intraday IS available on this plan for forex/gold (unlike the indices
// above) — Edge Pulse's Structure/Liquidity/Supply-Demand engines can use
// real H4/H1/M15 candles for EURUSD/XAUUSD. Observed rate limit: 8
// api-credits/minute, 1 credit per call regardless of outputsize — a
// single instrument's full 5-interval fetch (daily/weekly/4h/1h/15min)
// costs 5 of that 8/minute budget, so callers should fetch one instrument
// at a time, not burst multiple instruments in parallel.

const TWELVEDATA_BASE_URL = "https://api.twelvedata.com";
const TIMEOUT_MS = 12_000;
export const PRICES_REVALIDATE_SECONDS = 300; // 5 min (spec §9)
// Weekly OHLC only moves once a new week opens — a much longer window than
// the 5-min intraday price cache is appropriate and cuts request volume.
export const WEEKLY_REVALIDATE_SECONDS = 1800; // 30 min

// History fetches — deeper OHLC for the Market Data engines. Sizes are the
// exact depths empirically confirmed clean on the current TwelveData plan
// for both EUR/USD and XAU/USD (100 daily, 50 weekly).
//
// As of the Market Pulse backend integration, this is also the ONLY
// TwelveData fetch the live orchestrator (marketIntelligence.ts) makes —
// the same daily/weekly candles it returns are read for both the live
// current-price/key-levels path (which only ever looks at the first two
// candles, same as before) and the deeper history the engines need, so
// there is exactly one fetch per symbol/interval, never two. The
// revalidate windows below are therefore set to match what the live path
// previously used on its own (PRICES_REVALIDATE_SECONDS /
// WEEKLY_REVALIDATE_SECONDS above) rather than a slower "history doesn't
// need to be fresh" cadence — this single fetch now has to satisfy the
// live consumer's freshness need too.
export const HISTORY_DAILY_OUTPUTSIZE = 100;
export const HISTORY_WEEKLY_OUTPUTSIZE = 50;
export const DAILY_HISTORY_REVALIDATE_SECONDS = PRICES_REVALIDATE_SECONDS; // 5 min — matches the live daily-price cadence it now also serves
export const WEEKLY_HISTORY_REVALIDATE_SECONDS = WEEKLY_REVALIDATE_SECONDS; // 30 min — matches the live weekly-price cadence it now also serves

// Intraday history — Edge Pulse only (never fetched by the shared
// marketIntelligence.ts orchestrator). Depths are sized for enough
// completed-candle context for fractal swing detection at each timeframe
// (roughly: H4 ~30 days, H1 ~8 days, M15 ~2 days) — outputsize does not
// change the 1-credit-per-call cost (confirmed via the same probe), so
// these are set generously rather than minimally.
export const HISTORY_H4_OUTPUTSIZE = 180;
export const HISTORY_H1_OUTPUTSIZE = 200;
export const HISTORY_M15_OUTPUTSIZE = 200;
// All three intraday intervals share the same 5-min cadence as the daily
// live-price path — none of them need to be fresher than that for a
// trader-facing structure read, and it keeps the credit budget predictable.
export const INTRADAY_HISTORY_REVALIDATE_SECONDS = PRICES_REVALIDATE_SECONDS;

function getApiKey(): string {
  const key = process.env.TWELVEDATA_API_KEY;
  if (!key) throw new Error("TWELVEDATA_API_KEY is not configured");
  return key;
}

function toMarketError(code: string, message: string): MarketError {
  return { domain: "prices", code, message };
}

// One OHLC candle (daily or weekly, shape is identical), already parsed
// from TwelveData's string fields to numbers (null if a field was
// missing/unparseable — never guessed).
export interface Candle {
  datetime: string; // "YYYY-MM-DD"
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
}

export interface TwelveDataSeries {
  symbol: string;
  candles: Candle[]; // newest first: [current period, previous period]
}

export interface TwelveDataResult {
  data: TwelveDataSeries | null;
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

type Interval = "1day" | "1week" | "4h" | "1h" | "15min";

// Shared fetch/parse for both daily and weekly series — same endpoint,
// same response shape, only the interval and outputsize differ.
async function fetchTwelveDataSeries(symbol: string, interval: Interval, revalidate: number, outputsize: number): Promise<TwelveDataResult> {
  let key: string;
  try {
    key = getApiKey();
  } catch {
    return { data: null, error: toMarketError("no_api_key", "Price data provider is not configured.") };
  }

  const url = `${TWELVEDATA_BASE_URL}/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=${outputsize}&apikey=${key}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), next: { revalidate } });
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

    const candles: Candle[] = values.map((v) => ({
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

// Fetches the last two daily candles (today forming + previous day) for a
// TwelveData FX/commodity symbol like "EUR/USD" or "XAU/USD". Unchanged
// behavior — still outputsize=2, still what Market Context's live price/
// key-levels path consumes.
export async function fetchTwelveDataDaily(symbol: string): Promise<TwelveDataResult> {
  return fetchTwelveDataSeries(symbol, "1day", PRICES_REVALIDATE_SECONDS, 2);
}

// Fetches the last two weekly candles (this week forming + previous
// complete week) — the source for weekly open / previous week high / low.
// Unchanged behavior — still outputsize=2.
export async function fetchTwelveDataWeekly(symbol: string): Promise<TwelveDataResult> {
  return fetchTwelveDataSeries(symbol, "1week", WEEKLY_REVALIDATE_SECONDS, 2);
}

// Fetches up to HISTORY_DAILY_OUTPUTSIZE daily candles — the Market Data
// foundation's reusable deep-history fetch. Index 0 is still the
// currently-forming candle (same ordering as the live 2-candle fetch).
export async function fetchTwelveDataDailyHistory(symbol: string): Promise<TwelveDataResult> {
  return fetchTwelveDataSeries(symbol, "1day", DAILY_HISTORY_REVALIDATE_SECONDS, HISTORY_DAILY_OUTPUTSIZE);
}

// Fetches up to HISTORY_WEEKLY_OUTPUTSIZE weekly candles — same shape/
// ordering rules as fetchTwelveDataDailyHistory, one interval up.
export async function fetchTwelveDataWeeklyHistory(symbol: string): Promise<TwelveDataResult> {
  return fetchTwelveDataSeries(symbol, "1week", WEEKLY_HISTORY_REVALIDATE_SECONDS, HISTORY_WEEKLY_OUTPUTSIZE);
}

// Intraday history fetchers — Edge Pulse's multi-timeframe Structure/
// Liquidity/Supply-Demand engines only. Same "index 0 is the
// currently-forming candle" convention as daily/weekly (reconfirmed for
// these intervals by scripts/verify-twelvedata-intraday.ts before this was
// written).
export async function fetchTwelveDataH4History(symbol: string): Promise<TwelveDataResult> {
  return fetchTwelveDataSeries(symbol, "4h", INTRADAY_HISTORY_REVALIDATE_SECONDS, HISTORY_H4_OUTPUTSIZE);
}
export async function fetchTwelveDataH1History(symbol: string): Promise<TwelveDataResult> {
  return fetchTwelveDataSeries(symbol, "1h", INTRADAY_HISTORY_REVALIDATE_SECONDS, HISTORY_H1_OUTPUTSIZE);
}
export async function fetchTwelveDataM15History(symbol: string): Promise<TwelveDataResult> {
  return fetchTwelveDataSeries(symbol, "15min", INTRADAY_HISTORY_REVALIDATE_SECONDS, HISTORY_M15_OUTPUTSIZE);
}
