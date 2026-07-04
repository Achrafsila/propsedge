import { Trade } from "@/types";

// ============================================================
// PropEdge — Trader DNA engine (behavioural statistics layer)
// ============================================================
// Pure, stateless helpers over a Trade[] list. This is the single source
// of truth for every future Trader DNA insight — trading frequency,
// consistency, preferred session/instrument/direction/day, streaks, and
// trading age.
//
// Hard boundary: this engine only ever reads trade-level fields (dates,
// times, session, symbol, direction, pnl). It never reads account
// balances, challenge/funded status, or anything from the Business
// Metrics engine (src/lib/challenges.ts) or the Operational View engine
// (src/lib/analytics/globalAnalytics.ts) — Trader DNA describes *how*
// someone trades, not whether they're currently profitable or funded.
// There is no AI here, and no personality inference, trader
// classification, or composite scoring — only reliable behavioural
// statistics for the UI to consume later.

// ── Confidence ───────────────────────────────────────────────────────────
// Every derived insight (preferred session, preferred instrument, trading
// frequency, ...) is only as trustworthy as the sample it's drawn from.
// Confidence grows with sample size and asymptotically approaches 1,
// using a half-saturation curve:
//
//   confidence = sampleSize / (sampleSize + HALF_SATURATION_SAMPLE_SIZE)
//
// HALF_SATURATION_SAMPLE_SIZE is the sample size at which confidence
// crosses 0.5. It's set to 20: with fewer than ~20 trades an insight is
// still mostly a guess (confidence < 0.5); by ~180 trades confidence
// exceeds 0.9. This keeps Trader DNA from calling a pattern "preferred"
// with high confidence after only 2-3 trades.
const HALF_SATURATION_SAMPLE_SIZE = 20;

export function computeConfidence(sampleSize: number): number {
  if (sampleSize <= 0) return 0;
  return sampleSize / (sampleSize + HALF_SATURATION_SAMPLE_SIZE);
}

export interface DNAInsight<T> {
  value: T;
  confidence: number; // 0–1, see computeConfidence
  sampleSize: number;
}

function buildInsight<T>(value: T, sampleSize: number): DNAInsight<T> {
  return { value, confidence: computeConfidence(sampleSize), sampleSize };
}

// ── Shared vocabulary ────────────────────────────────────────────────────

export type SessionKey = "London" | "New York" | "Asian" | "No Session";
export type TradeDirection = "long" | "short";
export type DayOfWeek =
  | "Sunday"
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday";

const DAY_NAMES: DayOfWeek[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

function getSessionKey(trade: Trade): SessionKey {
  return trade.session ?? "No Session";
}

function getDayOfWeek(dateStr: string): DayOfWeek | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? null : DAY_NAMES[date.getDay()];
}

function getHourOfDay(timeStr?: string): number | null {
  if (!timeStr) return null;
  const [h] = timeStr.split(":").map(Number);
  return Number.isInteger(h) && h >= 0 && h <= 23 ? h : null;
}

function toTimestamp(dateStr: string, timeStr?: string): number | null {
  if (!dateStr) return null;
  const time = timeStr && /^\d{2}:\d{2}$/.test(timeStr) ? timeStr : "00:00";
  const ts = new Date(`${dateStr}T${time}:00`).getTime();
  return Number.isFinite(ts) ? ts : null;
}

// Minutes between entry and exit. Same-day trades missing either
// timestamp are excluded (duration would be ambiguous) rather than
// treated as zero-length; multi-day trades are still measured at day
// granularity even without times.
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

function sortChronologically(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => {
    const dateCompare = a.entryDate.localeCompare(b.entryDate);
    if (dateCompare !== 0) return dateCompare;
    return (a.entryTime ?? "").localeCompare(b.entryTime ?? "");
  });
}

function groupBy<K extends string>(trades: Trade[], keyFn: (t: Trade) => K): Map<K, Trade[]> {
  const map = new Map<K, Trade[]>();
  for (const t of trades) {
    const k = keyFn(t);
    const bucket = map.get(k);
    if (bucket) bucket.push(t);
    else map.set(k, [t]);
  }
  return map;
}

function countBy<K extends string>(trades: Trade[], keyFn: (t: Trade) => K): Record<K, number> {
  const counts = {} as Record<K, number>;
  for (const t of trades) {
    const k = keyFn(t);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

function mostFrequent<K extends string>(counts: Partial<Record<K, number>>): K | null {
  let best: K | null = null;
  let bestCount = -1;
  for (const key of Object.keys(counts) as K[]) {
    const count = counts[key] ?? 0;
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

// ── TraderDNAStats ────────────────────────────────────────────────────────

export interface TraderDNAStats {
  // General
  totalTrades: number;
  totalTradingDays: number;
  averageTradesPerDay: number;
  averageHoldingTime: number; // minutes; 0 if no trade has a computable duration
  firstTradeHour: number | null; // 0–23, earliest hour of day a trade was entered
  lastTradeHour: number | null; // 0–23, latest hour of day a trade was entered

  // Trading Behaviour
  preferredInstrument: string | null;
  preferredSession: SessionKey | null;
  preferredDirection: TradeDirection | null;
  preferredTradingDay: DayOfWeek | null;

  // Distribution
  tradesByInstrument: Record<string, number>;
  tradesBySession: Record<SessionKey, number>;
  tradesByDay: Record<DayOfWeek, number>;
  tradesByDirection: Record<TradeDirection, number>;

  // Consistency
  profitableDays: number;
  losingDays: number;
  breakEvenDays: number;

  // Streaks
  longestWinningStreak: number;
  longestLosingStreak: number;

  // Metadata
  firstTradeDate: string | null;
  latestTradeDate: string | null;
  tradingAgeDays: number;
}

export function getTraderDNAStats(trades: Trade[]): TraderDNAStats {
  const sorted = sortChronologically(trades.filter((t) => !!t.entryDate));
  const totalTrades = sorted.length;

  // ── General ──
  const byDate = groupBy(sorted, (t) => t.entryDate);
  const totalTradingDays = byDate.size;
  const averageTradesPerDay = totalTradingDays > 0 ? totalTrades / totalTradingDays : 0;

  const holdingTimes = sorted.map(getHoldingMinutes).filter((m): m is number => m !== null);
  const averageHoldingTime =
    holdingTimes.length > 0 ? holdingTimes.reduce((s, m) => s + m, 0) / holdingTimes.length : 0;

  const hours = sorted.map((t) => getHourOfDay(t.entryTime)).filter((h): h is number => h !== null);
  const firstTradeHour = hours.length > 0 ? Math.min(...hours) : null;
  const lastTradeHour = hours.length > 0 ? Math.max(...hours) : null;

  // ── Distribution ── (all frequency counts — never weighted by pnl)
  const tradesByInstrument = countBy(sorted, (t) => t.symbol || "Unknown");
  const tradesBySession = countBy(sorted, getSessionKey);
  const tradesWithDay = sorted.filter((t) => getDayOfWeek(t.entryDate) !== null);
  const tradesByDay = countBy(tradesWithDay, (t) => getDayOfWeek(t.entryDate) as DayOfWeek);
  const tradesByDirection = countBy(sorted, (t) => t.direction);

  // ── Trading Behaviour ── (most-frequent bucket — describes habits, not
  // performance, so this is never ranked by pnl)
  const preferredInstrument = mostFrequent<string>(tradesByInstrument);
  const preferredSession = mostFrequent<SessionKey>(tradesBySession);
  const preferredDirection = mostFrequent<TradeDirection>(tradesByDirection);
  const preferredTradingDay = mostFrequent<DayOfWeek>(tradesByDay);

  // ── Consistency ── (per-day net pnl sign; pnl is a trade-level field
  // already on Trade, not an account balance or business metric)
  let profitableDays = 0;
  let losingDays = 0;
  let breakEvenDays = 0;
  for (const dayTrades of byDate.values()) {
    const dayPnL = dayTrades.reduce((s, t) => s + t.pnl, 0);
    if (dayPnL > 0) profitableDays += 1;
    else if (dayPnL < 0) losingDays += 1;
    else breakEvenDays += 1;
  }

  // ── Streaks ── (per trade, chronological win/loss runs)
  let longestWinningStreak = 0;
  let longestLosingStreak = 0;
  let runType: "win" | "loss" | "none" = "none";
  let runCount = 0;
  for (const t of sorted) {
    const type: "win" | "loss" | "none" = t.pnl > 0 ? "win" : t.pnl < 0 ? "loss" : "none";
    if (type === runType && type !== "none") {
      runCount += 1;
    } else {
      runType = type;
      runCount = type === "none" ? 0 : 1;
    }
    if (runType === "win") longestWinningStreak = Math.max(longestWinningStreak, runCount);
    if (runType === "loss") longestLosingStreak = Math.max(longestLosingStreak, runCount);
  }

  // ── Metadata ──
  const firstTradeDate = sorted.length > 0 ? sorted[0].entryDate : null;
  const latestTradeDate = sorted.length > 0 ? sorted[sorted.length - 1].entryDate : null;
  const tradingAgeDays =
    firstTradeDate && latestTradeDate
      ? Math.round((new Date(latestTradeDate).getTime() - new Date(firstTradeDate).getTime()) / MS_PER_DAY) + 1
      : 0;

  return {
    totalTrades,
    totalTradingDays,
    averageTradesPerDay,
    averageHoldingTime,
    firstTradeHour,
    lastTradeHour,
    preferredInstrument,
    preferredSession,
    preferredDirection,
    preferredTradingDay,
    tradesByInstrument,
    tradesBySession,
    tradesByDay,
    tradesByDirection,
    profitableDays,
    losingDays,
    breakEvenDays,
    longestWinningStreak,
    longestLosingStreak,
    firstTradeDate,
    latestTradeDate,
    tradingAgeDays,
  };
}

// ── Insight helpers ───────────────────────────────────────────────────────
// Thin, individually-callable wrappers around getTraderDNAStats() for
// components that only need one insight plus its confidence/sampleSize.
// None of these rank or weight by pnl — sampleSize is always a count of
// trades or trading days, never a dollar amount.

export function getTradingFrequency(trades: Trade[]): DNAInsight<number> {
  const stats = getTraderDNAStats(trades);
  return buildInsight(stats.averageTradesPerDay, stats.totalTradingDays);
}

export function getPreferredSession(trades: Trade[]): DNAInsight<SessionKey | null> {
  const stats = getTraderDNAStats(trades);
  return buildInsight(stats.preferredSession, stats.totalTrades);
}

export function getPreferredInstrument(trades: Trade[]): DNAInsight<string | null> {
  const stats = getTraderDNAStats(trades);
  return buildInsight(stats.preferredInstrument, stats.totalTrades);
}

export function getPreferredDirection(trades: Trade[]): DNAInsight<TradeDirection | null> {
  const stats = getTraderDNAStats(trades);
  return buildInsight(stats.preferredDirection, stats.totalTrades);
}

export function getTradingAge(trades: Trade[]): DNAInsight<number> {
  const stats = getTraderDNAStats(trades);
  return buildInsight(stats.tradingAgeDays, stats.totalTrades);
}

// ── Net Profit ───────────────────────────────────────────────────────────
// Shared by every profitability-based KPI below (Prop Firm Consistency,
// Expectancy) so "net profit" is computed exactly once and can never drift
// between them.

function computeNetProfit(trades: Trade[]): number {
  return trades.reduce((sum, t) => sum + t.pnl, 0);
}

// ── Prop Firm Consistency ────────────────────────────────────────────────
// How much of total profit comes from a single best day — the metric prop
// firms use to flag traders who pass an evaluation on one lucky day rather
// than steady performance. Only meaningful against positive cumulative
// profit, so a trader who is net negative (or flat) has no consistency
// figure to report.

export interface PropFirmConsistency {
  percentage: number | null; // null when totalProfit <= 0 ("N/A")
  largestWinningDay: number;
  totalProfit: number;
}

export function getPropFirmConsistency(trades: Trade[]): PropFirmConsistency {
  const dated = trades.filter((t) => !!t.entryDate);
  const totalProfit = computeNetProfit(dated);

  const byDate = groupBy(dated, (t) => t.entryDate);
  let largestWinningDay = 0;
  for (const dayTrades of byDate.values()) {
    const dayPnL = computeNetProfit(dayTrades);
    if (dayPnL > largestWinningDay) largestWinningDay = dayPnL;
  }

  if (totalProfit <= 0) {
    return { percentage: null, largestWinningDay, totalProfit };
  }

  return { percentage: (largestWinningDay / totalProfit) * 100, largestWinningDay, totalProfit };
}

// ── Expectancy ───────────────────────────────────────────────────────────
// Average profit generated per trade: Net Profit / Total Trades. Reuses
// the same computeNetProfit() every other profitability KPI in this file
// uses, so "net profit" is never calculated two different ways.

export interface ExpectancyResult {
  expectancy: number | null; // null when there are no trades to divide by
  netProfit: number;
  totalTrades: number;
}

export function getExpectancy(trades: Trade[]): ExpectancyResult {
  const dated = trades.filter((t) => !!t.entryDate);
  const netProfit = computeNetProfit(dated);
  const totalTrades = dated.length;

  return {
    expectancy: totalTrades > 0 ? netProfit / totalTrades : null,
    netProfit,
    totalTrades,
  };
}

// ── Profit Factor ────────────────────────────────────────────────────────
// Gross Profit / Gross Loss — how many dollars of profit a trader
// generates for every dollar lost. Gross Loss is a magnitude (always
// added as a positive number), never signed, so it can sit directly in a
// denominator.

export interface ProfitFactorResult {
  profitFactor: number | null; // null when grossLoss is 0 ("∞" in the UI)
  grossProfit: number;
  grossLoss: number;
}

export function getProfitFactor(trades: Trade[]): ProfitFactorResult {
  const dated = trades.filter((t) => !!t.entryDate);

  let grossProfit = 0;
  let grossLoss = 0;
  for (const t of dated) {
    if (t.pnl > 0) grossProfit += t.pnl;
    else if (t.pnl < 0) grossLoss += Math.abs(t.pnl);
  }

  return {
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    grossProfit,
    grossLoss,
  };
}
