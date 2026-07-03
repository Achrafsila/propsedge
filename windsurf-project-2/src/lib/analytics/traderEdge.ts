import { Trade } from "@/types";

// ============================================================
// PropEdge — Trader Edge engine (Trader DNA V1, Block 3)
// ============================================================
// Pure, stateless helpers over a Trade[] list. Edge answers exactly one
// question: "Where do I statistically perform best?" — unlike Identity and
// Habits (which never touch pnl), Edge is explicitly allowed to read pnl,
// but only to rank groups against each other, never to report total P&L on
// its own. A single huge trade must not be able to crown a session,
// instrument, weekday, or direction as "best" — every ranking is done on
// expectancy (average pnl per trade) within a group, and any group below
// the minimum sample size is excluded from the ranking entirely.
//
// Self-contained by design (no imports from traderDNA.ts, traderIdentity.ts,
// traderHabits.ts, or globalAnalytics.ts), same convention as the rest of
// Trader DNA. Every field is returned already formatted for display — React
// only renders this object, it never decides thresholds, units, or
// fallback copy.

const NOT_ENOUGH_DATA = "Not enough data";

// A group's expectancy needs enough trades behind it to be a statistical
// signal rather than a coincidence (or one outsized trade skewing the
// average) — 10 trades is the V1 floor.
const MIN_GROUP_SAMPLE_SIZE = 10;

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

function getDirectionLabel(trade: Trade): "Long" | "Short" | null {
  if (trade.direction === "long") return "Long";
  if (trade.direction === "short") return "Short";
  return null;
}

function formatExpectancy(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toFixed(2)}/trade`;
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

function buildInsight<K extends string>(label: string, result: GroupResult<K> | null): EdgeInsight {
  if (result === null) {
    return {
      label,
      value: NOT_ENOUGH_DATA,
      metric: null,
      reasons: NOT_ENOUGH_DATA,
      sampleSize: 0,
    };
  }

  const formatted = formatExpectancy(result.expectancy);
  return {
    label,
    value: result.key,
    metric: result.expectancy,
    reasons: `Based on ${result.count} trade${result.count === 1 ? "" : "s"} · Avg ${formatted}`,
    sampleSize: result.count,
  };
}

// ── Insight & Metadata ───────────────────────────────────────────────────

export interface EdgeInsight {
  label: string;
  value: string;
  metric: number | null;
  reasons: string;
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
  bestDirection: EdgeInsight;
  metadata: TraderEdgeMetadata;
}

export function getTraderEdge(trades: Trade[]): TraderEdge {
  const valid = trades.filter((t) => !!t.entryDate && Number.isFinite(t.pnl));
  const sorted = [...valid].sort((a, b) => a.entryDate.localeCompare(b.entryDate));
  const sampleSize = sorted.length;

  const tradingDays = new Set(sorted.map((t) => t.entryDate)).size;
  const firstTrade = sampleSize > 0 ? sorted[0].entryDate : null;
  const lastTrade = sampleSize > 0 ? sorted[sampleSize - 1].entryDate : null;

  const bestSession = buildInsight("Best Session", rankByExpectancy(sorted, (t) => t.session ?? null));
  const bestInstrument = buildInsight(
    "Best Instrument",
    rankByExpectancy(sorted, (t) => (t.symbol ? t.symbol : null))
  );
  const bestWeekday = buildInsight("Best Weekday", rankByExpectancy(sorted, (t) => getDayOfWeek(t.entryDate)));
  const bestDirection = buildInsight("Best Direction", rankByExpectancy(sorted, getDirectionLabel));

  return {
    bestSession,
    bestInstrument,
    bestWeekday,
    bestDirection,
    metadata: {
      sampleSize,
      tradingDays,
      firstTrade,
      lastTrade,
    },
  };
}
