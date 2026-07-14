import type { InstrumentKey } from "@/lib/market/types";
import { getMarketDataFromGateway } from "@/lib/market/marketDataGateway";
import { buildInstrumentMarketDataFromGatewayResult, normalizeCalendar } from "@/lib/market/marketIntelligence";
import { fetchFinnhubEconomicCalendar } from "@/lib/market/providers/finnhub";
import { getTimeframeGatewayHistory } from "./timeframeGateway";
import { MultiTimeframeHistory } from "./types";
import { composeEdgePulse, EdgePulseBrief } from "./composeEdgePulse";

// ============================================================
// Edge Pulse — orchestrator (SERVER-ONLY)
// ============================================================
// One instrument per call, fetched on demand (never all 4 eagerly like
// the shared marketIntelligence.ts orchestrator) — the multi-timeframe
// payload is materially heavier, and only Edge Pulse needs it. Reuses:
//   - getMarketDataFromGateway (daily+weekly, existing, unmodified)
//   - buildInstrumentMarketDataFromGatewayResult (existing, unmodified —
//     gives currentPrice/keyLevels/marketContext/MarketPulse in one call)
//   - normalizeCalendar (existing, unmodified)
// on top of which it adds ONLY the 3 new intraday fetches
// (timeframeGateway.ts) and its own economic-calendar fetch (Edge Pulse is
// intentionally a self-contained pipeline, not sharing MarketIntelligence's
// cached payload with EdgePilot/other consumers).

// US30's canonical Gateway routing symbol is "DJI" (the Gateway has no
// "US30" entry) — same mapping marketIntelligence.ts already uses.
// EURUSD/XAUUSD/NDX map to themselves (NDX has a ROUTING_TABLE entry
// tagged "us_index_unavailable", so both gateways already return an
// honest empty result for it with no network call — no special-casing
// needed here).
const GATEWAY_SYMBOL: Record<InstrumentKey, string> = {
  EURUSD: "EURUSD",
  XAUUSD: "XAUUSD",
  US30: "DJI",
  NDX: "NDX",
};

function dateInTimezone(now: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export interface EdgePulseResult {
  symbol: InstrumentKey;
  brief: EdgePulseBrief;
}

export async function getEdgePulse(symbol: InstrumentKey, timezone: string): Promise<EdgePulseResult> {
  const now = new Date();
  const tz = timezone || "UTC";
  const date = dateInTimezone(now, tz);
  const gatewaySymbol = GATEWAY_SYMBOL[symbol];

  const [gatewayResult, intradayResult, calendarRes] = await Promise.all([
    getMarketDataFromGateway(gatewaySymbol),
    getTimeframeGatewayHistory(gatewaySymbol),
    fetchFinnhubEconomicCalendar(date, date),
  ]);

  const instrumentData = buildInstrumentMarketDataFromGatewayResult(symbol, gatewayResult);
  const economicEvents = normalizeCalendar(calendarRes.raw);

  const history: MultiTimeframeHistory = {
    symbol,
    currentPrice: instrumentData.currentPrice,
    daily: { timeframe: "daily", candles: gatewayResult.history.dailyCandles, quality: gatewayResult.history.dataQuality.dailyHistory },
    h4: intradayResult.intraday.h4,
    h1: intradayResult.intraday.h1,
    m15: intradayResult.intraday.m15,
    weeklyCandles: gatewayResult.history.weeklyCandles,
  };

  // buildInstrumentMarketDataFromGatewayResult unconditionally computes and
  // attaches a MarketPulse (its own doc: "Always attempts Pulse, even on a
  // failed fetch") — never actually null, the broader type just allows it
  // generically across InstrumentMarketData's other call sites.
  const marketPulse = instrumentData.marketPulse!;

  const brief = composeEdgePulse(symbol, instrumentData.currentPrice, marketPulse, instrumentData.keyLevels, history, economicEvents, now);

  return { symbol, brief };
}
