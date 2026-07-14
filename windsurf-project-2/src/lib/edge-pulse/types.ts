import type { HistoryQuality, MarketCandle } from "@/lib/market/types";

// ============================================================
// Edge Pulse — types (provider-independent)
// ============================================================
// Edge-Pulse-only shapes. Nothing here is imported by marketPulse.ts,
// marketIntelligence.ts, or any other MarketPulse-family file — Edge Pulse
// composes THEIR outputs, it never feeds back into them.

// The 4 timeframes Section 2 (Market Structure) requires. Weekly/Monthly
// are handled separately (Institutional Levels only) — they are not
// "Structure" timeframes in the spec's sense.
export type Timeframe = "daily" | "h4" | "h1" | "m15";
export const STRUCTURE_TIMEFRAMES: Timeframe[] = ["daily", "h4", "h1", "m15"];

export const TIMEFRAME_LABEL: Record<Timeframe, string> = {
  daily: "Daily",
  h4: "H4",
  h1: "H1",
  m15: "M15",
};

export interface TimeframeCandles {
  timeframe: Timeframe;
  candles: MarketCandle[]; // newest-first, same convention as InstrumentMarketHistory.dailyCandles
  quality: HistoryQuality;
}

// One instrument's full multi-timeframe candle set. `daily`/`weeklyCandles`
// are always sourced from the EXISTING marketDataGateway.ts fetch (never
// re-fetched) — only h4/h1/m15 are fetched by timeframeGateway.ts. An
// instrument that structurally cannot get a timeframe (e.g. US30/FMP has
// no intraday endpoint) reports that timeframe with quality "unavailable"
// and an empty candles array — never fabricated, never substituted from a
// different timeframe.
export interface MultiTimeframeHistory {
  symbol: string;
  currentPrice: number | null;
  daily: TimeframeCandles;
  h4: TimeframeCandles;
  h1: TimeframeCandles;
  m15: TimeframeCandles;
  weeklyCandles: MarketCandle[]; // Institutional Levels only (Weekly Open, Prev Week High/Low) — not a Structure timeframe
}
