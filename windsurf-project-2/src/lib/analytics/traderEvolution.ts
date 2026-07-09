import { Trade } from "@/types";

// ============================================================
// PropEdge — Trader Evolution engine (Trader DNA V1, Block 6)
// ============================================================
// Pure, stateless helpers over a Trade[] list. Evolution answers exactly
// one question: "Am I improving over time?" — comparing a recent 30-day
// window against the 30 days before it. V1 kept this file pnl-free
// (activity, holding time, session/instrument focus); Trader DNA V4 adds
// Expectancy Trend and Setup Quality Trend, which do read pnl the same
// way traderEdge.ts/traderBlindSpots.ts already do (to rank/compare, never
// to report a raw running total) — this file no longer has a "never reads
// pnl" boundary, but it still never reports total P&L on its own.
//
// V1 comparison window: the "recent" period is the 30 calendar days ending
// on the most recent trade's date; "previous" is the 30 calendar days
// immediately before that. Both periods must clear the same minimum
// sample floor used elsewhere in Trader DNA (10) before any trend is
// reported — otherwise the specific insight (not the whole engine) falls
// back to "Building history". Evolution is the one Trader DNA block where
// this is a genuine structural gap (there is no second period to compare
// against yet), not a "not enough data" sample-size judgment, so it's the
// only insight in Trader DNA that still has a blocked-looking state.
//
// Self-contained by design (no imports from traderDNA.ts, traderIdentity.ts,
// traderHabits.ts, traderEdge.ts, traderBlindSpots.ts, traderDiscipline.ts,
// or globalAnalytics.ts), same convention as the rest of Trader DNA. Every
// field is returned already formatted for display — React only renders
// this object, it never decides thresholds, units, or fallback copy.

const BUILDING_HISTORY = "Building history";

// Same floor used by Your Edge / Blind Spots / Discipline's session
// grouping — a period needs at least this many qualifying trades before a
// comparison against the other period means anything.
const MIN_TRADES_PER_PERIOD = 10;

const WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// A change smaller than this is treated as noise, not a real shift.
const RATE_CHANGE_THRESHOLD = 0.15; // 15% relative change
const FOCUS_CHANGE_THRESHOLD = 0.1; // 10 percentage points of concentration

// ── Shared helpers ───────────────────────────────────────────────────────

function parseDateUTC(dateStr: string): number | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  const ms = Date.UTC(y, m - 1, d);
  return Number.isFinite(ms) ? ms : null;
}

function addDays(ms: number, days: number): number {
  return ms + days * MS_PER_DAY;
}

interface Periods {
  recent: Trade[];
  previous: Trade[];
}

// Splits trades into the last WINDOW_DAYS calendar days (anchored on the
// most recent trade date) and the WINDOW_DAYS immediately before that.
// Trades outside both windows (older than "previous") are simply excluded
// from the comparison, not folded into either bucket.
function splitIntoPeriods(trades: Trade[]): Periods {
  const dated = trades
    .map((t) => ({ trade: t, ms: parseDateUTC(t.entryDate) }))
    .filter((x): x is { trade: Trade; ms: number } => x.ms !== null);

  if (dated.length === 0) return { recent: [], previous: [] };

  const lastMs = Math.max(...dated.map((x) => x.ms));
  const recentStart = addDays(lastMs, -(WINDOW_DAYS - 1));
  const previousEnd = addDays(recentStart, -1);
  const previousStart = addDays(previousEnd, -(WINDOW_DAYS - 1));

  const recent: Trade[] = [];
  const previous: Trade[] = [];
  for (const { trade, ms } of dated) {
    if (ms >= recentStart && ms <= lastMs) recent.push(trade);
    else if (ms >= previousStart && ms <= previousEnd) previous.push(trade);
  }
  return { recent, previous };
}

function activeDayCount(trades: Trade[]): number {
  return new Set(trades.map((t) => t.entryDate)).size;
}

function toTimestamp(dateStr: string, timeStr?: string): number | null {
  if (!dateStr || !timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return null;
  const ts = new Date(`${dateStr}T${timeStr}:00`).getTime();
  return Number.isFinite(ts) ? ts : null;
}

// Same "exclude, don't guess" holding-time policy as traderHabits.ts: a
// trade missing either entryTime or exitTime is excluded, never estimated.
function getHoldingMinutes(trade: Trade): number | null {
  if (!trade.entryDate || !trade.exitDate || !trade.entryTime || !trade.exitTime) return null;
  const entry = toTimestamp(trade.entryDate, trade.entryTime);
  const exit = toTimestamp(trade.exitDate, trade.exitTime);
  if (entry === null || exit === null) return null;
  const diff = (exit - entry) / 60_000;
  return diff >= 0 ? diff : null;
}

function formatHoldingDuration(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} min`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return `${h}h ${m}m`;
}

function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

// Identical to traderDiscipline.ts's stdDev (duplicated, not imported, per
// this file's self-contained convention) — used by Discipline Trend to
// measure position-sizing consistency the same way Risk Consistency does.
function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function formatMoneyPerTrade(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toFixed(2)}/trade`;
}

function countBy<K extends string>(items: Trade[], keyFn: (t: Trade) => K): Partial<Record<K, number>> {
  const counts: Partial<Record<K, number>> = {};
  for (const item of items) {
    const k = keyFn(item);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

function classifyDirectionalTrend(relativeChange: number, increasingLabel: string, decreasingLabel: string): string {
  if (relativeChange >= RATE_CHANGE_THRESHOLD) return increasingLabel;
  if (relativeChange <= -RATE_CHANGE_THRESHOLD) return decreasingLabel;
  return "Stable";
}

function classifyFocusTrend(diff: number, scatteredLabel: string): string {
  if (diff >= FOCUS_CHANGE_THRESHOLD) return "More Focused";
  if (diff <= -FOCUS_CHANGE_THRESHOLD) return scatteredLabel;
  return "Stable";
}

// ── Insight & Metadata ───────────────────────────────────────────────────

export interface EvolutionInsight {
  label: string;
  value: string;
  metric: number | null;
  reasons: string;
  sampleSize: number;
}

function buildingHistoryInsight(label: string): EvolutionInsight {
  return {
    label,
    value: BUILDING_HISTORY,
    metric: null,
    reasons: BUILDING_HISTORY,
    sampleSize: 0,
  };
}

export interface TraderEvolutionMetadata {
  sampleSize: number;
  tradingDays: number;
  firstTrade: string | null; // "YYYY-MM-DD"
  lastTrade: string | null; // "YYYY-MM-DD"
}

// ── 1. Activity Trend ────────────────────────────────────────────────────
// Never reads pnl. Trades/day is measured against each period's own active
// trading days (not the raw 30-calendar-day window), matching how
// traderHabits.ts defines trading frequency elsewhere in Trader DNA.

const ACTIVITY_LABEL = "Activity Trend";

function buildActivityTrend(periods: Periods): EvolutionInsight {
  if (periods.recent.length < MIN_TRADES_PER_PERIOD || periods.previous.length < MIN_TRADES_PER_PERIOD) {
    return buildingHistoryInsight(ACTIVITY_LABEL);
  }

  const recentAvg = periods.recent.length / activeDayCount(periods.recent);
  const previousAvg = periods.previous.length / activeDayCount(periods.previous);
  const relativeChange = previousAvg > 0 ? (recentAvg - previousAvg) / previousAvg : 0;

  return {
    label: ACTIVITY_LABEL,
    value: classifyDirectionalTrend(relativeChange, "Increasing", "Decreasing"),
    metric: relativeChange,
    reasons: `Recent 30d: ${recentAvg.toFixed(1)} trades/day · Previous 30d: ${previousAvg.toFixed(1)} trades/day`,
    sampleSize: periods.recent.length + periods.previous.length,
  };
}

// ── 2. Holding Time Trend ────────────────────────────────────────────────
// Never reads pnl. Compares average holding duration between periods,
// using only trades with a complete entry/exit time in each period.

const HOLDING_TIME_LABEL = "Holding Time Trend";

function buildHoldingTimeTrend(periods: Periods): EvolutionInsight {
  const recentHoldings = periods.recent.map(getHoldingMinutes).filter((m): m is number => m !== null);
  const previousHoldings = periods.previous.map(getHoldingMinutes).filter((m): m is number => m !== null);

  if (recentHoldings.length < MIN_TRADES_PER_PERIOD || previousHoldings.length < MIN_TRADES_PER_PERIOD) {
    return buildingHistoryInsight(HOLDING_TIME_LABEL);
  }

  const recentAvg = recentHoldings.reduce((s, m) => s + m, 0) / recentHoldings.length;
  const previousAvg = previousHoldings.reduce((s, m) => s + m, 0) / previousHoldings.length;
  const relativeChange = previousAvg > 0 ? (recentAvg - previousAvg) / previousAvg : 0;

  return {
    label: HOLDING_TIME_LABEL,
    value: classifyDirectionalTrend(relativeChange, "Getting Longer", "Getting Shorter"),
    metric: relativeChange,
    reasons: `Recent 30d: ${formatHoldingDuration(recentAvg)} avg hold · Previous 30d: ${formatHoldingDuration(previousAvg)} avg hold`,
    sampleSize: recentHoldings.length + previousHoldings.length,
  };
}

// ── 3 & 4. Session / Instrument Focus Trend ──────────────────────────────
// Never reads pnl. Concentration is each period's own share of trades
// sitting in its single most-used session/instrument — comparing that
// share period-over-period reveals whether the trader is narrowing in or
// spreading out, independent of whether it's literally the same
// session/instrument both times.

function computeConcentration<K extends string>(
  trades: Trade[],
  keyFn: (t: Trade) => K | null
): { concentration: number; topKey: K | null; sampleSize: number } {
  const withKey = trades.filter((t): t is Trade => keyFn(t) !== null);
  if (withKey.length === 0) return { concentration: 0, topKey: null, sampleSize: 0 };

  const counts = countBy(withKey, (t) => keyFn(t) as K);
  let topKey: K | null = null;
  let topCount = -1;
  for (const k of Object.keys(counts) as K[]) {
    const c = counts[k] ?? 0;
    if (c > topCount) {
      topKey = k;
      topCount = c;
    }
  }
  return { concentration: topCount / withKey.length, topKey, sampleSize: withKey.length };
}

function buildFocusTrend<K extends string>(
  label: string,
  periods: Periods,
  keyFn: (t: Trade) => K | null,
  scatteredLabel: string
): EvolutionInsight {
  const recent = computeConcentration(periods.recent, keyFn);
  const previous = computeConcentration(periods.previous, keyFn);

  if (recent.sampleSize < MIN_TRADES_PER_PERIOD || previous.sampleSize < MIN_TRADES_PER_PERIOD) {
    return buildingHistoryInsight(label);
  }

  const diff = recent.concentration - previous.concentration;

  return {
    label,
    value: classifyFocusTrend(diff, scatteredLabel),
    metric: diff,
    reasons: `Recent 30d: ${formatPercent(recent.concentration)} in ${recent.topKey} · Previous 30d: ${formatPercent(previous.concentration)} in ${previous.topKey}`,
    sampleSize: recent.sampleSize + previous.sampleSize,
  };
}

const SESSION_FOCUS_LABEL = "Session Focus Trend";
const INSTRUMENT_FOCUS_LABEL = "Instrument Focus Trend";

// ── 5. Expectancy Trend (Trader DNA V4) ──────────────────────────────────
// Compares mean pnl per trade (expectancy) between the two periods — the
// one Evolution insight that answers "is my edge itself improving?"

const EXPECTANCY_TREND_LABEL = "Expectancy Trend";

function buildExpectancyTrend(periods: Periods): EvolutionInsight {
  if (periods.recent.length < MIN_TRADES_PER_PERIOD || periods.previous.length < MIN_TRADES_PER_PERIOD) {
    return buildingHistoryInsight(EXPECTANCY_TREND_LABEL);
  }

  const recentExpectancy = mean(periods.recent.map((t) => t.pnl));
  const previousExpectancy = mean(periods.previous.map((t) => t.pnl));
  const scale = Math.max(Math.abs(previousExpectancy), 1);
  const relativeChange = (recentExpectancy - previousExpectancy) / scale;

  return {
    label: EXPECTANCY_TREND_LABEL,
    value: classifyDirectionalTrend(relativeChange, "Increasing", "Decreasing"),
    metric: relativeChange,
    reasons: `Recent 30d: ${formatMoneyPerTrade(recentExpectancy)} · Previous 30d: ${formatMoneyPerTrade(previousExpectancy)}`,
    sampleSize: periods.recent.length + periods.previous.length,
  };
}

// ── 6. Discipline Trend (Trader DNA V4) ──────────────────────────────────
// A behavioral proxy for "is my execution getting more or less disciplined
// over time?" — the coefficient of variation (stdDev/mean) of lot size
// within each period, same statistic traderDiscipline.ts's Risk
// Consistency uses, just compared period-over-period instead of read as a
// single snapshot. Rising variation reads as declining discipline.
//
// Never pools raw lot sizes across instruments (a 0.10 lot on XAUUSD isn't
// comparable to 2.00 lots on NDX100) — each instrument's CV is computed
// independently, then combined via a trade-count-weighted average, same
// approach traderDiscipline.ts's Risk Consistency uses.

const DISCIPLINE_TREND_LABEL = "Discipline Trend";

// A 30-day period is inherently smaller than the whole-history samples
// traderDiscipline.ts works with, so a single instrument only needs this
// many of its own trades within the period to contribute a CV — lower than
// MIN_TRADES_PER_PERIOD's whole-period floor, same relationship
// MIN_TRADES_PER_COMBO already has to MIN_TRADES_PER_PERIOD below for
// Setup Quality Trend.
const MIN_TRADES_PER_INSTRUMENT_PERIOD = 5;

interface LotSizeConsistency {
  cv: number;
  count: number;
}

function computeLotSizeConsistency(trades: Trade[]): LotSizeConsistency | null {
  const bySymbol = new Map<string, number[]>();
  for (const t of trades) {
    if (!t.symbol || t.quantity <= 0) continue;
    const lots = bySymbol.get(t.symbol) ?? [];
    lots.push(t.quantity);
    bySymbol.set(t.symbol, lots);
  }

  const perInstrument: LotSizeConsistency[] = [];
  for (const lots of bySymbol.values()) {
    if (lots.length < MIN_TRADES_PER_INSTRUMENT_PERIOD) continue;
    const avg = mean(lots);
    perInstrument.push({ cv: avg > 0 ? stdDev(lots) / avg : 0, count: lots.length });
  }
  if (perInstrument.length === 0) return null;

  const totalCount = perInstrument.reduce((s, p) => s + p.count, 0);
  const weightedCv = perInstrument.reduce((s, p) => s + p.cv * p.count, 0) / totalCount;
  return { cv: weightedCv, count: totalCount };
}

function buildDisciplineTrend(periods: Periods): EvolutionInsight {
  const recent = computeLotSizeConsistency(periods.recent);
  const previous = computeLotSizeConsistency(periods.previous);
  if (recent === null || previous === null) return buildingHistoryInsight(DISCIPLINE_TREND_LABEL);

  const relativeChange = previous.cv > 0 ? (recent.cv - previous.cv) / previous.cv : 0;

  return {
    label: DISCIPLINE_TREND_LABEL,
    // Rising position-sizing variation is declining discipline, so the
    // "increasing" direction maps to the "Declining" label and vice versa.
    value: classifyDirectionalTrend(relativeChange, "Declining", "Improving"),
    metric: relativeChange,
    reasons: `Recent 30d position-sizing variation: ${formatPercent(recent.cv)} · Previous 30d: ${formatPercent(previous.cv)}`,
    sampleSize: recent.count + previous.count,
  };
}

// ── 7. Setup Quality Trend (Trader DNA V4) ───────────────────────────────
// A behavioral proxy for "are my best setups getting better or worse?" —
// each period's single strongest (instrument, session, direction)
// combination by expectancy, compared period-over-period. This is a
// simpler stand-in for a full A+/B/C setup grade (see the Hidden Metrics
// this ticket keeps alive elsewhere in Trader DNA), which needs more
// history than a single comparison to define meaningfully.

const SETUP_QUALITY_LABEL = "Setup Quality Trend";
// A combo needs to repeat at least this many times within a single
// 30-day period before its expectancy means anything — much lower than
// MIN_TRADES_PER_PERIOD since a specific (instrument, session, direction)
// triple is naturally thinner than the period's overall trade count.
const MIN_TRADES_PER_COMBO = 3;

interface ComboExpectancy {
  expectancy: number;
  count: number;
}

function bestComboExpectancy(trades: Trade[]): ComboExpectancy | null {
  const groups = new Map<string, { sum: number; count: number }>();
  for (const t of trades) {
    if (!t.symbol || !t.session) continue;
    const key = `${t.symbol}|||${t.session}|||${t.direction}`;
    const g = groups.get(key) ?? { sum: 0, count: 0 };
    g.sum += t.pnl;
    g.count += 1;
    groups.set(key, g);
  }

  let best: ComboExpectancy | null = null;
  for (const { sum, count } of groups.values()) {
    if (count < MIN_TRADES_PER_COMBO) continue;
    const expectancy = sum / count;
    if (best === null || expectancy > best.expectancy) best = { expectancy, count };
  }
  return best;
}

function buildSetupQualityTrend(periods: Periods): EvolutionInsight {
  if (periods.recent.length < MIN_TRADES_PER_PERIOD || periods.previous.length < MIN_TRADES_PER_PERIOD) {
    return buildingHistoryInsight(SETUP_QUALITY_LABEL);
  }

  const recentBest = bestComboExpectancy(periods.recent);
  const previousBest = bestComboExpectancy(periods.previous);
  if (recentBest === null || previousBest === null) return buildingHistoryInsight(SETUP_QUALITY_LABEL);

  const scale = Math.max(Math.abs(previousBest.expectancy), 1);
  const relativeChange = (recentBest.expectancy - previousBest.expectancy) / scale;

  return {
    label: SETUP_QUALITY_LABEL,
    value: classifyDirectionalTrend(relativeChange, "Improving", "Declining"),
    metric: relativeChange,
    reasons: `Recent 30d best setup: ${formatMoneyPerTrade(recentBest.expectancy)} · Previous 30d: ${formatMoneyPerTrade(previousBest.expectancy)}`,
    sampleSize: recentBest.count + previousBest.count,
  };
}

// ── 8. Executive Summary (Trader DNA V4) ─────────────────────────────────
// A single deterministic paragraph stitched from the three trends the
// card actually shows — no data this engine hasn't already computed.

function trendClause(label: string, value: string, positiveWord: string, negativeWord: string): string | null {
  if (value === BUILDING_HISTORY) return null;
  if (value === "Stable") return `your ${label} has stayed stable`;
  return value === positiveWord ? `your ${label} is improving` : `your ${label} is ${negativeWord}`;
}

function buildEvolutionExecutiveSummary(
  expectancyTrend: EvolutionInsight,
  disciplineTrend: EvolutionInsight,
  setupQualityTrend: EvolutionInsight
): string {
  const clauses = [
    trendClause("expectancy", expectancyTrend.value, "Increasing", "declining"),
    trendClause("discipline", disciplineTrend.value, "Improving", "declining"),
    trendClause("setup quality", setupQualityTrend.value, "Improving", "declining"),
  ].filter((c): c is string => c !== null);

  if (clauses.length === 0) {
    return "Building history — check back once you have two comparable 30-day trading periods.";
  }

  const sentence = clauses.length === 1 ? clauses[0] : `${clauses.slice(0, -1).join(", ")} and ${clauses[clauses.length - 1]}`;
  return `Overall, ${sentence}.`;
}

// ── TraderEvolution ──────────────────────────────────────────────────────

export interface TraderEvolution {
  // Surfaced on the card (Trader DNA V4 simplification).
  expectancyTrend: EvolutionInsight;
  disciplineTrend: EvolutionInsight;
  setupQualityTrend: EvolutionInsight;
  executiveSummary: string;
  // Kept for the AI Coach — no longer shown on the card, but still
  // computed on every call.
  activityTrend: EvolutionInsight;
  holdingTimeTrend: EvolutionInsight;
  sessionFocusTrend: EvolutionInsight;
  instrumentFocusTrend: EvolutionInsight;
  metadata: TraderEvolutionMetadata;
}

export function getTraderEvolution(trades: Trade[]): TraderEvolution {
  const valid = trades.filter((t) => !!t.entryDate);
  const sorted = [...valid].sort((a, b) => a.entryDate.localeCompare(b.entryDate));
  const sampleSize = sorted.length;

  const tradingDays = new Set(sorted.map((t) => t.entryDate)).size;
  const firstTrade = sampleSize > 0 ? sorted[0].entryDate : null;
  const lastTrade = sampleSize > 0 ? sorted[sampleSize - 1].entryDate : null;

  const periods = splitIntoPeriods(sorted);

  const expectancyTrend = buildExpectancyTrend(periods);
  const disciplineTrend = buildDisciplineTrend(periods);
  const setupQualityTrend = buildSetupQualityTrend(periods);

  return {
    expectancyTrend,
    disciplineTrend,
    setupQualityTrend,
    executiveSummary: buildEvolutionExecutiveSummary(expectancyTrend, disciplineTrend, setupQualityTrend),
    activityTrend: buildActivityTrend(periods),
    holdingTimeTrend: buildHoldingTimeTrend(periods),
    sessionFocusTrend: buildFocusTrend(SESSION_FOCUS_LABEL, periods, (t) => t.session ?? null, "More Scattered"),
    instrumentFocusTrend: buildFocusTrend(
      INSTRUMENT_FOCUS_LABEL,
      periods,
      (t) => (t.symbol ? t.symbol : null),
      "More Diversified"
    ),
    metadata: {
      sampleSize,
      tradingDays,
      firstTrade,
      lastTrade,
    },
  };
}
