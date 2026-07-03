import { Trade } from "@/types";

// ============================================================
// PropEdge — Trader Discipline engine (Trader DNA V1, Block 5)
// ============================================================
// Pure, stateless helpers over a Trade[] list. Discipline answers exactly
// one question: "How consistent is my execution behavior?" — it never
// reads pnl, win rate, profit factor, or expectancy. Unlike Your Edge and
// Blind Spots, this block is behavioral only, same hard boundary as
// traderIdentity.ts and traderHabits.ts: a trader can be perfectly
// "disciplined" (consistent rhythm, focused sessions) while losing money,
// and perfectly "undisciplined" while winning — this file has no opinion
// on which is happening, only on how repeatable the behavior is.
//
// Self-contained by design (no imports from traderDNA.ts, traderIdentity.ts,
// traderHabits.ts, traderEdge.ts, traderBlindSpots.ts, or
// globalAnalytics.ts), same convention as the rest of Trader DNA. Every
// field is returned already formatted for display — React only renders
// this object, it never decides thresholds, units, or fallback copy.

const NOT_ENOUGH_DATA = "Not enough data";

// Day-level metrics (consistency, overtrading, rhythm) need a handful of
// active days to say anything about a pattern rather than one day's noise.
const MIN_ACTIVE_DAYS = 3;

// Session Discipline groups individual trades (not days), so it uses the
// same 10-trade floor as the other trade-grouping insights across Trader
// DNA (Your Edge, Blind Spots).
const MIN_TRADES_FOR_SESSION_DISCIPLINE = 10;

// ── Shared helpers ───────────────────────────────────────────────────────

function groupByDate(trades: Trade[]): Map<string, Trade[]> {
  const map = new Map<string, Trade[]>();
  for (const t of trades) {
    const bucket = map.get(t.entryDate);
    if (bucket) bucket.push(t);
    else map.set(t.entryDate, [t]);
  }
  return map;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function getMinutesOfDay(timeStr?: string): number | null {
  if (!timeStr) return null;
  const m = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = +m[1];
  const min = +m[2];
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function countBy<K extends string>(items: Trade[], keyFn: (t: Trade) => K): Partial<Record<K, number>> {
  const counts: Partial<Record<K, number>> = {};
  for (const item of items) {
    const k = keyFn(item);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

function reasonText(sampleSize: number, activeDays: number): string {
  return `Based on ${sampleSize} trade${sampleSize === 1 ? "" : "s"} across ${activeDays} active trading day${
    activeDays === 1 ? "" : "s"
  }`;
}

// ── Insight & Metadata ───────────────────────────────────────────────────

export interface DisciplineInsight {
  label: string;
  value: string;
  metric: number | null;
  reasons: string;
  sampleSize: number;
}

function notEnoughDataInsight(label: string): DisciplineInsight {
  return {
    label,
    value: NOT_ENOUGH_DATA,
    metric: null,
    reasons: NOT_ENOUGH_DATA,
    sampleSize: 0,
  };
}

export interface TraderDisciplineMetadata {
  sampleSize: number;
  tradingDays: number;
  firstTrade: string | null; // "YYYY-MM-DD"
  lastTrade: string | null; // "YYYY-MM-DD"
}

// ── 1. Trading Consistency ───────────────────────────────────────────────
// Never reads pnl. Stability of trade count per active day, judged from
// two complementary signals: the coefficient of variation (stdDev/mean,
// scale-independent day-to-day spread) and how far the busiest day sits
// above the typical (median) day — a trader who does 3 trades most days
// but occasionally spikes to 15 reads as irregular even if most days look
// similar to each other.

const CONSISTENCY_LABEL = "Trading Consistency";

function classifyConsistency(cv: number, maxToMedianRatio: number): string {
  if (cv <= 0.3 && maxToMedianRatio <= 1.5) return "Stable";
  if (cv <= 0.6 && maxToMedianRatio <= 2.5) return "Moderate";
  if (cv <= 1.0 && maxToMedianRatio <= 4) return "Irregular";
  return "Highly Irregular";
}

function computeTradingConsistency(dailyCounts: number[]): DisciplineInsight {
  if (dailyCounts.length < MIN_ACTIVE_DAYS) return notEnoughDataInsight(CONSISTENCY_LABEL);

  const avg = mean(dailyCounts);
  const med = median(dailyCounts);
  const max = Math.max(...dailyCounts);
  const cv = avg > 0 ? stdDev(dailyCounts) / avg : 0;
  const maxToMedianRatio = med > 0 ? max / med : max > 0 ? Infinity : 0;

  const totalTrades = dailyCounts.reduce((s, v) => s + v, 0);

  return {
    label: CONSISTENCY_LABEL,
    value: classifyConsistency(cv, maxToMedianRatio),
    metric: cv,
    reasons: reasonText(totalTrades, dailyCounts.length),
    sampleSize: totalTrades,
  };
}

// ── 2. Overtrading Risk ──────────────────────────────────────────────────
// Never reads pnl — this measures rhythm-breaking frequency, not whether
// the extra trades won or lost. "Many days above median + 2 trades" is the
// V1 signal; the ratio of such days to total active days sets the label.

const OVERTRADING_LABEL = "Overtrading Risk";
const OVERTRADING_ABOVE_MEDIAN_OFFSET = 2;
const OVERTRADING_HIGH_RATIO = 0.4;
const OVERTRADING_MODERATE_RATIO = 0.15;

function classifyOvertradingRisk(overRatio: number): string {
  if (overRatio >= OVERTRADING_HIGH_RATIO) return "High";
  if (overRatio >= OVERTRADING_MODERATE_RATIO) return "Moderate";
  return "Low";
}

function computeOvertradingRisk(dailyCounts: number[]): DisciplineInsight {
  if (dailyCounts.length < MIN_ACTIVE_DAYS) return notEnoughDataInsight(OVERTRADING_LABEL);

  const med = median(dailyCounts);
  const threshold = med + OVERTRADING_ABOVE_MEDIAN_OFFSET;
  const overCount = dailyCounts.filter((c) => c > threshold).length;
  const overRatio = overCount / dailyCounts.length;

  const totalTrades = dailyCounts.reduce((s, v) => s + v, 0);

  return {
    label: OVERTRADING_LABEL,
    value: classifyOvertradingRisk(overRatio),
    metric: overRatio,
    reasons: reasonText(totalTrades, dailyCounts.length),
    sampleSize: totalTrades,
  };
}

// ── 3. Trading Rhythm ────────────────────────────────────────────────────
// Never reads pnl. Per active day, find that day's earliest and latest
// entry time, then measure how much those two bounds swing from day to
// day (stdDev of daily-first and daily-last, averaged) — a trader who
// always starts/stops around the same clock time reads as "Structured",
// one whose window drifts by hours reads as "Irregular".

const RHYTHM_LABEL = "Trading Rhythm";
const RHYTHM_STRUCTURED_MAX_MINUTES = 45;
const RHYTHM_FLEXIBLE_MAX_MINUTES = 120;

function classifyRhythm(avgVariationMinutes: number): string {
  if (avgVariationMinutes <= RHYTHM_STRUCTURED_MAX_MINUTES) return "Structured";
  if (avgVariationMinutes <= RHYTHM_FLEXIBLE_MAX_MINUTES) return "Flexible";
  return "Irregular";
}

function computeTradingRhythm(trades: Trade[]): DisciplineInsight {
  const withEntryTime = trades.filter((t) => getMinutesOfDay(t.entryTime) !== null);
  const byDate = groupByDate(withEntryTime);

  const dailyFirst: number[] = [];
  const dailyLast: number[] = [];
  let sampleSize = 0;
  for (const dayTrades of byDate.values()) {
    const minutes = dayTrades.map((t) => getMinutesOfDay(t.entryTime) as number);
    dailyFirst.push(Math.min(...minutes));
    dailyLast.push(Math.max(...minutes));
    sampleSize += dayTrades.length;
  }

  if (dailyFirst.length < MIN_ACTIVE_DAYS) return notEnoughDataInsight(RHYTHM_LABEL);

  const avgVariation = (stdDev(dailyFirst) + stdDev(dailyLast)) / 2;

  return {
    label: RHYTHM_LABEL,
    value: classifyRhythm(avgVariation),
    metric: avgVariation,
    reasons: reasonText(sampleSize, dailyFirst.length),
    sampleSize,
  };
}

// ── 4. Session Discipline ────────────────────────────────────────────────
// Never reads pnl. Purely session distribution: how much of the trader's
// volume sits inside their single most-used session vs spread outside it.

const SESSION_DISCIPLINE_LABEL = "Session Discipline";
const SESSION_FOCUSED_MAX_OUTSIDE_RATIO = 0.2;
const SESSION_BALANCED_MAX_OUTSIDE_RATIO = 0.5;

function classifySessionDiscipline(outsideRatio: number): string {
  if (outsideRatio <= SESSION_FOCUSED_MAX_OUTSIDE_RATIO) return "Focused";
  if (outsideRatio <= SESSION_BALANCED_MAX_OUTSIDE_RATIO) return "Balanced";
  return "Scattered";
}

function computeSessionDiscipline(trades: Trade[]): DisciplineInsight {
  const withSession = trades.filter((t) => !!t.session);
  if (withSession.length < MIN_TRADES_FOR_SESSION_DISCIPLINE) return notEnoughDataInsight(SESSION_DISCIPLINE_LABEL);

  const counts = countBy(withSession, (t) => t.session as string);
  const primaryCount = Math.max(...Object.values(counts).map((c) => c ?? 0));
  const outsideRatio = 1 - primaryCount / withSession.length;

  const activeDays = new Set(withSession.map((t) => t.entryDate)).size;

  return {
    label: SESSION_DISCIPLINE_LABEL,
    value: classifySessionDiscipline(outsideRatio),
    metric: outsideRatio,
    reasons: reasonText(withSession.length, activeDays),
    sampleSize: withSession.length,
  };
}

// ── TraderDiscipline ─────────────────────────────────────────────────────

export interface TraderDiscipline {
  tradingConsistency: DisciplineInsight;
  overtradingRisk: DisciplineInsight;
  tradingRhythm: DisciplineInsight;
  sessionDiscipline: DisciplineInsight;
  metadata: TraderDisciplineMetadata;
}

export function getTraderDiscipline(trades: Trade[]): TraderDiscipline {
  const valid = trades.filter((t) => !!t.entryDate);
  const sorted = [...valid].sort((a, b) => a.entryDate.localeCompare(b.entryDate));
  const sampleSize = sorted.length;

  const tradingDays = new Set(sorted.map((t) => t.entryDate)).size;
  const firstTrade = sampleSize > 0 ? sorted[0].entryDate : null;
  const lastTrade = sampleSize > 0 ? sorted[sampleSize - 1].entryDate : null;

  const dailyCounts = Array.from(groupByDate(sorted).values()).map((dayTrades) => dayTrades.length);

  return {
    tradingConsistency: computeTradingConsistency(dailyCounts),
    overtradingRisk: computeOvertradingRisk(dailyCounts),
    tradingRhythm: computeTradingRhythm(sorted),
    sessionDiscipline: computeSessionDiscipline(sorted),
    metadata: {
      sampleSize,
      tradingDays,
      firstTrade,
      lastTrade,
    },
  };
}
