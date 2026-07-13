import { InstrumentMarketHistory, MarketCandle, MarketError, HistoryQuality } from "./types";
import {
  fetchTwelveDataDailyHistory,
  fetchTwelveDataWeeklyHistory,
  TwelveDataResult,
  HISTORY_DAILY_OUTPUTSIZE,
  HISTORY_WEEKLY_OUTPUTSIZE,
} from "./providers/twelvedata";
import { fetchAlphaVantageDaily, fetchAlphaVantageWeekly, AlphaVantageResult, AlphaVantageAssetKind } from "./providers/alphavantage";
import { fetchFmpDailyHistory, FmpResult } from "./providers/fmp";

// ============================================================
// PropEdge — Market Data Gateway (SERVER-ONLY, V1)
// ============================================================
// Lets Market Intelligence request normalized market history by a
// canonical gateway symbol (e.g. "EURUSD", "BTCUSD", "SPX") without
// depending directly on one provider. This file owns the ONLY routing
// table for which provider serves which instrument, and the ONLY
// fallback decision logic — nothing else in the codebase should
// hardcode a provider choice for a gateway-routed symbol.
//
// V1 routing:
//   - Forex / Gold / Crypto: primary TwelveData, fallback Alpha Vantage
//   - S&P 500 / Dow Jones:   primary FMP, no fallback configured
//   - Nasdaq 100:            unavailable — never substituted with an ETF
//   - News / economic calendar: untouched, out of scope for this file
//     (Finnhub news stays as-is; the calendar stays unavailable, no
//     scraping, no fabricated data)
//
// Architecture: `resolveGatewayHistory` is a PURE function — given
// already-fetched provider results, it decides routing/fallback and
// builds the final InstrumentMarketHistory + metadata. It makes no
// network calls, so it is exactly what the deterministic scenarios below
// exercise. `getMarketDataFromGateway` is the thin real-fetch wiring: it
// calls the providers in the correct order and hands their results to
// `resolveGatewayHistory` for every actual decision. This mirrors the
// computeMarketPulse (pure) / getMarketIntelligence (fetch) split already
// established elsewhere in this module.
//
// Hard invariant: a single InstrumentMarketHistory's dailyCandles and
// weeklyCandles are NEVER sourced from two different providers. Either
// both come from the provider that ultimately served the request, or one
// of them is an empty/unavailable array from that SAME provider (e.g.
// TwelveData's own weekly fetch failing independently of its daily
// success) — never TwelveData daily + Alpha Vantage weekly, or similar.

export type MarketDataProviderId = "twelvedata" | "alphavantage" | "fmp" | "none";

export interface MarketDataGatewayMeta {
  providerUsed: MarketDataProviderId;
  // True whenever the fallback path was engaged (primary failed or the
  // symbol has no primary route) — regardless of whether the fallback
  // itself then succeeded. Check providerUsed to see whether it actually
  // supplied the data.
  fallbackUsed: boolean;
  // The primary provider's error, present whenever fallback was engaged.
  // Null when the primary succeeded, or when the instrument has no
  // primary provider to begin with (e.g. Nasdaq 100).
  primaryFailure: MarketError | null;
}

export interface MarketDataGatewayResult {
  symbol: string;
  history: InstrumentMarketHistory;
  meta: MarketDataGatewayMeta;
}

type AssetClass = "forex" | "gold" | "crypto" | "us_index_available" | "us_index_unavailable";

interface RoutingEntry {
  assetClass: AssetClass;
  twelveDataSymbol?: string; // e.g. "EUR/USD"
  alphaVantage?: { base: string; quote: string; kind: AlphaVantageAssetKind };
  fmpSymbol?: string; // e.g. "^GSPC"
}

// The single source of truth for symbol normalization: canonical gateway
// symbol -> each provider's own required format. Exported (read-only via
// the getter below) specifically so the "symbol normalization" scenario
// can assert these mappings directly rather than inferring them from
// fetch call side effects.
const ROUTING_TABLE: Record<string, RoutingEntry> = {
  EURUSD: { assetClass: "forex", twelveDataSymbol: "EUR/USD", alphaVantage: { base: "EUR", quote: "USD", kind: "forex" } },
  USDJPY: { assetClass: "forex", twelveDataSymbol: "USD/JPY", alphaVantage: { base: "USD", quote: "JPY", kind: "forex" } },
  XAUUSD: { assetClass: "gold", twelveDataSymbol: "XAU/USD", alphaVantage: { base: "XAU", quote: "USD", kind: "forex" } },
  BTCUSD: { assetClass: "crypto", twelveDataSymbol: "BTC/USD", alphaVantage: { base: "BTC", quote: "USD", kind: "crypto" } },
  ETHUSD: { assetClass: "crypto", twelveDataSymbol: "ETH/USD", alphaVantage: { base: "ETH", quote: "USD", kind: "crypto" } },
  SPX: { assetClass: "us_index_available", fmpSymbol: "^GSPC" },
  DJI: { assetClass: "us_index_available", fmpSymbol: "^DJI" },
  NDX: { assetClass: "us_index_unavailable" },
};

export function getRoutingEntry(symbol: string): Readonly<RoutingEntry> | null {
  return ROUTING_TABLE[symbol] ?? null;
}

export const GATEWAY_SYMBOLS: string[] = Object.keys(ROUTING_TABLE);

function toMarketError(code: string, message: string): MarketError {
  return { domain: "prices", code, message };
}

function toMarketCandle(c: { datetime: string; open: number | null; high: number | null; low: number | null; close: number | null }): MarketCandle {
  return { datetime: c.datetime, open: c.open, high: c.high, low: c.low, close: c.close };
}

function classifyQuality(actualCount: number, expectedCount: number): HistoryQuality {
  if (actualCount === 0) return "unavailable";
  return actualCount < expectedCount ? "partial" : "complete";
}

function emptyHistory(symbol: string): InstrumentMarketHistory {
  return {
    symbol,
    currentPrice: null,
    dailyCandles: [],
    weeklyCandles: [],
    dataQuality: { dailyHistory: "unavailable", weeklyHistory: "unavailable" },
  };
}

// Same depth expectation (100 daily / 50 weekly) is applied regardless of
// which provider ultimately serves the request, so dataQuality stays
// meaningful and comparable across providers — a provider that returns
// more than this is trimmed, never a signal of "more complete".
function buildHistoryFromCandles(
  symbol: string,
  dailyRaw: { datetime: string; open: number | null; high: number | null; low: number | null; close: number | null }[],
  weeklyRaw: { datetime: string; open: number | null; high: number | null; low: number | null; close: number | null }[]
): InstrumentMarketHistory {
  const dailyQuality = classifyQuality(dailyRaw.length, HISTORY_DAILY_OUTPUTSIZE);
  const weeklyQuality = classifyQuality(weeklyRaw.length, HISTORY_WEEKLY_OUTPUTSIZE);
  const dailyCandles = dailyRaw.slice(0, HISTORY_DAILY_OUTPUTSIZE).map(toMarketCandle);
  const weeklyCandles = weeklyRaw.slice(0, HISTORY_WEEKLY_OUTPUTSIZE).map(toMarketCandle);

  return {
    symbol,
    currentPrice: dailyCandles[0]?.close ?? null,
    dailyCandles,
    weeklyCandles,
    dataQuality: { dailyHistory: dailyQuality, weeklyHistory: weeklyQuality },
  };
}

export interface GatewayFetchResults {
  twelveDataDaily?: TwelveDataResult;
  twelveDataWeekly?: TwelveDataResult;
  alphaVantageDaily?: AlphaVantageResult;
  alphaVantageWeekly?: AlphaVantageResult;
  fmpDaily?: FmpResult;
}

// Pure decision layer — no fetch calls. Given whichever provider results
// were already obtained (or omitted, when not attempted), decides
// routing/fallback and returns the final history + metadata.
export function resolveGatewayHistory(symbol: string, results: GatewayFetchResults = {}): MarketDataGatewayResult {
  const entry = ROUTING_TABLE[symbol];

  if (!entry || entry.assetClass === "us_index_unavailable") {
    return { symbol, history: emptyHistory(symbol), meta: { providerUsed: "none", fallbackUsed: false, primaryFailure: null } };
  }

  if (entry.assetClass === "us_index_available") {
    const fmpDaily = results.fmpDaily;
    const fmpOk = !!fmpDaily && !fmpDaily.error && !!fmpDaily.data && fmpDaily.data.candles.length > 0;
    if (!fmpOk) {
      return { symbol, history: emptyHistory(symbol), meta: { providerUsed: "none", fallbackUsed: false, primaryFailure: fmpDaily?.error ?? null } };
    }
    // FMP has no weekly endpoint on this plan — weekly stays honestly empty.
    return {
      symbol,
      history: buildHistoryFromCandles(symbol, fmpDaily!.data!.candles, []),
      meta: { providerUsed: "fmp", fallbackUsed: false, primaryFailure: null },
    };
  }

  // forex / gold / crypto — primary TwelveData, fallback Alpha Vantage
  const primary = results.twelveDataDaily;
  const primaryOk = !!primary && !primary.error && !!primary.data && primary.data.candles.length > 0;
  if (primaryOk) {
    return {
      symbol,
      history: buildHistoryFromCandles(symbol, primary!.data!.candles, results.twelveDataWeekly?.data?.candles ?? []),
      meta: { providerUsed: "twelvedata", fallbackUsed: false, primaryFailure: null },
    };
  }

  const primaryFailure = primary?.error ?? toMarketError("empty", `No data returned for ${symbol} from the primary provider.`);
  const fallback = results.alphaVantageDaily;
  const fallbackOk = !!fallback && !fallback.error && !!fallback.data && fallback.data.candles.length > 0;
  if (!fallbackOk) {
    return { symbol, history: emptyHistory(symbol), meta: { providerUsed: "none", fallbackUsed: true, primaryFailure } };
  }

  return {
    symbol,
    history: buildHistoryFromCandles(symbol, fallback!.data!.candles, results.alphaVantageWeekly?.data?.candles ?? []),
    meta: { providerUsed: "alphavantage", fallbackUsed: true, primaryFailure },
  };
}

// Thin real-fetch wiring — the only place in this file that touches the
// network. All routing/fallback/normalization decisions are delegated to
// resolveGatewayHistory. Only fetches Alpha Vantage when TwelveData's
// daily result is unusable, so a healthy primary never triggers an
// unnecessary fallback request.
export async function getMarketDataFromGateway(symbol: string): Promise<MarketDataGatewayResult> {
  const entry = ROUTING_TABLE[symbol];

  if (!entry || entry.assetClass === "us_index_unavailable") {
    return resolveGatewayHistory(symbol, {});
  }

  if (entry.assetClass === "us_index_available") {
    const fmpDaily = await fetchFmpDailyHistory(entry.fmpSymbol!);
    return resolveGatewayHistory(symbol, { fmpDaily });
  }

  const [twelveDataDaily, twelveDataWeekly] = await Promise.all([
    fetchTwelveDataDailyHistory(entry.twelveDataSymbol!),
    fetchTwelveDataWeeklyHistory(entry.twelveDataSymbol!),
  ]);

  const primaryOk = !twelveDataDaily.error && twelveDataDaily.data && twelveDataDaily.data.candles.length > 0;
  if (primaryOk) {
    return resolveGatewayHistory(symbol, { twelveDataDaily, twelveDataWeekly });
  }

  const { base, quote, kind } = entry.alphaVantage!;
  const [alphaVantageDaily, alphaVantageWeekly] = await Promise.all([
    fetchAlphaVantageDaily(base, quote, kind),
    fetchAlphaVantageWeekly(base, quote, kind),
  ]);

  return resolveGatewayHistory(symbol, { twelveDataDaily, twelveDataWeekly, alphaVantageDaily, alphaVantageWeekly });
}
