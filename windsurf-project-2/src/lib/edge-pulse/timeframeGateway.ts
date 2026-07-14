import { MarketCandle, MarketError, HistoryQuality } from "@/lib/market/types";
import { getRoutingEntry } from "@/lib/market/marketDataGateway";
import {
  fetchTwelveDataH4History,
  fetchTwelveDataH1History,
  fetchTwelveDataM15History,
  TwelveDataResult,
  HISTORY_H4_OUTPUTSIZE,
  HISTORY_H1_OUTPUTSIZE,
  HISTORY_M15_OUTPUTSIZE,
} from "@/lib/market/providers/twelvedata";
import { Timeframe, TimeframeCandles } from "./types";

// ============================================================
// Edge Pulse — intraday Timeframe Gateway (SERVER-ONLY)
// ============================================================
// Fetches ONLY the 3 intraday intervals (H4/H1/M15) Edge Pulse needs on
// top of what marketDataGateway.ts already fetches (daily/weekly) —
// deliberately does not re-fetch daily/weekly itself, so a single
// instrument selection costs exactly 3 new TwelveData calls, not 5.
// Reuses marketDataGateway.ts's ROUTING_TABLE via getRoutingEntry() as the
// one source of truth for which canonical symbol maps to which provider
// symbol — this file adds no second routing table.
//
// Same pure-resolve / thin-fetch split as marketDataGateway.ts:
// resolveTimeframeGatewayHistory is a pure function over already-fetched
// results; getTimeframeGatewayHistory is the only place that touches the
// network.
//
// Hard ceiling (not a bug, a provider-plan fact): only forex/gold/crypto
// (TwelveData-routed) instruments get real H4/H1/M15 data. US30 (FMP) has
// no intraday endpoint on this plan and NDX has no route at all — both
// report every intraday timeframe as quality "unavailable", empty
// candles, never fabricated or substituted.

export type TimeframeGatewayProviderId = "twelvedata" | "none";

export interface IntradayHistory {
  h4: TimeframeCandles;
  h1: TimeframeCandles;
  m15: TimeframeCandles;
}

export interface TimeframeGatewayResult {
  symbol: string;
  intraday: IntradayHistory;
  meta: {
    providerUsed: TimeframeGatewayProviderId;
    primaryFailure: MarketError | null;
  };
}

function toMarketCandle(c: { datetime: string; open: number | null; high: number | null; low: number | null; close: number | null }): MarketCandle {
  return { datetime: c.datetime, open: c.open, high: c.high, low: c.low, close: c.close };
}

function classifyQuality(actualCount: number, expectedCount: number): HistoryQuality {
  if (actualCount === 0) return "unavailable";
  return actualCount < expectedCount ? "partial" : "complete";
}

function emptyTimeframe(timeframe: Timeframe): TimeframeCandles {
  return { timeframe, candles: [], quality: "unavailable" };
}

function emptyIntraday(): IntradayHistory {
  return { h4: emptyTimeframe("h4"), h1: emptyTimeframe("h1"), m15: emptyTimeframe("m15") };
}

function buildTimeframeCandles(timeframe: Timeframe, result: TwelveDataResult, expectedCount: number): TimeframeCandles {
  const raw = result.data?.candles ?? [];
  const quality = classifyQuality(raw.length, expectedCount);
  return { timeframe, candles: raw.slice(0, expectedCount).map(toMarketCandle), quality };
}

export interface TimeframeGatewayFetchResults {
  h4?: TwelveDataResult;
  h1?: TwelveDataResult;
  m15?: TwelveDataResult;
}

// Pure decision layer — no fetch calls. Mirrors resolveGatewayHistory's
// contract: given whichever results were already obtained, decide the
// final per-timeframe quality and build the result.
export function resolveTimeframeGatewayHistory(symbol: string, results: TimeframeGatewayFetchResults = {}): TimeframeGatewayResult {
  const entry = getRoutingEntry(symbol);

  // Only forex/gold/crypto are TwelveData-routed and therefore capable of
  // real intraday history. Every other class (indices, no-route symbols)
  // gets an honest, empty intraday set — never fabricated.
  const supportsIntraday = entry?.assetClass === "forex" || entry?.assetClass === "gold" || entry?.assetClass === "crypto";
  if (!supportsIntraday) {
    return { symbol, intraday: emptyIntraday(), meta: { providerUsed: "none", primaryFailure: null } };
  }

  const h4Result = results.h4;
  const h1Result = results.h1;
  const m15Result = results.m15;

  const h4Ok = !!h4Result && !h4Result.error && !!h4Result.data && h4Result.data.candles.length > 0;
  const h1Ok = !!h1Result && !h1Result.error && !!h1Result.data && h1Result.data.candles.length > 0;
  const m15Ok = !!m15Result && !m15Result.error && !!m15Result.data && m15Result.data.candles.length > 0;

  const intraday: IntradayHistory = {
    h4: h4Ok ? buildTimeframeCandles("h4", h4Result!, HISTORY_H4_OUTPUTSIZE) : emptyTimeframe("h4"),
    h1: h1Ok ? buildTimeframeCandles("h1", h1Result!, HISTORY_H1_OUTPUTSIZE) : emptyTimeframe("h1"),
    m15: m15Ok ? buildTimeframeCandles("m15", m15Result!, HISTORY_M15_OUTPUTSIZE) : emptyTimeframe("m15"),
  };

  const anyOk = h4Ok || h1Ok || m15Ok;
  const firstFailure = h4Result?.error ?? h1Result?.error ?? m15Result?.error ?? null;

  return {
    symbol,
    intraday,
    meta: { providerUsed: anyOk ? "twelvedata" : "none", primaryFailure: anyOk ? null : firstFailure },
  };
}

// Thin real-fetch wiring — the only place in this file that touches the
// network. No Alpha Vantage fallback for intraday: Alpha Vantage's
// provider file only types daily/weekly (never confirmed for intraday on
// this plan), so a TwelveData intraday failure is reported honestly rather
// than silently falling back to an unverified path.
export async function getTimeframeGatewayHistory(symbol: string): Promise<TimeframeGatewayResult> {
  const entry = getRoutingEntry(symbol);
  const supportsIntraday = entry?.assetClass === "forex" || entry?.assetClass === "gold" || entry?.assetClass === "crypto";
  if (!supportsIntraday) {
    return resolveTimeframeGatewayHistory(symbol, {});
  }

  const [h4, h1, m15] = await Promise.all([
    fetchTwelveDataH4History(entry!.twelveDataSymbol!),
    fetchTwelveDataH1History(entry!.twelveDataSymbol!),
    fetchTwelveDataM15History(entry!.twelveDataSymbol!),
  ]);

  return resolveTimeframeGatewayHistory(symbol, { h4, h1, m15 });
}
