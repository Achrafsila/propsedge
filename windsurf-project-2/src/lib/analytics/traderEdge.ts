import { Trade } from "@/types";

// ============================================================
// PropEdge — Trader Edge engine (Trader DNA V1, Block 3)
// ============================================================
// Pure, stateless helpers over a Trade[] list. Edge answers exactly one
// question: "Under which conditions do I statistically perform best?" —
// unlike Identity and Habits (which never touch pnl), Edge is explicitly
// allowed to read pnl, but only to rank groups against each other, never to
// report total P&L on its own. Every ranking is done on expectancy
// (average pnl per trade) within a group, never summed pnl, so one large
// winner or loser inside a group can't outweigh its actual per-trade track
// record.
//
// This engine never blocks an insight for low sample size — it always
// ranks and shows whichever group is currently best, even off a single
// trade. A group's narrative is flagged "Early signal · based on N trades"
// below SMALL_SAMPLE_THRESHOLD instead of being hidden.
//
// Self-contained by design (no imports from traderDNA.ts, traderIdentity.ts,
// traderHabits.ts, or globalAnalytics.ts), same convention as the rest of
// Trader DNA. Every field is returned already formatted for display — React
// only renders this object, it never decides thresholds, units, or
// fallback copy. All narrative text is template-based, never generated (no
// AI).

const NO_TRADES_YET = "No trades yet";

// Below this many trades, a group's result is still real (never hidden or
// blocked) but is labeled as an early read rather than a settled pattern.
const SMALL_SAMPLE_THRESHOLD = 10;

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

// Groups trades by keyFn and returns the group with the highest expectancy
// (avg pnl per trade) — every group with at least one trade is eligible,
// no minimum sample size. Ranking is always by expectancy — never by
// summed pnl — so one large winner or loser inside a group can't outweigh
// the group's actual per-trade track record.
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
    const expectancy = sum / count;
    if (best === null || expectancy > best.expectancy) {
      best = { key, count, expectancy };
    }
  }
  return best;
}

function smallSampleNarrative(count: number): string {
  return `Early signal · based on ${count} trade${count === 1 ? "" : "s"}`;
}

function buildInsight<K extends string>(
  label: string,
  result: GroupResult<K> | null,
  narrative: string,
  formatValue: (key: K) => string = (key) => key
): EdgeInsight {
  if (result === null) {
    return { label, value: NO_TRADES_YET, metricLabel: "", narrative: "", sampleSize: 0 };
  }
  return {
    label,
    value: formatValue(result.key),
    metricLabel: formatExpectancy(result.expectancy),
    narrative: result.count < SMALL_SAMPLE_THRESHOLD ? smallSampleNarrative(result.count) : narrative,
    sampleSize: result.count,
  };
}

// ── Best Setup (Trader DNA V4) ────────────────────────────────────────────
// The one insight the card actually shows: the single (instrument, session,
// direction) combination with the highest expectancy, found by reusing
// rankByExpectancy() with a composite key instead of a single field —
// same ranking machinery as bestSession/bestInstrument/bestWeekday below,
// just a richer key. Those three per-dimension rankings are kept
// (computed and returned) for the AI Coach; only Best Setup is surfaced.

const SETUP_KEY_SEPARATOR = "|||";

function buildSetupKey(trade: Trade): string | null {
  if (!trade.session) return null;
  const symbol = trade.symbol ? trade.symbol : null;
  if (!symbol) return null;
  return [symbol, trade.session, trade.direction].join(SETUP_KEY_SEPARATOR);
}

function parseSetupKey(key: string): { symbol: string; session: string; direction: string } {
  const [symbol, session, direction] = key.split(SETUP_KEY_SEPARATOR);
  return { symbol, session, direction };
}

function buildBestSetupInsight(result: GroupResult<string> | null): EdgeInsight {
  if (result === null) {
    return { label: "Best Setup", value: NO_TRADES_YET, detail: "", metricLabel: "", narrative: "", sampleSize: 0 };
  }
  const { symbol, session, direction } = parseSetupKey(result.key);
  const directionLabel = direction === "short" ? "Short" : "Long";
  return {
    label: "Best Setup",
    value: symbol,
    detail: `${session} Session • ${directionLabel}`,
    metricLabel: formatExpectancy(result.expectancy),
    narrative:
      result.count < SMALL_SAMPLE_THRESHOLD
        ? smallSampleNarrative(result.count)
        : "This combination currently produces your strongest statistical edge.",
    sampleSize: result.count,
  };
}

// ── Executive Summary ────────────────────────────────────────────────────
// A single deterministic sentence built from Best Setup — the one ranking
// the card actually shows.

function buildExecutiveSummary(bestSetupResult: GroupResult<string> | null): string {
  if (bestSetupResult === null) return NO_TRADES_YET;
  const { symbol, session, direction } = parseSetupKey(bestSetupResult.key);
  const directionLabel = direction === "short" ? "short" : "long";
  return `Your strongest statistical edge currently comes from trading ${symbol} during the ${session} session on the ${directionLabel} side.`;
}

// ── Insight & Metadata ───────────────────────────────────────────────────

export interface EdgeInsight {
  label: string;
  value: string;
  // Secondary line for a multi-part value (Best Setup's session/direction);
  // empty for the single-dimension insights.
  detail?: string;
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
  // Surfaced on the card (Trader DNA V4 simplification).
  bestSetup: EdgeInsight;
  executiveSummary: string;
  // Kept for the AI Coach — no longer shown on the card, but still
  // computed on every call.
  bestSession: EdgeInsight;
  bestInstrument: EdgeInsight;
  bestWeekday: EdgeInsight;
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
  const weekdayResult = rankByExpectancy(sorted, (t) => getDayOfWeek(t.entryDate));
  const setupResult = rankByExpectancy(sorted, buildSetupKey);

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
  const bestSetup = setupResult === null && sampleSize > 0
    ? { label: "Best Setup", value: "No qualified setup identified", detail: "", metricLabel: "", narrative: "Record a setup for each trade to analyse performance by setup.", sampleSize: 0 }
    : buildBestSetupInsight(setupResult);

  return {
    bestSetup,
    executiveSummary: setupResult === null && sampleSize > 0 ? "No qualified setup identified yet. Tag your trade setups to unlock this insight." : buildExecutiveSummary(setupResult),
    bestSession,
    bestInstrument,
    bestWeekday,
    metadata: {
      sampleSize,
      tradingDays,
      firstTrade,
      lastTrade,
    },
  };
}
