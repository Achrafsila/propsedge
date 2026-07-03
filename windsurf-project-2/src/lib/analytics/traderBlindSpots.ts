import { Trade } from "@/types";

// ============================================================
// PropEdge — Trader Blind Spots engine (Trader DNA V1, Block 4)
// ============================================================
// Pure, stateless helpers over a Trade[] list. Blind Spots answers exactly
// one question: "Where do I lose my edge?" — like Your Edge, it's allowed
// to read pnl, but only to surface weak contexts and risk patterns, never
// to report total P&L on its own. A single huge losing trade must not be
// able to condemn a session, instrument, weekday, or trade-order slot as a
// "blind spot" — every ranking is done on expectancy (average pnl per
// trade) within a group, and any group below the minimum sample size is
// excluded from the ranking entirely. This block highlights contexts, not
// the trader.
//
// Self-contained by design (no imports from traderDNA.ts, traderIdentity.ts,
// traderHabits.ts, traderEdge.ts, or globalAnalytics.ts), same convention as
// the rest of Trader DNA. Every field is returned already formatted for
// display — React only renders this object, it never decides thresholds,
// units, or fallback copy.

const NOT_ENOUGH_DATA = "Not enough data";

// A group's expectancy needs enough trades behind it to be a statistical
// signal rather than a coincidence (or one outsized loss skewing the
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

function getMinutesOfDay(timeStr?: string): number | null {
  if (!timeStr) return null;
  const m = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = +m[1];
  const min = +m[2];
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function groupByDate(trades: Trade[]): Map<string, Trade[]> {
  const map = new Map<string, Trade[]>();
  for (const t of trades) {
    const bucket = map.get(t.entryDate);
    if (bucket) bucket.push(t);
    else map.set(t.entryDate, [t]);
  }
  return map;
}

function formatExpectancy(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toFixed(2)}/trade`;
}

function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]}`;
}

interface GroupResult<K extends string> {
  key: K;
  count: number;
  expectancy: number;
}

// Groups trades by keyFn, computes each group's expectancy (avg pnl per
// trade), drops any group under MIN_GROUP_SAMPLE_SIZE, and returns the
// group with the LOWEST expectancy among the ones left. Ranking is always
// by expectancy — never by summed pnl — so one large losing trade inside a
// group can't outweigh the group's actual per-trade track record.
function rankByLowestExpectancy<K extends string>(
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

  let worst: GroupResult<K> | null = null;
  for (const [key, { sum, count }] of groups) {
    if (count < MIN_GROUP_SAMPLE_SIZE) continue;
    const expectancy = sum / count;
    if (worst === null || expectancy < worst.expectancy) {
      worst = { key, count, expectancy };
    }
  }
  return worst;
}

function buildInsight<K extends string>(label: string, result: GroupResult<K> | null): BlindSpotInsight {
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

// ── Performance After Trade Number ───────────────────────────────────────
// Trades are ordered within each trading day by entry time-of-day, bucketed
// into "1st trade of the day", "2nd", "3rd", or "4th or later" — then each
// bucket's expectancy is compared the same way as session/instrument/
// weekday. Trades missing an entryTime can't be placed in a sequence, so
// they're excluded from this insight only (same "exclude, don't guess"
// policy traderHabits.ts uses for holding-time).

type TradeNumberBucket = "1" | "2" | "3" | "4+";

const TRADE_NUMBER_BUCKETS: TradeNumberBucket[] = ["1", "2", "3", "4+"];

function bucketForOrder(order: number): TradeNumberBucket {
  return order >= 4 ? "4+" : (String(order) as TradeNumberBucket);
}

function rankTradeNumberBuckets(trades: Trade[]): GroupResult<TradeNumberBucket> | null {
  const withEntryTime = trades.filter((t) => getMinutesOfDay(t.entryTime) !== null);
  const byDate = groupByDate(withEntryTime);

  // Pre-seeded in fixed order so ties resolve toward the earlier trade
  // number, and so a day with only 2 trades doesn't skip "3"/"4+" from the
  // map (they just stay at zero until another day fills them in).
  const groups = new Map<TradeNumberBucket, { sum: number; count: number }>();
  for (const bucket of TRADE_NUMBER_BUCKETS) groups.set(bucket, { sum: 0, count: 0 });

  for (const dayTrades of byDate.values()) {
    const ordered = [...dayTrades].sort(
      (a, b) => (getMinutesOfDay(a.entryTime) as number) - (getMinutesOfDay(b.entryTime) as number)
    );
    ordered.forEach((t, idx) => {
      const g = groups.get(bucketForOrder(idx + 1))!;
      g.sum += t.pnl;
      g.count += 1;
    });
  }

  let worst: GroupResult<TradeNumberBucket> | null = null;
  for (const bucket of TRADE_NUMBER_BUCKETS) {
    const { sum, count } = groups.get(bucket)!;
    if (count < MIN_GROUP_SAMPLE_SIZE) continue;
    const expectancy = sum / count;
    if (worst === null || expectancy < worst.expectancy) {
      worst = { key: bucket, count, expectancy };
    }
  }
  return worst;
}

const PERFORMANCE_AFTER_TRADE_NUMBER_LABEL = "Performance After Trade Number";

function buildTradeNumberInsight(result: GroupResult<TradeNumberBucket> | null): BlindSpotInsight {
  if (result === null) {
    return {
      label: PERFORMANCE_AFTER_TRADE_NUMBER_LABEL,
      value: NOT_ENOUGH_DATA,
      metric: null,
      reasons: NOT_ENOUGH_DATA,
      sampleSize: 0,
    };
  }

  const formatted = formatExpectancy(result.expectancy);
  const value =
    result.key === "4+"
      ? "Performance drops after your 3rd trade"
      : `Weakest on your ${ordinal(Number(result.key))} trade of the day`;

  return {
    label: PERFORMANCE_AFTER_TRADE_NUMBER_LABEL,
    value,
    metric: result.expectancy,
    reasons: `Based on ${result.count} trade${result.count === 1 ? "" : "s"} · Avg ${formatted}`,
    sampleSize: result.count,
  };
}

// ── Insight & Metadata ───────────────────────────────────────────────────

export interface BlindSpotInsight {
  label: string;
  value: string;
  metric: number | null;
  reasons: string;
  sampleSize: number;
}

export interface TraderBlindSpotsMetadata {
  sampleSize: number;
  tradingDays: number;
  firstTrade: string | null; // "YYYY-MM-DD"
  lastTrade: string | null; // "YYYY-MM-DD"
}

// ── TraderBlindSpots ─────────────────────────────────────────────────────

export interface TraderBlindSpots {
  worstSession: BlindSpotInsight;
  worstInstrument: BlindSpotInsight;
  weakestWeekday: BlindSpotInsight;
  performanceAfterTradeNumber: BlindSpotInsight;
  metadata: TraderBlindSpotsMetadata;
}

export function getTraderBlindSpots(trades: Trade[]): TraderBlindSpots {
  const valid = trades.filter((t) => !!t.entryDate && Number.isFinite(t.pnl));
  const sorted = [...valid].sort((a, b) => a.entryDate.localeCompare(b.entryDate));
  const sampleSize = sorted.length;

  const tradingDays = new Set(sorted.map((t) => t.entryDate)).size;
  const firstTrade = sampleSize > 0 ? sorted[0].entryDate : null;
  const lastTrade = sampleSize > 0 ? sorted[sampleSize - 1].entryDate : null;

  const worstSession = buildInsight("Worst Session", rankByLowestExpectancy(sorted, (t) => t.session ?? null));
  const worstInstrument = buildInsight(
    "Worst Instrument",
    rankByLowestExpectancy(sorted, (t) => (t.symbol ? t.symbol : null))
  );
  const weakestWeekday = buildInsight(
    "Weakest Weekday",
    rankByLowestExpectancy(sorted, (t) => getDayOfWeek(t.entryDate))
  );
  const performanceAfterTradeNumber = buildTradeNumberInsight(rankTradeNumberBuckets(sorted));

  return {
    worstSession,
    worstInstrument,
    weakestWeekday,
    performanceAfterTradeNumber,
    metadata: {
      sampleSize,
      tradingDays,
      firstTrade,
      lastTrade,
    },
  };
}
