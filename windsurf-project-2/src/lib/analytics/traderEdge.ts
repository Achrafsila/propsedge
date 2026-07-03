import { Trade } from "@/types";

// ============================================================
// PropEdge — Trader Edge engine (Trader DNA V1, Block 3)
// ============================================================
// Pure, stateless helpers over a Trade[] list. Edge answers exactly one
// question: "Under which conditions do I statistically perform best?" —
// unlike Identity and Habits (which never touch pnl), Edge is explicitly
// allowed to read pnl, but only to rank groups against each other, never to
// report total P&L on its own. A single huge trade must not be able to
// crown a session, instrument, or weekday as "best" — every ranking is done
// on expectancy (average pnl per trade) within a group, and any group below
// the minimum sample size is excluded from the ranking entirely.
//
// Self-contained by design (no imports from traderDNA.ts, traderIdentity.ts,
// traderHabits.ts, or globalAnalytics.ts), same convention as the rest of
// Trader DNA. Every field is returned already formatted for display — React
// only renders this object, it never decides thresholds, units, or
// fallback copy. All narrative text is template-based, never generated (no
// AI).

const NOT_ENOUGH_DATA = "Not enough data";

// A group's expectancy needs enough trades behind it to be a statistical
// signal rather than a coincidence (or one outsized trade skewing the
// average) — 10 trades is the V1 floor. Used for session and instrument;
// weekday uses a separate, stricter rule (see MIN_ACTIVE_DAYS_FOR_WEEKDAY).
const MIN_GROUP_SAMPLE_SIZE = 10;

// A weekday's expectancy can look artificially strong from just a couple of
// calendar days if a trader takes many trades in one sitting — 10 trades on
// two Mondays isn't a "Monday edge," it's two good days. Best Weekday
// instead requires at least this many DISTINCT trading days landing on that
// weekday, not just this many trades.
const MIN_ACTIVE_DAYS_FOR_WEEKDAY = 7;

// ── Shared helpers ───────────────────────────────────────────────────────

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

function formatExpectancy(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toFixed(2)} expectancy / trade`;
}

interface GroupResult<K extends string> {
  key: K;
  count: number;
  expectancy: number;
}

// Groups trades by keyFn, computes each group's expectancy (avg pnl per
// trade), drops any group under MIN_GROUP_SAMPLE_SIZE, and returns the
// group with the highest expectancy among the ones left. Ranking is always
// by expectancy — never by summed pnl — so one large winner or loser inside
// a group can't outweigh the group's actual per-trade track record.
function rankByExpectancy<K extends string>(
  trades: Trade[],
  keyFn: (t: Trade) => K | null
): GroupResult<K> | null {
  const groups = new Map<K, { sum: number; count: number }>();

  for (const t of trades) {
    const key = keyFn(t);
    if (key === null) continue;
    const g = groups.get(key) ?? { sum: 0, count: 0 };
    g.sum += t.pnl;
    g.count += 1;
    groups.set(key, g);
  }

  let best: GroupResult<K> | null = null;
  for (const [key, { sum, count }] of groups) {
    if (count < MIN_GROUP_SAMPLE_SIZE) continue;
    const expectancy = sum / count;
    if (best === null || expectancy > best.expectancy) {
      best = { key, count, expectancy };
    }
  }
  return best;
}

// Same ranking as rankByExpectancy, but the validity gate is on the number
// of DISTINCT calendar days landing on that weekday, not the trade count —
// see MIN_ACTIVE_DAYS_FOR_WEEKDAY above.
function rankWeekdayByExpectancy(trades: Trade[]): GroupResult<DayOfWeek> | null {
  const groups = new Map<DayOfWeek, { sum: number; count: number; activeDays: Set<string> }>();

  for (const t of trades) {
    const key = getDayOfWeek(t.entryDate);
    if (key === null) continue;
    const g = groups.get(key) ?? { sum: 0, count: 0, activeDays: new Set<string>() };
    g.sum += t.pnl;
    g.count += 1;
    g.activeDays.add(t.entryDate);
    groups.set(key, g);
  }

  let best: GroupResult<DayOfWeek> | null = null;
  for (const [key, { sum, count, activeDays }] of groups) {
    if (activeDays.size < MIN_ACTIVE_DAYS_FOR_WEEKDAY) continue;
    const expectancy = sum / count;
    if (best === null || expectancy > best.expectancy) {
      best = { key, count, expectancy };
    }
  }
  return best;
}

function buildInsight<K extends string>(
  label: string,
  result: GroupResult<K> | null,
  narrative: string,
  formatValue: (key: K) => string = (key) => key
): EdgeInsight {
  if (result === null) {
    return { label, value: NOT_ENOUGH_DATA, metricLabel: "", narrative: "", sampleSize: 0 };
  }
  return {
    label,
    value: formatValue(result.key),
    metricLabel: formatExpectancy(result.expectancy),
    narrative,
    sampleSize: result.count,
  };
}

// ── Executive Summary ────────────────────────────────────────────────────
// A single deterministic sentence built from the same three ranked results
// above — no data this engine hasn't already computed.

function buildExecutiveSummary(
  sessionResult: GroupResult<DayOfWeek | string> | null,
  instrumentResult: GroupResult<string> | null,
  weekdayResult: GroupResult<DayOfWeek> | null
): string {
  let base: string;
  if (instrumentResult && sessionResult) {
    base = `Your strongest statistical edge currently comes from trading ${instrumentResult.key} during the ${sessionResult.key} session.`;
  } else if (instrumentResult) {
    base = `Your strongest edge currently comes from trading ${instrumentResult.key}.`;
  } else if (sessionResult) {
    base = `Your strongest statistical edge currently comes from trading during the ${sessionResult.key} session.`;
  } else {
    return "Not enough trade history yet to identify your strongest statistical edge.";
  }

  return weekdayResult
    ? `${base} ${weekdayResult.key} also stands out as your strongest trading day.`
    : `${base} More historical data is required before identifying a reliable weekday.`;
}

// ── Insight & Metadata ───────────────────────────────────────────────────

export interface EdgeInsight {
  label: string;
  value: string;
  metricLabel: string;
  narrative: string;
  sampleSize: number;
}

export interface TraderEdgeMetadata {
  sampleSize: number;
  tradingDays: number;
  firstTrade: string | null; // "YYYY-MM-DD"
  lastTrade: string | null; // "YYYY-MM-DD"
}

// ── TraderEdge ───────────────────────────────────────────────────────────

export interface TraderEdge {
  bestSession: EdgeInsight;
  bestInstrument: EdgeInsight;
  bestWeekday: EdgeInsight;
  executiveSummary: string;
  metadata: TraderEdgeMetadata;
}

export function getTraderEdge(trades: Trade[]): TraderEdge {
  const valid = trades.filter((t) => !!t.entryDate && Number.isFinite(t.pnl));
  const sorted = [...valid].sort((a, b) => a.entryDate.localeCompare(b.entryDate));
  const sampleSize = sorted.length;

  const tradingDays = new Set(sorted.map((t) => t.entryDate)).size;
  const firstTrade = sampleSize > 0 ? sorted[0].entryDate : null;
  const lastTrade = sampleSize > 0 ? sorted[sampleSize - 1].entryDate : null;

  const sessionResult = rankByExpectancy(sorted, (t) => t.session ?? null);
  const instrumentResult = rankByExpectancy(sorted, (t) => (t.symbol ? t.symbol : null));
  const weekdayResult = rankWeekdayByExpectancy(sorted);

  const bestSession = buildInsight(
    "Best Session",
    sessionResult,
    "This session currently produces your strongest statistical edge.",
    (key) => `${key} Session`
  );
  const bestInstrument = buildInsight(
    "Best Instrument",
    instrumentResult,
    "This instrument currently delivers your highest average expectancy."
  );
  const bestWeekday = buildInsight(
    "Best Weekday",
    weekdayResult,
    "This weekday currently delivers your strongest average expectancy."
  );

  return {
    bestSession,
    bestInstrument,
    bestWeekday,
    executiveSummary: buildExecutiveSummary(sessionResult, instrumentResult, weekdayResult),
    metadata: {
      sampleSize,
      tradingDays,
      firstTrade,
      lastTrade,
    },
  };
}
