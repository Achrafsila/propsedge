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

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function toTimestamp(dateStr: string, timeStr?: string): number | null {
  if (!dateStr) return null;
  const time = timeStr && /^\d{2}:\d{2}$/.test(timeStr) ? timeStr : "00:00";
  const ts = new Date(`${dateStr}T${time}:00`).getTime();
  return Number.isFinite(ts) ? ts : null;
}

// Identical to traderIdentity.ts's holding-time calc (duplicated, not
// imported, per this file's self-contained convention) so both cards
// compute the median from the exact same per-trade durations and can
// never disagree: same-day trades missing either timestamp are excluded
// (duration would be ambiguous), while multi-day trades are still measured
// at day granularity even without times, defaulting the missing
// time-of-day to 00:00.
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

// Identical to traderIdentity.ts's formatter (duplicated, not imported) so
// "Average Holding Time" here and the holding-time sentence there render
// the exact same text for the exact same median.
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
// The displayed figure is the MEDIAN holding time, not the mean — it's
// less skewed by a handful of outlier holds, and using the same statistic
// traderIdentity.ts uses for its holding-time sentence is what keeps the
// two cards from ever showing different numbers for the same trades. The
// field/label stays "Average Holding Time" for the user-facing copy.
//
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

function holdingTimeNarrative(medianMinutes: number): string {
  if (medianMinutes < SCALP_MAX_MINUTES) {
    return "Your positions are usually closed within minutes, confirming a scalping execution style.";
  }
  if (medianMinutes < INTRADAY_MAX_MINUTES) {
    return "Your positions are usually closed within the same session, confirming an intraday execution style.";
  }
  if (medianMinutes < SWING_MAX_MINUTES) {
    return "Your positions are typically held overnight, confirming a swing trading style.";
  }
  return "Your positions are typically held for several days, confirming a position trading style.";
}

function holdingStyleWord(medianMinutes: number): string {
  if (medianMinutes < SCALP_MAX_MINUTES) return "quickly";
  if (medianMinutes < INTRADAY_MAX_MINUTES) return "within the session";
  if (medianMinutes < SWING_MAX_MINUTES) return "after holding overnight";
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

// Deterministic behavioral wording per classification — the raw variation
// number is never surfaced to the UI, only the bucket it falls into.
const ROUTINE_STABILITY_REASON: Record<Exclude<RoutineStability, "Not enough data">, string> = {
  "Highly Structured": "You usually begin trading at nearly the same time every trading day.",
  Structured: "Your trading start time remains fairly consistent across trading days.",
  Flexible: "Your trading start time varies moderately from one day to another.",
  Irregular: "Your trading start time changes significantly between trading days.",
};

interface RoutineStabilityResult {
  classification: RoutineStability;
  reason: string;
}

function computeRoutineStability(bounds: DailyEntryBounds): RoutineStabilityResult {
  if (bounds.dailyFirstEntries.length < MIN_TRADING_DAYS_FOR_WINDOW) {
    return { classification: "Not enough data", reason: "Not enough trading days yet to measure routine stability." };
  }
  const variation = standardDeviationMinutes(bounds.dailyFirstEntries);
  const classification = classifyRoutineStability(variation);
  return { classification, reason: ROUTINE_STABILITY_REASON[classification] };
}

// ── 4. Execution Pace (Trader DNA V4) ─────────────────────────────────────
// A single qualitative read on how often a trader executes, reusing the
// sampleSize/tradingDays this engine's metadata already computes — no new
// raw data, just a classification layer on trades-per-active-day. This is
// the surfaced replacement for showing raw trade-frequency numbers
// directly (still available via metadata for the AI Coach).

export type ExecutionPace = "High Frequency" | "Active" | "Measured" | "Selective" | "Not enough data";

const EXECUTION_PACE_HIGH_FREQUENCY_MIN = 5;
const EXECUTION_PACE_ACTIVE_MIN = 2;
const EXECUTION_PACE_MEASURED_MIN = 1;

function classifyExecutionPace(tradesPerDay: number): Exclude<ExecutionPace, "Not enough data"> {
  if (tradesPerDay >= EXECUTION_PACE_HIGH_FREQUENCY_MIN) return "High Frequency";
  if (tradesPerDay >= EXECUTION_PACE_ACTIVE_MIN) return "Active";
  if (tradesPerDay >= EXECUTION_PACE_MEASURED_MIN) return "Measured";
  return "Selective";
}

const EXECUTION_PACE_EXPLANATION: Record<Exclude<ExecutionPace, "Not enough data">, string> = {
  "High Frequency": "You typically execute many trades within a single trading day.",
  Active: "You typically execute a healthy handful of trades per trading day.",
  Measured: "You typically execute around one trade per trading day.",
  Selective: "You typically wait for a handful of higher-conviction setups rather than trading daily.",
};

interface ExecutionPaceResult {
  pace: ExecutionPace;
  explanation: string;
}

function computeExecutionPace(sampleSize: number, tradingDays: number): ExecutionPaceResult {
  if (tradingDays === 0) {
    return { pace: "Not enough data", explanation: "Not enough trade history yet to measure execution pace." };
  }
  const pace = classifyExecutionPace(sampleSize / tradingDays);
  return { pace, explanation: EXECUTION_PACE_EXPLANATION[pace] };
}

// ── 5. Executive Summary ─────────────────────────────────────────────────
// A single deterministic paragraph stitched from Average Holding Time,
// Trading Window, and Execution Pace — the three insights this card
// surfaces — no data this engine hasn't already computed. Routine
// Stability still feeds the AI Coach via its own field, but no longer
// appears here since it isn't shown on the card either.

function buildExecutiveSummary(
  medianHoldingMinutes: number | null,
  bounds: DailyEntryBounds,
  executionPace: ExecutionPace
): string {
  if (medianHoldingMinutes === null || executionPace === "Not enough data") {
    return "Not enough trade history yet to summarize your routine.";
  }
  const sessionPhrase = describeTimeOfDay(averageMinutesOfDay(bounds.dailyFirstEntries));
  const styleWord = holdingStyleWord(medianHoldingMinutes);
  const paceWord = executionPace.toLowerCase();
  return `Your routine is concentrated in the ${sessionPhrase}. You usually close trades ${styleWord}, trading at a ${paceWord} pace.`;
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
  executionPace: ExecutionPace;
  executionPaceExplanation: string;
  executiveSummary: string;
  // Kept for the AI Coach — no longer shown on the card (Trader DNA V4
  // simplification), but still computed on every call.
  routineStability: RoutineStability;
  routineStabilityReason: string;
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
  const medianHoldingMinutes = holdingTimes.length > 0 ? median(holdingTimes) : null;

  const bounds = computeDailyEntryBounds(sorted);
  const { classification: routineStability, reason: routineStabilityReason } = computeRoutineStability(bounds);
  const { pace: executionPace, explanation: executionPaceExplanation } = computeExecutionPace(sampleSize, tradingDays);

  return {
    averageHoldingTime: medianHoldingMinutes !== null ? formatHoldingDuration(medianHoldingMinutes) : NOT_ENOUGH_DATA,
    averageHoldingTimeExplanation:
      medianHoldingMinutes !== null
        ? holdingTimeNarrative(medianHoldingMinutes)
        : "Not enough completed trades yet to identify a holding-time pattern.",
    tradingWindow: computeTradingWindow(bounds),
    tradingWindowExplanation: tradingWindowNarrative(bounds),
    executionPace,
    executionPaceExplanation,
    executiveSummary: buildExecutiveSummary(medianHoldingMinutes, bounds, executionPace),
    routineStability,
    routineStabilityReason,
    metadata: {
      sampleSize,
      tradingDays,
      firstTrade,
      lastTrade,
    },
  };
}
