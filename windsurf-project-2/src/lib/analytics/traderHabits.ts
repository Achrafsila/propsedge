import { Trade } from "@/types";

// ============================================================
// PropEdge — Trader Habits engine (Trader DNA V1, Block 2)
// ============================================================
// Pure, stateless helpers over a Trade[] list. Habits answers exactly one
// question: "How do I naturally trade every day?" — frequency, holding
// time, the daily window a trader is active in, which weekday sees the
// most activity, and average entry/exit clock time.
//
// Hard boundary: this file never reads pnl, win/loss status, profit
// factor, expectancy, account balances, or challenge/funded status.
// Those describe performance ("Your Edge"), not behavior. Self-contained
// by design (no imports from traderDNA.ts, traderIdentity.ts, or
// globalAnalytics.ts), same convention as the rest of Trader DNA.
//
// Every field is returned already formatted for display — React only
// renders this object, it never decides thresholds, units, or fallback
// copy. The engine is a pure function of its input: the same trades
// always produce the same output.

const NOT_ENOUGH_DATA = "Not enough data";

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

// A "window" (typical daily start/end) needs a handful of days to be a
// pattern rather than a coincidence — one or two days is just what
// happened that day, not a routine.
const MIN_TRADING_DAYS_FOR_WINDOW = 3;

// ── Shared helpers ───────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function getMinutesOfDay(timeStr?: string): number | null {
  if (!timeStr) return null;
  const m = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = +m[1];
  const min = +m[2];
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * MINUTES_PER_HOUR + min;
}

function formatMinutesOfDay(totalMinutes: number): string {
  const rounded = Math.round(totalMinutes) % MINUTES_PER_DAY;
  const h = Math.floor(rounded / MINUTES_PER_HOUR);
  const m = rounded % MINUTES_PER_HOUR;
  return `${pad(h)}:${pad(m)}`;
}

// Arithmetic mean in minutes-since-midnight space. Simple and deterministic;
// it doesn't attempt a circular mean, so a trader whose times genuinely
// straddle midnight (e.g. entries at 23:50 and 00:10) would see those
// average toward noon rather than toward midnight. That's an accepted V1
// limitation — most trading activity doesn't span midnight symmetrically.
function averageMinutesOfDay(values: number[]): number {
  return values.reduce((s, m) => s + m, 0) / values.length;
}

function toTimestamp(dateStr: string, timeStr: string): number | null {
  const ts = new Date(`${dateStr}T${timeStr}:00`).getTime();
  return Number.isFinite(ts) ? ts : null;
}

// Habits' holding-time figure must reflect an actual measured duration, so
// unlike traderIdentity.ts's holding-time calc (which allows a day-level
// estimate for multi-day trades missing times), this ignores ANY trade
// missing either entryTime or exitTime — "ignore trades without both entry
// and exit times" per spec, not just same-day ones.
function getHoldingMinutes(trade: Trade): number | null {
  if (!trade.entryDate || !trade.exitDate || !trade.entryTime || !trade.exitTime) return null;
  const entry = toTimestamp(trade.entryDate, trade.entryTime);
  const exit = toTimestamp(trade.exitDate, trade.exitTime);
  if (entry === null || exit === null) return null;
  const diff = (exit - entry) / MS_PER_MINUTE;
  return diff >= 0 ? diff : null;
}

function formatHoldingDuration(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded < MINUTES_PER_HOUR) return `${rounded} min`;
  const h = Math.floor(rounded / MINUTES_PER_HOUR);
  const m = rounded % MINUTES_PER_HOUR;
  return `${h}h ${m}m`;
}

type DayOfWeek = "Sunday" | "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday";

const DAY_NAMES: DayOfWeek[] = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

function getDayOfWeek(dateStr: string): DayOfWeek | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? null : DAY_NAMES[date.getDay()];
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

function mostFrequentDay(trades: Trade[]): DayOfWeek | null {
  const counts = new Map<DayOfWeek, number>();
  for (const t of trades) {
    const day = getDayOfWeek(t.entryDate);
    if (day === null) continue;
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  let best: DayOfWeek | null = null;
  let bestCount = -1;
  for (const [day, count] of counts) {
    if (count > bestCount) {
      best = day;
      bestCount = count;
    }
  }
  return best;
}

// ── 1. Trading Frequency ─────────────────────────────────────────────────

function computeTradingFrequency(totalTrades: number, tradingDays: number): string {
  if (tradingDays === 0) return NOT_ENOUGH_DATA;
  return `${(totalTrades / tradingDays).toFixed(1)} trades/day`;
}

// ── 2. Average Holding Time ──────────────────────────────────────────────

function computeAverageHoldingTime(trades: Trade[]): string {
  const holdingTimes = trades.map(getHoldingMinutes).filter((m): m is number => m !== null);
  if (holdingTimes.length === 0) return NOT_ENOUGH_DATA;
  const avg = holdingTimes.reduce((s, m) => s + m, 0) / holdingTimes.length;
  return formatHoldingDuration(avg);
}

// ── 3. Trading Window ────────────────────────────────────────────────────
// Per trading day, find that day's earliest and latest entry time, then
// average those bounds across days — the typical start/end of a trading
// session, distinct from the flat average entry time in #5 (which isn't
// bounded per day and would be pulled toward the middle of the day by
// traders who trade continuously through it).

function computeTradingWindow(trades: Trade[]): string {
  const withEntryTime = trades.filter((t) => getMinutesOfDay(t.entryTime) !== null);
  const byDate = groupBy(withEntryTime, (t) => t.entryDate);

  const dailyFirstEntries: number[] = [];
  const dailyLastEntries: number[] = [];
  for (const dayTrades of byDate.values()) {
    const minutes = dayTrades.map((t) => getMinutesOfDay(t.entryTime) as number);
    dailyFirstEntries.push(Math.min(...minutes));
    dailyLastEntries.push(Math.max(...minutes));
  }

  if (dailyFirstEntries.length < MIN_TRADING_DAYS_FOR_WINDOW) return NOT_ENOUGH_DATA;

  const avgFirst = averageMinutesOfDay(dailyFirstEntries);
  const avgLast = averageMinutesOfDay(dailyLastEntries);
  return `${formatMinutesOfDay(avgFirst)} → ${formatMinutesOfDay(avgLast)}`;
}

// ── 4. Most Active Day ───────────────────────────────────────────────────

function computeMostActiveDay(trades: Trade[]): string {
  return mostFrequentDay(trades) ?? NOT_ENOUGH_DATA;
}

// ── 5 & 6. Average Entry / Exit Time ─────────────────────────────────────

function computeAverageTimeOfDay(minutesList: number[]): string {
  if (minutesList.length === 0) return NOT_ENOUGH_DATA;
  return formatMinutesOfDay(averageMinutesOfDay(minutesList));
}

// ── Metadata ──────────────────────────────────────────────────────────────

export interface TraderHabitsMetadata {
  sampleSize: number;
  tradingDays: number;
  firstTrade: string | null; // "YYYY-MM-DD"
  lastTrade: string | null; // "YYYY-MM-DD"
}

// ── TraderHabits ──────────────────────────────────────────────────────────

export interface TraderHabits {
  tradingFrequency: string;
  averageHoldingTime: string;
  tradingWindow: string;
  mostActiveDay: string;
  averageEntryTime: string;
  averageExitTime: string;
  metadata: TraderHabitsMetadata;
}

export function getTraderHabits(trades: Trade[]): TraderHabits {
  const valid = trades.filter((t) => !!t.entryDate);
  const sorted = [...valid].sort((a, b) => a.entryDate.localeCompare(b.entryDate));
  const sampleSize = sorted.length;

  const tradingDays = new Set(sorted.map((t) => t.entryDate)).size;
  const firstTrade = sampleSize > 0 ? sorted[0].entryDate : null;
  const lastTrade = sampleSize > 0 ? sorted[sampleSize - 1].entryDate : null;

  const entryMinutes = sorted.map((t) => getMinutesOfDay(t.entryTime)).filter((m): m is number => m !== null);
  const exitMinutes = sorted.map((t) => getMinutesOfDay(t.exitTime)).filter((m): m is number => m !== null);

  return {
    tradingFrequency: computeTradingFrequency(sampleSize, tradingDays),
    averageHoldingTime: computeAverageHoldingTime(sorted),
    tradingWindow: computeTradingWindow(sorted),
    mostActiveDay: computeMostActiveDay(sorted),
    averageEntryTime: computeAverageTimeOfDay(entryMinutes),
    averageExitTime: computeAverageTimeOfDay(exitMinutes),
    metadata: {
      sampleSize,
      tradingDays,
      firstTrade,
      lastTrade,
    },
  };
}
