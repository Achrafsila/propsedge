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
// Classified from a single statistic — median holding time — and nothing
// else. This is a strict duration ladder: every bucket boundary is a
// holding-time threshold, checked in ascending order, so the result is
// always consistent with the holding time this same engine reports
// elsewhere (e.g. a 3-minute median can never land outside the Scalper
// bucket). Earlier revisions additionally gated the short-duration tiers
// on "overnight ratio" and let a separate average-holding-time figure
// override the Position Trader check — that let a trader with a
// low/short median still be classified as something other than a
// duration-appropriate tier (e.g. "Intraday Trader" despite a 3-minute
// median, if a handful of trades happened to carry overnight). Both of
// those extra signals are removed; only medianHoldingMinutes decides the
// bucket now.

export type TradingStyle =
  | "Scalper"
  | "Momentum Scalper"
  | "Intraday Trader"
  | "Swing Intraday"
  | "Swing Trader"
  | "Position Trader"
  | "Not enough data";

const SCALPER_MAX_MINUTES = 5;
const MOMENTUM_SCALPER_MAX_MINUTES = 15;
const INTRADAY_MAX_MINUTES = 4 * MINUTES_PER_HOUR;
const SWING_INTRADAY_MAX_MINUTES = MINUTES_PER_DAY;
const SWING_TRADER_MAX_MINUTES = 5 * MINUTES_PER_DAY;

function classifyTradingStyle(medianHoldingMinutes: number): TradingStyle {
  if (medianHoldingMinutes < SCALPER_MAX_MINUTES) return "Scalper";
  if (medianHoldingMinutes < MOMENTUM_SCALPER_MAX_MINUTES) return "Momentum Scalper";
  if (medianHoldingMinutes < INTRADAY_MAX_MINUTES) return "Intraday Trader";
  if (medianHoldingMinutes < SWING_INTRADAY_MAX_MINUTES) return "Swing Intraday";
  if (medianHoldingMinutes < SWING_TRADER_MAX_MINUTES) return "Swing Trader";
  return "Position Trader";
}

// A short, deterministic sentence describing the median hold in plain
// language, reusing the exact medianHoldingMinutes this engine already
// computes for classifyTradingStyle() — no new timing calculation, just a
// human-readable rendering of the same number the bucket was chosen from.
const STYLE_CATEGORY_LABEL: Record<Exclude<TradingStyle, "Not enough data">, string> = {
  Scalper: "scalping",
  "Momentum Scalper": "momentum scalping",
  "Intraday Trader": "intraday trading",
  "Swing Intraday": "swing-intraday trading",
  "Swing Trader": "swing trading",
  "Position Trader": "position trading",
};

// Also used verbatim by traderHabits.ts (duplicated there, not imported,
// per this file's self-contained convention) so the two cards' holding-time
// figures render as the exact same text, not just the same number.
function formatHoldingDuration(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded < MINUTES_PER_HOUR) {
    return `${rounded} minute${rounded === 1 ? "" : "s"}`;
  }
  if (minutes < MINUTES_PER_DAY) {
    const hours = Math.round(minutes / MINUTES_PER_HOUR);
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  const days = Math.round(minutes / MINUTES_PER_DAY);
  return `${days} day${days === 1 ? "" : "s"}`;
}

function explainTradingStyle(style: TradingStyle, medianHoldingMinutes: number): string {
  if (style === "Not enough data") {
    return "Not enough trade history yet to identify a holding-time pattern.";
  }
  const duration = formatHoldingDuration(medianHoldingMinutes);
  const category = STYLE_CATEGORY_LABEL[style];
  return `You typically hold positions for around ${duration}, placing your execution in the ${category} category.`;
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
// Market Focus reads per-instrument dominance (e.g. XAUUSD alone > 60% of
// trades), not aggregated asset-class share — a trader split evenly across
// several forex pairs is a Multi-Asset Trader even if "Forex" as a class
// would clear 60% in aggregate.
const MARKET_MIN_SHARE = 0.6;
// Session Profile only needs a simple majority — one session doesn't have
// to be nearly exclusive to count as the dominant one.
const SESSION_MIN_SHARE = 0.5;
const MULTI_ASSET_TRADER = "Multi-Asset Trader";
const BALANCED_SESSIONS = "Balanced Sessions";

function determineMarketSpecialization(trades: Trade[]): string {
  if (trades.length < SPECIALIZATION_MIN_TRADES) return MULTI_ASSET_TRADER;

  const counts = countBy(trades, (t) => t.symbol || "Unknown");
  const { key, count } = topEntry(counts);
  if (!key || key === "Unknown" || count / trades.length < MARKET_MIN_SHARE) {
    return MULTI_ASSET_TRADER;
  }

  // "Other" has no clean specialist label, so it never produces one even
  // if the dominant instrument happens to fall in that category.
  const category = classifyMarket(key);
  if (category === "Other") return MULTI_ASSET_TRADER;
  return `${category} Specialist`;
}

// Per-instrument share of trades (e.g. "XAUUSD" -> 52%), for the Market
// Focus card's distribution line. A different grouping than
// determineMarketSpecialization above (which buckets by asset *class*, not
// ticker), but built with the same countBy/percentage approach used
// throughout this file.
export interface InstrumentShare {
  symbol: string;
  percentage: number;
}

const TOP_INSTRUMENT_COUNT = 2;

function getTopInstruments(trades: Trade[]): InstrumentShare[] {
  if (trades.length === 0) return [];

  const counts = countBy(trades, (t) => t.symbol || "Unknown");
  return Object.entries(counts)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
    .slice(0, TOP_INSTRUMENT_COUNT)
    .map(([symbol, count]) => ({
      symbol,
      percentage: Math.round(((count ?? 0) / trades.length) * 100),
    }));
}

// ── 3. Session Profile ───────────────────────────────────────────────────
// Based purely on session distribution — never win rate, never pnl.

function getSessionCounts(trades: Trade[]): Partial<Record<string, number>> {
  return countBy(trades, (t) => t.session ?? "Unknown");
}

function determineSessionProfile(trades: Trade[], counts: Partial<Record<string, number>>): string {
  if (trades.length < SPECIALIZATION_MIN_TRADES) return BALANCED_SESSIONS;

  const { key, count } = topEntry(counts);
  if (key && key !== "Unknown" && count / trades.length >= SESSION_MIN_SHARE) {
    return key;
  }
  return BALANCED_SESSIONS;
}

// Real session distribution for display, reusing the exact counts
// determineSessionProfile() classifies from. "Unknown" (no session
// recorded) is excluded — it isn't a real session to report a share for.
export interface SessionShare {
  session: string;
  percentage: number;
}

function getSessionDistribution(trades: Trade[], counts: Partial<Record<string, number>>): SessionShare[] {
  if (trades.length === 0) return [];

  return Object.entries(counts)
    .filter(([session, count]) => session !== "Unknown" && (count ?? 0) > 0)
    .map(([session, count]) => ({
      session,
      percentage: Math.round(((count ?? 0) / trades.length) * 100),
    }))
    .sort((a, b) => b.percentage - a.percentage);
}

// ── Executive Summary ────────────────────────────────────────────────────
// A single deterministic sentence stitched together from the three
// classifications above (tradingStyle, marketSpecialization,
// sessionProfile) — no data this engine hasn't already computed.

const STYLE_NOUN_WITH_ARTICLE: Record<Exclude<TradingStyle, "Not enough data">, string> = {
  Scalper: "a scalper",
  "Momentum Scalper": "a momentum scalper",
  "Intraday Trader": "an intraday trader",
  "Swing Intraday": "a swing-intraday trader",
  "Swing Trader": "a swing trader",
  "Position Trader": "a position trader",
};

function marketFocusPhrase(marketSpecialization: string): string {
  if (marketSpecialization === MULTI_ASSET_TRADER) return "no strong market specialization";
  return `a clear ${marketSpecialization.replace(" Specialist", "")} market focus`;
}

function sessionProfilePhrase(sessionProfile: string): string {
  if (sessionProfile === BALANCED_SESSIONS) return "no dominant session preference";
  return `a clear ${sessionProfile} session preference`;
}

function buildExecutiveSummary(
  tradingStyle: TradingStyle,
  marketSpecialization: string,
  sessionProfile: string
): string {
  if (tradingStyle === "Not enough data") {
    return "Not enough trade history yet to build a trading identity summary.";
  }
  return `Your trading identity is that of ${STYLE_NOUN_WITH_ARTICLE[tradingStyle]} with ${marketFocusPhrase(marketSpecialization)} and ${sessionProfilePhrase(sessionProfile)}.`;
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
  tradingStyleExplanation: string;
  marketSpecialization: string;
  topInstruments: InstrumentShare[];
  sessionProfile: string;
  sessionDistribution: SessionShare[];
  executiveSummary: string;
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
  let medianHoldingMinutes = 0;
  if (sampleSize === 0) {
    tradingStyle = "Not enough data";
  } else {
    const holdingTimes = sorted.map(getHoldingMinutes).filter((m): m is number => m !== null);
    medianHoldingMinutes = median(holdingTimes);
    tradingStyle = holdingTimes.length === 0 ? "Not enough data" : classifyTradingStyle(medianHoldingMinutes);
  }

  const marketSpecialization = determineMarketSpecialization(sorted);
  const sessionCounts = getSessionCounts(sorted);
  const sessionProfile = determineSessionProfile(sorted, sessionCounts);

  return {
    tradingStyle,
    tradingStyleExplanation: explainTradingStyle(tradingStyle, medianHoldingMinutes),
    marketSpecialization,
    topInstruments: getTopInstruments(sorted),
    sessionProfile,
    sessionDistribution: getSessionDistribution(sorted, sessionCounts),
    executiveSummary: buildExecutiveSummary(tradingStyle, marketSpecialization, sessionProfile),
    metadata: {
      sampleSize,
      tradingDays,
      firstTrade,
      lastTrade,
    },
  };
}
