import { Trade } from "@/types";

// ============================================================
// PropEdge — Trader Blind Spots engine (Trader DNA V1, Block 4)
// ============================================================
// Pure, stateless helpers over a Trade[] list. Blind Spots answers exactly
// one question: "In which situations should I be most careful?" — like
// Your Edge, it's allowed to read pnl, but only to surface weak contexts
// and risk patterns, never to report total P&L on its own. Every ranking
// is done on expectancy (average pnl per trade) within a group, never
// summed pnl, so one large losing trade can't outweigh a group's actual
// per-trade track record. This block highlights contexts, not the trader.
//
// This engine never blocks an insight for low sample size — it always
// ranks and shows whichever group is currently weakest, even off a single
// trade. A group's narrative is flagged "Early signal · based on N trades"
// below SMALL_SAMPLE_THRESHOLD instead of being hidden.
//
// Self-contained by design (no imports from traderDNA.ts, traderIdentity.ts,
// traderHabits.ts, traderEdge.ts, or globalAnalytics.ts), same convention as
// the rest of Trader DNA. Every field is returned already formatted for
// display — React only renders this object, it never decides thresholds,
// units, or fallback copy. All narrative text is template-based, never
// generated (no AI).

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
  return `${sign}$${Math.abs(value).toFixed(2)} expectancy / trade`;
}

// "1" -> "first", "2" -> "second", "3" -> "third" — the only values the
// trade-number buckets ever produce (see TRADE_NUMBER_BUCKETS below).
function ordinalWord(n: number): string {
  return n === 1 ? "first" : n === 2 ? "second" : n === 3 ? "third" : `${n}th`;
}

interface GroupResult<K extends string> {
  key: K;
  count: number;
  expectancy: number;
}

// Groups trades by keyFn and returns the group with the LOWEST expectancy
// (avg pnl per trade) — every group with at least one trade is eligible,
// no minimum sample size. Ranking is always by expectancy — never by
// summed pnl — so one large losing trade inside a group can't outweigh the
// group's actual per-trade track record.
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
    const expectancy = sum / count;
    if (worst === null || expectancy < worst.expectancy) {
      worst = { key, count, expectancy };
    }
  }
  return worst;
}

function smallSampleNarrative(count: number): string {
  return `Early signal · based on ${count} trade${count === 1 ? "" : "s"}`;
}

function buildInsight<K extends string>(
  label: string,
  result: GroupResult<K> | null,
  narrative: string,
  formatValue: (key: K) => string = (key) => key
): BlindSpotInsight {
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
    if (count === 0) continue; // bucket never occurred — nothing to rank
    const expectancy = sum / count;
    if (worst === null || expectancy < worst.expectancy) {
      worst = { key: bucket, count, expectancy };
    }
  }
  return worst;
}

const PERFORMANCE_AFTER_TRADE_NUMBER_LABEL = "Performance After Trade Number";

// "4+" means the entire tail from the 4th trade onward under-performs, so
// the story is framed as a decline starting right after the 3rd trade. A
// worst bucket of exactly "1"/"2"/"3" instead means that specific trade
// slot is the weak one, not a tail — framed as "weakest on trade N".
function buildTradeNumberInsight(result: GroupResult<TradeNumberBucket> | null): BlindSpotInsight {
  if (result === null) {
    return {
      label: PERFORMANCE_AFTER_TRADE_NUMBER_LABEL,
      value: NO_TRADES_YET,
      metricLabel: "",
      narrative: "",
      sampleSize: 0,
    };
  }

  const metricLabel = formatExpectancy(result.expectancy);
  const isSmallSample = result.count < SMALL_SAMPLE_THRESHOLD;

  if (result.key === "4+") {
    return {
      label: PERFORMANCE_AFTER_TRADE_NUMBER_LABEL,
      value: "After Trade #3",
      metricLabel,
      narrative: isSmallSample
        ? smallSampleNarrative(result.count)
        : "Your average performance declines after your third trade of the day.",
      sampleSize: result.count,
    };
  }

  const n = Number(result.key);
  return {
    label: PERFORMANCE_AFTER_TRADE_NUMBER_LABEL,
    value: `Trade #${n}`,
    metricLabel,
    narrative: isSmallSample
      ? smallSampleNarrative(result.count)
      : `Your average performance is weakest on your ${ordinalWord(n)} trade of the day.`,
    sampleSize: result.count,
  };
}

function tradeNumberClause(result: GroupResult<TradeNumberBucket> | null): string | null {
  if (result === null) return null;
  return result.key === "4+"
    ? "from taking trades after your third position of the day"
    : `from your ${ordinalWord(Number(result.key))} trade of the day`;
}

// ── Executive Summary ────────────────────────────────────────────────────
// A single deterministic sentence built from the worst instrument (falling
// back to worst session) and the trade-number pattern above — no data this
// engine hasn't already computed.

function buildExecutiveSummary(
  instrumentResult: GroupResult<string> | null,
  sessionResult: GroupResult<string> | null,
  tradeNumberResult: GroupResult<TradeNumberBucket> | null
): string {
  const subject = instrumentResult
    ? `trading ${instrumentResult.key}`
    : sessionResult
      ? `trading during the ${sessionResult.key} session`
      : null;
  const tradeClause = tradeNumberClause(tradeNumberResult);

  if (subject && tradeClause) {
    return `Your weakest statistical performance currently comes from ${subject} and ${tradeClause}.`;
  }
  if (subject) {
    return `Your weakest statistical performance currently comes from ${subject}.`;
  }
  if (tradeClause) {
    return `Your weakest statistical performance currently comes ${tradeClause}.`;
  }
  return NO_TRADES_YET;
}

// ── Insight & Metadata ───────────────────────────────────────────────────

export interface BlindSpotInsight {
  label: string;
  value: string;
  metricLabel: string;
  narrative: string;
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
  executiveSummary: string;
  metadata: TraderBlindSpotsMetadata;
}

export function getTraderBlindSpots(trades: Trade[]): TraderBlindSpots {
  const valid = trades.filter((t) => !!t.entryDate && Number.isFinite(t.pnl));
  const sorted = [...valid].sort((a, b) => a.entryDate.localeCompare(b.entryDate));
  const sampleSize = sorted.length;

  const tradingDays = new Set(sorted.map((t) => t.entryDate)).size;
  const firstTrade = sampleSize > 0 ? sorted[0].entryDate : null;
  const lastTrade = sampleSize > 0 ? sorted[sampleSize - 1].entryDate : null;

  const sessionResult = rankByLowestExpectancy(sorted, (t) => t.session ?? null);
  const instrumentResult = rankByLowestExpectancy(sorted, (t) => (t.symbol ? t.symbol : null));
  const weekdayResult = rankByLowestExpectancy(sorted, (t) => getDayOfWeek(t.entryDate));
  const tradeNumberResult = rankTradeNumberBuckets(sorted);

  const worstSession = buildInsight(
    "Worst Session",
    sessionResult,
    "This session currently delivers your weakest statistical performance.",
    (key) => `${key} Session`
  );
  const worstInstrument = buildInsight(
    "Worst Instrument",
    instrumentResult,
    "This market currently produces your weakest statistical edge."
  );
  const weakestWeekday = buildInsight(
    "Weakest Weekday",
    weekdayResult,
    "This weekday currently delivers your weakest average expectancy."
  );
  const performanceAfterTradeNumber = buildTradeNumberInsight(tradeNumberResult);

  return {
    worstSession,
    worstInstrument,
    weakestWeekday,
    performanceAfterTradeNumber,
    executiveSummary: buildExecutiveSummary(instrumentResult, sessionResult, tradeNumberResult),
    metadata: {
      sampleSize,
      tradingDays,
      firstTrade,
      lastTrade,
    },
  };
}
