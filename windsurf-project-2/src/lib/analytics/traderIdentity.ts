import { Trade } from "@/types";

// ============================================================
// PropEdge — Trader Identity engine (Trader DNA V1)
// ============================================================
// Pure, stateless helpers over a Trade[] list. Identity describes *how* a
// trader behaves — holding-time habits, market/session focus, direction
// lean — never *how well* they did. Every field here is derived purely
// from trade distribution and timing. This file never reads pnl, win
// rate, profit factor, expectancy, account balances, or challenge/funded
// status — those drive "Your Edge", a separate concern. Self-contained by
// design (no imports from traderDNA.ts or globalAnalytics.ts) so Identity
// can evolve independently of the rest of Trader DNA.
//
// The UI only renders this engine's output — no thresholds, categories,
// or labels are decided in a React component.

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

// ── Shared helpers ───────────────────────────────────────────────────────

function toTimestamp(dateStr: string, timeStr?: string): number | null {
  if (!dateStr) return null;
  const time = timeStr && /^\d{2}:\d{2}$/.test(timeStr) ? timeStr : "00:00";
  const ts = new Date(`${dateStr}T${time}:00`).getTime();
  return Number.isFinite(ts) ? ts : null;
}

// Minutes between entry and exit. Same-day trades missing either timestamp
// are excluded (duration would be ambiguous) rather than treated as
// zero-length; multi-day trades are still measured at day granularity even
// without times, defaulting the missing time-of-day to 00:00.
function getHoldingMinutes(trade: Trade): number | null {
  if (!trade.entryDate || !trade.exitDate) return null;
  const sameDay = trade.entryDate === trade.exitDate;
  if (sameDay && (!trade.entryTime || !trade.exitTime)) return null;
  const entry = toTimestamp(trade.entryDate, trade.entryTime);
  const exit = toTimestamp(trade.exitDate, trade.exitTime);
  if (entry === null || exit === null) return null;
  const diff = (exit - entry) / MS_PER_MINUTE;
  return diff >= 0 ? diff : null;
}

// Overnight/same-day only needs the two dates (not times), so it's
// computable for every trade regardless of whether entryTime/exitTime were
// ever recorded.
function isOvernight(trade: Trade): boolean {
  return !!trade.entryDate && !!trade.exitDate && trade.entryDate !== trade.exitDate;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function countBy<K extends string>(items: Trade[], keyFn: (t: Trade) => K): Partial<Record<K, number>> {
  const counts: Partial<Record<K, number>> = {};
  for (const item of items) {
    const k = keyFn(item);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

// Largest bucket by count. Ties resolve to whichever key iterates first
// (stable insertion order), matching the same tie-breaking already used by
// traderDNA.ts's mostFrequent().
function topEntry<K extends string>(counts: Partial<Record<K, number>>): { key: K | null; count: number } {
  let key: K | null = null;
  let count = -1;
  for (const k of Object.keys(counts) as K[]) {
    const c = counts[k] ?? 0;
    if (c > count) {
      key = k;
      count = c;
    }
  }
  return { key, count: Math.max(count, 0) };
}

// ── 1. Trading Style ─────────────────────────────────────────────────────
// Classified from holding-time habits only — never pnl. Median is the
// primary signal (robust to a handful of outlier holds); overnight ratio
// corroborates it, and average holding time acts as an independent
// override so a trader whose median looks short but who regularly carries
// a few very long holds (dragging the average way up) still reads as
// something other than a pure scalper/intraday trader.

export type TradingStyle = "Scalper" | "Intraday Trader" | "Swing Trader" | "Position Trader" | "Not enough data";

// A scalper's typical hold is well under half an hour and essentially
// never crosses into the next day.
const SCALPER_MEDIAN_MAX_MINUTES = 15;
const SCALPER_MAX_OVERNIGHT_RATIO = 0.05;

// An intraday trader's typical hold stays within the trading day (up to a
// few hours) with only an occasional accidental overnight carry.
const INTRADAY_MEDIAN_MAX_MINUTES = 6 * MINUTES_PER_HOUR;
const INTRADAY_MAX_OVERNIGHT_RATIO = 0.2;

// Position trading is defined by hold *duration* running multiple days —
// either the typical (median) hold does, or a handful of very long holds
// pull the average up into multi-day territory even if the median doesn't.
// Overnight ratio deliberately plays no part in this check: a swing trader
// who reliably holds for two days is "overnight" on essentially 100% of
// trades too, so a high overnight ratio alone can't distinguish a 2-day
// swing hold from a 2-month position hold — only duration can.
const POSITION_MEDIAN_MIN_MINUTES = 3 * MINUTES_PER_DAY;
const POSITION_AVERAGE_MIN_MINUTES = 3 * MINUTES_PER_DAY;

// sameDayCloseRatio is computed alongside overnightRatio (they're
// complements whenever a trade has both dates) purely so callers/tests can
// read intent directly off "same-day ratio is high" without recomputing
// 1 - overnightRatio themselves.
function classifyTradingStyle(
  averageHoldingMinutes: number,
  medianHoldingMinutes: number,
  overnightRatio: number,
  sameDayCloseRatio: number
): TradingStyle {
  if (medianHoldingMinutes < SCALPER_MEDIAN_MAX_MINUTES && overnightRatio <= SCALPER_MAX_OVERNIGHT_RATIO) {
    return "Scalper";
  }

  if (medianHoldingMinutes >= POSITION_MEDIAN_MIN_MINUTES || averageHoldingMinutes >= POSITION_AVERAGE_MIN_MINUTES) {
    return "Position Trader";
  }

  if (
    medianHoldingMinutes < INTRADAY_MEDIAN_MAX_MINUTES &&
    overnightRatio <= INTRADAY_MAX_OVERNIGHT_RATIO &&
    sameDayCloseRatio >= 1 - INTRADAY_MAX_OVERNIGHT_RATIO
  ) {
    return "Intraday Trader";
  }

  return "Swing Trader";
}

// ── 2. Market Specialization ─────────────────────────────────────────────
// Symbol -> asset-class classification, purely from the symbol string —
// no performance data involved.

type MarketCategory = "Forex" | "Indices" | "Gold" | "Silver" | "Oil" | "Crypto" | "Other";

const CRYPTO_TICKERS = [
  "BTC", "ETH", "XRP", "LTC", "BCH", "SOL", "ADA", "DOGE", "DOT",
  "BNB", "AVAX", "MATIC", "LINK", "TRX", "ATOM", "XLM", "UNI", "ETC",
];

const INDEX_TICKERS = [
  "US30", "US100", "US500", "USTEC", "NAS100", "SPX500", "SP500", "US2000",
  "DE30", "DE40", "DAX40", "GER30", "GER40", "UK100", "FTSE100",
  "JPN225", "NIKKEI225", "N225", "AUS200", "ASX200", "HK50", "HSI",
  "EU50", "STOXX50", "FRA40", "CAC40", "ESP35", "IBEX35",
];

const OIL_TICKERS = ["USOIL", "UKOIL", "WTI", "BRENT", "XTIUSD", "XBRUSD", "UKOUSD", "USOUSD"];

const CURRENCY_CODES = new Set([
  "USD", "EUR", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF", "CNH", "CNY",
  "SEK", "NOK", "DKK", "SGD", "HKD", "MXN", "ZAR", "TRY", "PLN", "HUF", "CZK", "THB",
]);

function normalizeSymbol(symbol: string): string {
  return (symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function classifyMarket(symbol: string): MarketCategory {
  const s = normalizeSymbol(symbol);
  if (!s) return "Other";

  if (s.includes("XAU") || s === "GOLD") return "Gold";
  if (s.includes("XAG") || s === "SILVER") return "Silver";
  if (OIL_TICKERS.some((t) => s.includes(t))) return "Oil";
  if (CRYPTO_TICKERS.some((t) => s.startsWith(t))) return "Crypto";
  if (INDEX_TICKERS.some((t) => s === t || s.startsWith(t))) return "Indices";

  // Forex: six letters forming two recognized 3-letter currency codes
  // (e.g. EURUSD = EUR + USD) — the dominant broker-symbol convention.
  if (s.length === 6 && CURRENCY_CODES.has(s.slice(0, 3)) && CURRENCY_CODES.has(s.slice(3, 6))) {
    return "Forex";
  }

  return "Other";
}

const SPECIALIZATION_MIN_TRADES = 30;
const SPECIALIZATION_MIN_SHARE = 0.6;
const MULTI_MARKET_TRADER = "Multi-Market Trader";
const MULTI_SESSION_TRADER = "Multi-Session Trader";

function determineMarketSpecialization(trades: Trade[]): string {
  if (trades.length < SPECIALIZATION_MIN_TRADES) return MULTI_MARKET_TRADER;

  const counts = countBy(trades, (t) => classifyMarket(t.symbol));
  const { key, count } = topEntry(counts);
  // "Other" has no clean specialist label, so it never produces one even
  // if it happens to be the largest bucket.
  if (key && key !== "Other" && count / trades.length >= SPECIALIZATION_MIN_SHARE) {
    return `${key} Specialist`;
  }
  return MULTI_MARKET_TRADER;
}

// ── 3. Session Profile ───────────────────────────────────────────────────
// Based purely on session distribution — never win rate, never pnl.

function determineSessionProfile(trades: Trade[]): string {
  if (trades.length < SPECIALIZATION_MIN_TRADES) return MULTI_SESSION_TRADER;

  const counts = countBy(trades, (t) => t.session ?? "Unknown");
  const { key, count } = topEntry(counts);
  if (key && key !== "Unknown" && count / trades.length >= SPECIALIZATION_MIN_SHARE) {
    return `${key} Specialist`;
  }
  return MULTI_SESSION_TRADER;
}

// ── 4. Direction Bias ────────────────────────────────────────────────────

export type DirectionBias = "Long Bias" | "Short Bias" | "Neutral";

const DIRECTION_BIAS_MIN_SHARE = 0.6;

function determineDirectionBias(trades: Trade[]): DirectionBias {
  if (trades.length === 0) return "Neutral";
  const longCount = trades.filter((t) => t.direction === "long").length;
  const shortCount = trades.length - longCount;
  if (longCount / trades.length >= DIRECTION_BIAS_MIN_SHARE) return "Long Bias";
  if (shortCount / trades.length >= DIRECTION_BIAS_MIN_SHARE) return "Short Bias";
  return "Neutral";
}

// ── Metadata ──────────────────────────────────────────────────────────────

export interface TraderIdentityMetadata {
  sampleSize: number;
  tradingDays: number;
  firstTrade: string | null; // "YYYY-MM-DD"
  lastTrade: string | null; // "YYYY-MM-DD"
}

// ── TraderIdentity ────────────────────────────────────────────────────────

export interface TraderIdentity {
  tradingStyle: TradingStyle;
  marketSpecialization: string;
  sessionProfile: string;
  directionBias: DirectionBias;
  metadata: TraderIdentityMetadata;
}

export function getTraderIdentity(trades: Trade[]): TraderIdentity {
  const valid = trades.filter((t) => !!t.entryDate);
  const sorted = [...valid].sort((a, b) => a.entryDate.localeCompare(b.entryDate));
  const sampleSize = sorted.length;

  const tradingDays = new Set(sorted.map((t) => t.entryDate)).size;
  const firstTrade = sampleSize > 0 ? sorted[0].entryDate : null;
  const lastTrade = sampleSize > 0 ? sorted[sampleSize - 1].entryDate : null;

  let tradingStyle: TradingStyle;
  if (sampleSize === 0) {
    tradingStyle = "Not enough data";
  } else {
    const holdingTimes = sorted.map(getHoldingMinutes).filter((m): m is number => m !== null);
    const averageHoldingMinutes =
      holdingTimes.length > 0 ? holdingTimes.reduce((s, m) => s + m, 0) / holdingTimes.length : 0;
    const medianHoldingMinutes = median(holdingTimes);

    const overnightCount = sorted.filter(isOvernight).length;
    const overnightRatio = overnightCount / sampleSize;
    const sameDayCloseRatio = 1 - overnightRatio;

    tradingStyle = classifyTradingStyle(averageHoldingMinutes, medianHoldingMinutes, overnightRatio, sameDayCloseRatio);
  }

  return {
    tradingStyle,
    marketSpecialization: determineMarketSpecialization(sorted),
    sessionProfile: determineSessionProfile(sorted),
    directionBias: determineDirectionBias(sorted),
    metadata: {
      sampleSize,
      tradingDays,
      firstTrade,
      lastTrade,
    },
  };
}
