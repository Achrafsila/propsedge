import { HistoryQuality, InstrumentMarketHistory, MarketCandle } from "./types";
import {
  Candle,
  TwelveDataResult,
  HISTORY_DAILY_OUTPUTSIZE,
  HISTORY_WEEKLY_OUTPUTSIZE,
  fetchTwelveDataDailyHistory,
  fetchTwelveDataWeeklyHistory,
} from "./providers/twelvedata";

// ============================================================
// PropEdge — Market Data foundation (SERVER-ONLY)
// ============================================================
// Normalizes the deep-history TwelveData fetches into InstrumentMarketHistory.
// Foundation only: no Market Pulse/Regime/Phase/Conviction/Volatility/
// Opportunity/Liquidity/Breakout logic lives here, and nothing in the
// existing orchestrator (marketIntelligence.ts), Market Context
// (marketContext.ts), the API route, or the UI calls this yet. Never
// invents data — a candle list is exactly what the provider returned,
// possibly shorter than requested (dataQuality reflects that), never
// padded or guessed.

function toMarketCandle(c: Candle): MarketCandle {
  return { datetime: c.datetime, open: c.open, high: c.high, low: c.low, close: c.close };
}

function classifyQuality(actualCount: number, expectedCount: number): HistoryQuality {
  if (actualCount === 0) return "unavailable";
  return actualCount < expectedCount ? "partial" : "complete";
}

// Builds the normalized history structure for one instrument from the two
// already-fetched raw TwelveData results. currentPrice mirrors the same
// "close of the newest (index 0) candle" rule normalizeInstrumentFromTD
// already uses for the live path, so a future consumer sees an identical
// current price regardless of which fetch depth it reads from.
export function buildInstrumentMarketHistory(
  symbol: string,
  dailyResult: TwelveDataResult,
  weeklyResult: TwelveDataResult
): InstrumentMarketHistory {
  const dailyCandles = (dailyResult.data?.candles ?? []).map(toMarketCandle);
  const weeklyCandles = (weeklyResult.data?.candles ?? []).map(toMarketCandle);

  return {
    symbol,
    currentPrice: dailyCandles[0]?.close ?? null,
    dailyCandles,
    weeklyCandles,
    dataQuality: {
      dailyHistory: classifyQuality(dailyCandles.length, HISTORY_DAILY_OUTPUTSIZE),
      weeklyHistory: classifyQuality(weeklyCandles.length, HISTORY_WEEKLY_OUTPUTSIZE),
    },
  };
}

// Convenience fetch+normalize in one call. `tdSymbol` is the raw TwelveData
// symbol ("EUR/USD", "XAU/USD"); `displaySymbol` is the internal key
// ("EURUSD", "XAUUSD") — same split normalizeInstrumentFromTD already uses
// between its TD fetch and its display symbol.
export async function getInstrumentMarketHistory(displaySymbol: string, tdSymbol: string): Promise<InstrumentMarketHistory> {
  const [dailyResult, weeklyResult] = await Promise.all([
    fetchTwelveDataDailyHistory(tdSymbol),
    fetchTwelveDataWeeklyHistory(tdSymbol),
  ]);
  return buildInstrumentMarketHistory(displaySymbol, dailyResult, weeklyResult);
}
