import { Trade } from "@/types";

// ============================================================
// PropEdge — Trader Habits engine (Trader DNA V1, Block 2)
// ============================================================
// Pure, stateless helpers over a Trade[] list. Habits answers exactly one
// question: "How do I naturally trade every day?" — how long positions are
// held, what part of the day trading happens in, and how consistent the
// daily starting routine is.
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
// always produce the same output. All narrative text is template-based,
// never generated (no AI, no P&L, no win rate, no profit factor).

const NOT_ENOUGH_DATA = "Not enough data";

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

// A "window" (typical daily start/end) needs a handful of days to be a
// pattern rather than a coincidence — one or two days is just what
// happened that day, not a routine. Routine Stability shares this
// threshold since it's derived from the same per-day first-entry times.
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

function standardDeviationMinutes(values: number[]): number {
  const mean = averageMinutesOfDay(values);
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
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

// ── 1. Average Holding Time ──────────────────────────────────────────────
// Same buckets as traderIdentity.ts's trading-style classification
// (scalp < 15min, intraday < 6h, swing < 3 days, else position), kept as
// local constants rather than an import to preserve this file's
// self-contained design — the narrative only needs the boundary, not the
// full identity engine.

const SCALP_MAX_MINUTES = 15;
const INTRADAY_MAX_MINUTES = 6 * MINUTES_PER_HOUR;
const SWING_MAX_MINUTES = 3 * MINUTES_PER_DAY;

function getHoldingTimes(trades: Trade[]): number[] {
  return trades.map(getHoldingMinutes).filter((m): m is number => m !== null);
}

function holdingTimeNarrative(avgMinutes: number): string {
  if (avgMinutes < SCALP_MAX_MINUTES) {
    return "Your positions are usually closed within minutes, confirming a scalping execution style.";
  }
  if (avgMinutes < INTRADAY_MAX_MINUTES) {
    return "Your positions are usually closed within the same session, confirming an intraday execution style.";
  }
  if (avgMinutes < SWING_MAX_MINUTES) {
    return "Your positions are typically held overnight, confirming a swing trading style.";
  }
  return "Your positions are typically held for several days, confirming a position trading style.";
}

function holdingStyleWord(avgMinutes: number): string {
  if (avgMinutes < SCALP_MAX_MINUTES) return "quickly";
  if (avgMinutes < INTRADAY_MAX_MINUTES) return "within the session";
  if (avgMinutes < SWING_MAX_MINUTES) return "after holding overnight";
  return "after holding for several days";
}

// ── 2. Trading Window ────────────────────────────────────────────────────
// Per trading day, find that day's earliest and latest entry time, then
// average those bounds across days — the typical start/end of a trading
// session.

interface DailyEntryBounds {
  dailyFirstEntries: number[];
  dailyLastEntries: number[];
}

function computeDailyEntryBounds(trades: Trade[]): DailyEntryBounds {
  const withEntryTime = trades.filter((t) => getMinutesOfDay(t.entryTime) !== null);
  const byDate = groupBy(withEntryTime, (t) => t.entryDate);

  const dailyFirstEntries: number[] = [];
  const dailyLastEntries: number[] = [];
  for (const dayTrades of byDate.values()) {
    const minutes = dayTrades.map((t) => getMinutesOfDay(t.entryTime) as number);
    dailyFirstEntries.push(Math.min(...minutes));
    dailyLastEntries.push(Math.max(...minutes));
  }
  return { dailyFirstEntries, dailyLastEntries };
}

function computeTradingWindow(bounds: DailyEntryBounds): string {
  if (bounds.dailyFirstEntries.length < MIN_TRADING_DAYS_FOR_WINDOW) return NOT_ENOUGH_DATA;
  const avgFirst = averageMinutesOfDay(bounds.dailyFirstEntries);
  const avgLast = averageMinutesOfDay(bounds.dailyLastEntries);
  return `${formatMinutesOfDay(avgFirst)} → ${formatMinutesOfDay(avgLast)}`;
}

// Broad session windows (minutes since midnight), matching the same house
// rule src/lib/importTrades.ts uses to auto-detect a trade's session
// (Asian 00:00–07:59, London 08:00–13:29, New York 13:30–22:00). The
// remaining hours (22:00–24:00) are folded into "late New York" so every
// time of day maps to a phrase — this is a narrative label only, it never
// touches Trade.session.
interface NamedWindow {
  name: string;
  start: number;
  end: number;
}

const TIME_OF_DAY_WINDOWS: NamedWindow[] = [
  { name: "Asian", start: 0, end: 8 * MINUTES_PER_HOUR },
  { name: "London", start: 8 * MINUTES_PER_HOUR, end: 13 * MINUTES_PER_HOUR + 30 },
  { name: "New York", start: 13 * MINUTES_PER_HOUR + 30, end: MINUTES_PER_DAY },
];

function describeTimeOfDay(minutesOfDay: number): string {
  const window =
    TIME_OF_DAY_WINDOWS.find((w) => minutesOfDay >= w.start && minutesOfDay < w.end) ?? TIME_OF_DAY_WINDOWS[0];
  const span = window.end - window.start;
  const position = minutesOfDay - window.start;
  if (position < span / 3) return `early ${window.name} session`;
  if (position < (span * 2) / 3) return `${window.name} session`;
  return `late ${window.name} session`;
}

function tradingWindowNarrative(bounds: DailyEntryBounds): string {
  if (bounds.dailyFirstEntries.length < MIN_TRADING_DAYS_FOR_WINDOW) {
    return "Not enough trading days yet to identify a consistent trading window.";
  }
  const avgFirst = averageMinutesOfDay(bounds.dailyFirstEntries);
  return `Most of your trades occur during the ${describeTimeOfDay(avgFirst)}.`;
}

// ── 3. Routine Stability ─────────────────────────────────────────────────
// New behavioral insight: how much a trader's daily starting time varies,
// measured as the standard deviation of the same per-day first-entry
// times computeDailyEntryBounds() already produces for Trading Window.

export type RoutineStability = "Highly Structured" | "Structured" | "Flexible" | "Irregular" | "Not enough data";

const ROUTINE_HIGHLY_STRUCTURED_MAX_MINUTES = 15;
const ROUTINE_STRUCTURED_MAX_MINUTES = 45;
const ROUTINE_FLEXIBLE_MAX_MINUTES = 120;

function classifyRoutineStability(variationMinutes: number): Exclude<RoutineStability, "Not enough data"> {
  if (variationMinutes <= ROUTINE_HIGHLY_STRUCTURED_MAX_MINUTES) return "Highly Structured";
  if (variationMinutes <= ROUTINE_STRUCTURED_MAX_MINUTES) return "Structured";
  if (variationMinutes <= ROUTINE_FLEXIBLE_MAX_MINUTES) return "Flexible";
  return "Irregular";
}

interface RoutineStabilityResult {
  classification: RoutineStability;
  reason: string;
}

function computeRoutineStability(bounds: DailyEntryBounds): RoutineStabilityResult {
  if (bounds.dailyFirstEntries.length < MIN_TRADING_DAYS_FOR_WINDOW) {
    return { classification: "Not enough data", reason: "Not enough trading days yet to measure routine stability." };
  }
  const variation = standardDeviationMinutes(bounds.dailyFirstEntries);
  const windowMinutes = Math.max(1, Math.round(variation * 2));
  return {
    classification: classifyRoutineStability(variation),
    reason: `You usually begin trading within a ${windowMinutes}-minute window.`,
  };
}

// ── 4. Executive Summary ─────────────────────────────────────────────────
// A single deterministic paragraph stitched from the three insights above
// — no data this engine hasn't already computed.

function buildExecutiveSummary(
  avgHoldingMinutes: number | null,
  bounds: DailyEntryBounds,
  routineStability: RoutineStability
): string {
  if (avgHoldingMinutes === null || routineStability === "Not enough data") {
    return "Not enough trade history yet to summarize your routine.";
  }
  const sessionPhrase = describeTimeOfDay(averageMinutesOfDay(bounds.dailyFirstEntries));
  const styleWord = holdingStyleWord(avgHoldingMinutes);
  const stabilityWord = routineStability.toLowerCase();
  return `Your routine is concentrated in the ${sessionPhrase}. You usually close trades ${styleWord} and follow a ${stabilityWord} execution window.`;
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
  averageHoldingTime: string;
  averageHoldingTimeExplanation: string;
  tradingWindow: string;
  tradingWindowExplanation: string;
  routineStability: RoutineStability;
  routineStabilityReason: string;
  executiveSummary: string;
  metadata: TraderHabitsMetadata;
}

export function getTraderHabits(trades: Trade[]): TraderHabits {
  const valid = trades.filter((t) => !!t.entryDate);
  const sorted = [...valid].sort((a, b) => a.entryDate.localeCompare(b.entryDate));
  const sampleSize = sorted.length;

  const tradingDays = new Set(sorted.map((t) => t.entryDate)).size;
  const firstTrade = sampleSize > 0 ? sorted[0].entryDate : null;
  const lastTrade = sampleSize > 0 ? sorted[sampleSize - 1].entryDate : null;

  const holdingTimes = getHoldingTimes(sorted);
  const avgHoldingMinutes =
    holdingTimes.length > 0 ? holdingTimes.reduce((s, m) => s + m, 0) / holdingTimes.length : null;

  const bounds = computeDailyEntryBounds(sorted);
  const { classification: routineStability, reason: routineStabilityReason } = computeRoutineStability(bounds);

  return {
    averageHoldingTime: avgHoldingMinutes !== null ? formatHoldingDuration(avgHoldingMinutes) : NOT_ENOUGH_DATA,
    averageHoldingTimeExplanation:
      avgHoldingMinutes !== null
        ? holdingTimeNarrative(avgHoldingMinutes)
        : "Not enough completed trades yet to identify a holding-time pattern.",
    tradingWindow: computeTradingWindow(bounds),
    tradingWindowExplanation: tradingWindowNarrative(bounds),
    routineStability,
    routineStabilityReason,
    executiveSummary: buildExecutiveSummary(avgHoldingMinutes, bounds, routineStability),
    metadata: {
      sampleSize,
      tradingDays,
      firstTrade,
      lastTrade,
    },
  };
}
