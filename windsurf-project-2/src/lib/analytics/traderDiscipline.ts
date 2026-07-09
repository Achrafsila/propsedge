import { Trade } from "@/types";

// ============================================================
// PropEdge — Risk Management engine (Trader DNA V1, Block 5)
// ============================================================
// Pure, stateless helpers over a Trade[] list. This block answers exactly
// one question: "How do I actually manage my trading risk?" — it is about
// position-sizing BEHAVIOR (lot size distribution, and how size shifts
// around wins/losses), not profitability. The Lot Size Sweet Spot insight
// is the one place this file reads pnl, and only to compare expectancy
// across a trader's own historical lot-size choices — never to recommend
// a "better" size, this isn't an optimization engine.
//
// Self-contained by design (no imports from traderDNA.ts, traderIdentity.ts,
// traderHabits.ts, traderEdge.ts, or traderBlindSpots.ts), same convention
// as the rest of Trader DNA. Every field is returned already formatted for
// display — React only renders this object, it never decides thresholds,
// units, or fallback copy. All narrative text is template-based, never
// generated (no AI).
//
// Exported names (getTraderDiscipline, TraderDiscipline, the "discipline"
// prop on TraderDNASections) are unchanged from the old Discipline block —
// only src/lib/analytics/traderDiscipline.ts and
// src/components/analytics/TradingDisciplineCard.tsx were in scope for this
// redesign, so the wiring in page.tsx/TraderDNASections.tsx is left alone.
// "Risk Management" is the card's displayed title, not a new export name.

const NOT_ENOUGH_DATA = "Not enough data";

// A group's expectancy (Lot Size Sweet Spot) or a before/after comparison
// (Position Size After Wins/Losses) needs enough trades to be a signal
// rather than a coincidence — same 10-trade floor Your Edge and Blind
// Spots use for their expectancy rankings.
const MIN_GROUP_SAMPLE_SIZE = 10;

// Risk Consistency reads the whole lot-size distribution, so it needs the
// same floor before a standard deviation means anything.
const MIN_TRADES_FOR_LOT_ANALYSIS = 10;

// A relative before/after change smaller than this is treated as noise,
// not a deliberate sizing shift.
const SIZE_SHIFT_THRESHOLD = 0.1;

const TOP_INSTRUMENT_COUNT = 2;

// ── Shared helpers ───────────────────────────────────────────────────────

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

function sortChronologically(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => {
    const dateCompare = a.entryDate.localeCompare(b.entryDate);
    if (dateCompare !== 0) return dateCompare;
    return (a.entryTime ?? "").localeCompare(b.entryTime ?? "");
  });
}

function formatLot(value: number): string {
  return `${value.toFixed(2)} lot`;
}

function formatExpectancy(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toFixed(2)} expectancy/trade`;
}

// Same "$X.XX/trade" shape as formatExpectancy, without the "expectancy"
// word — used for the Loss Psychology insights below, which report a
// plain average pnl per trade rather than a ranked group's expectancy.
function formatPnlPerTrade(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toFixed(2)}/trade`;
}

// Minutes between a trade's exit and the next trade's entry. Only
// computable when both timestamps are present — same "exclude, don't
// guess" policy traderHabits.ts/traderIdentity.ts use for holding-time,
// applied here to re-entry delay instead.
function toTimestamp(dateStr: string, timeStr?: string): number | null {
  if (!dateStr || !timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return null;
  const ts = new Date(`${dateStr}T${timeStr}:00`).getTime();
  return Number.isFinite(ts) ? ts : null;
}

function getReentryMinutes(exitedTrade: Trade, nextTrade: Trade): number | null {
  const exitTs = toTimestamp(exitedTrade.exitDate, exitedTrade.exitTime);
  const entryTs = toTimestamp(nextTrade.entryDate, nextTrade.entryTime);
  if (exitTs === null || entryTs === null) return null;
  const diffMinutes = (entryTs - exitTs) / 60_000;
  return diffMinutes >= 0 ? diffMinutes : null;
}

function formatMinutes(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} min`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return `${h}h ${m}m`;
}

// ── Insight & Metadata ───────────────────────────────────────────────────

export interface RiskInsight {
  label: string;
  value: string;
  metricLabel: string;
  narrative: string;
  sampleSize: number;
}

function notEnoughDataInsight(label: string): RiskInsight {
  return { label, value: NOT_ENOUGH_DATA, metricLabel: "", narrative: "", sampleSize: 0 };
}

export interface InstrumentLotSize {
  symbol: string;
  averageLot: string;
}

export interface InstrumentSweetSpot {
  symbol: string;
  lot: string;
  metricLabel: string;
  narrative: string;
}

export interface TraderDisciplineMetadata {
  sampleSize: number;
  tradingDays: number;
  firstTrade: string | null; // "YYYY-MM-DD"
  lastTrade: string | null; // "YYYY-MM-DD"
}

// ── 1. Risk Consistency ──────────────────────────────────────────────────
// How stable a trader's lot size is, judged by the coefficient of
// variation (stdDev/mean) across every trade's lot size — scale-independent,
// so a trader who always trades ~0.2 lot and one who always trades ~2 lot
// can both read as "Highly Consistent" if their own sizing barely varies.

const RISK_CONSISTENCY_LABEL = "Risk Consistency";

function classifyRiskConsistency(cv: number): string {
  if (cv <= 0.1) return "Highly Consistent";
  if (cv <= 0.25) return "Consistent";
  if (cv <= 0.5) return "Variable";
  return "Highly Variable";
}

interface InstrumentRiskConsistency {
  symbol: string;
  cv: number;
  medianLot: number;
  low: number;
  high: number;
  bandPercentage: number;
  count: number;
}

// A coefficient of variation only means something when every value shares
// the same unit — a 0.10 lot on XAUUSD and a 2.00 lot on NDX100 are not
// comparable sizes, so this never pools raw lot sizes across instruments.
// Each instrument gets its own distribution and needs its own
// MIN_TRADES_FOR_LOT_ANALYSIS-trade floor before it can contribute.
function computeInstrumentRiskConsistencies(trades: Trade[]): InstrumentRiskConsistency[] {
  const bySymbol = new Map<string, number[]>();
  for (const t of trades) {
    if (!t.symbol || t.quantity <= 0) continue;
    const lots = bySymbol.get(t.symbol) ?? [];
    lots.push(t.quantity);
    bySymbol.set(t.symbol, lots);
  }

  const results: InstrumentRiskConsistency[] = [];
  for (const [symbol, lots] of bySymbol) {
    if (lots.length < MIN_TRADES_FOR_LOT_ANALYSIS) continue;
    const avg = mean(lots);
    const med = median(lots);
    const sd = stdDev(lots);
    const low = Math.max(0, med - sd);
    const high = med + sd;
    const withinBand = lots.filter((l) => l >= low && l <= high).length;
    results.push({
      symbol,
      cv: avg > 0 ? sd / avg : 0,
      medianLot: med,
      low,
      high,
      bandPercentage: Math.round((withinBand / lots.length) * 100),
      count: lots.length,
    });
  }
  return results;
}

function computeRiskConsistency(trades: Trade[]): RiskInsight {
  const perInstrument = computeInstrumentRiskConsistencies(trades);
  if (perInstrument.length === 0) return notEnoughDataInsight(RISK_CONSISTENCY_LABEL);

  // Combine each instrument's independently-computed CV via a trade-count-
  // weighted average — the weighting happens on the already-computed
  // per-instrument scores, never on the raw lot sizes themselves.
  const totalCount = perInstrument.reduce((s, p) => s + p.count, 0);
  const weightedCv = perInstrument.reduce((s, p) => s + p.cv * p.count, 0) / totalCount;
  const primary = [...perInstrument].sort((a, b) => b.count - a.count)[0];

  const metricLabel =
    perInstrument.length === 1
      ? `${formatLot(primary.medianLot)} median`
      : `${formatLot(primary.medianLot)} median on ${primary.symbol} (${perInstrument.length} instruments)`;

  const narrative =
    perInstrument.length === 1
      ? `${primary.bandPercentage}% of your ${primary.symbol} trades are executed between ${primary.low.toFixed(2)} and ${primary.high.toFixed(2)} lots.`
      : `Calculated independently per instrument (${perInstrument.map((p) => p.symbol).join(", ")}) and combined by trade count — sizing on one instrument is never compared to another.`;

  return {
    label: RISK_CONSISTENCY_LABEL,
    value: classifyRiskConsistency(weightedCv),
    metricLabel,
    narrative,
    sampleSize: totalCount,
  };
}

// ── 2. Average Position Size Per Instrument ──────────────────────────────
// Same "top N most-traded instruments" convention traderIdentity.ts's
// Market Focus uses (duplicated here, not imported, per this file's
// self-contained design) — average lot size only for the instruments a
// trader actually trades often, not a long tail of one-off symbols.

function getTopInstrumentAverageLots(trades: Trade[]): InstrumentLotSize[] {
  const withLots = trades.filter((t) => t.symbol && t.quantity > 0);
  const groups = new Map<string, { sum: number; count: number }>();
  for (const t of withLots) {
    const g = groups.get(t.symbol) ?? { sum: 0, count: 0 };
    g.sum += t.quantity;
    g.count += 1;
    groups.set(t.symbol, g);
  }

  return Array.from(groups.entries())
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, TOP_INSTRUMENT_COUNT)
    .map(([symbol, { sum, count }]) => ({ symbol, averageLot: formatLot(sum / count) }));
}

// ── 3 & 4. Position Size After Wins / After Losses ───────────────────────
// For every trade matching the target outcome (win or loss), compare its
// own lot size ("before") to the very next trade's lot size ("after") — a
// reaction pattern, not a ranking, so it's never gated by
// MIN_GROUP_SAMPLE_SIZE's expectancy logic, just a plain mean-before vs
// mean-after comparison. Chronology is tracked independently PER
// INSTRUMENT: comparing a 0.10 lot XAUUSD trade to the next trade's 2.00
// lots on NDX100 isn't a size change, it's two different instruments'
// normal sizes, so "before"/"after" pairs only ever come from consecutive
// trades on the same symbol.

interface SizeShift {
  before: number;
  after: number;
  count: number;
}

function computeSizeShiftAfterOutcome(sorted: Trade[], isOutcome: (t: Trade) => boolean): SizeShift | null {
  const bySymbol = new Map<string, Trade[]>();
  for (const t of sorted) {
    if (!t.symbol) continue;
    const arr = bySymbol.get(t.symbol) ?? [];
    arr.push(t);
    bySymbol.set(t.symbol, arr);
  }

  // Each instrument's own before/after pairs are reduced to a single
  // relative change (e.g. "+18%") before being combined — the aggregate
  // below is a trade-count-weighted average of those independent relative
  // changes, never a mix of raw lot numbers from different instruments.
  const perInstrument: { relativeChange: number; count: number }[] = [];
  for (const symbolTrades of bySymbol.values()) {
    const beforeLots: number[] = [];
    const afterLots: number[] = [];
    for (let i = 0; i < symbolTrades.length - 1; i++) {
      const current = symbolTrades[i];
      const next = symbolTrades[i + 1];
      if (current.quantity > 0 && next.quantity > 0 && isOutcome(current)) {
        beforeLots.push(current.quantity);
        afterLots.push(next.quantity);
      }
    }
    if (beforeLots.length < MIN_GROUP_SAMPLE_SIZE) continue;
    const beforeAvg = mean(beforeLots);
    const afterAvg = mean(afterLots);
    const relativeChange = beforeAvg > 0 ? (afterAvg - beforeAvg) / beforeAvg : 0;
    perInstrument.push({ relativeChange, count: beforeLots.length });
  }

  if (perInstrument.length === 0) return null;

  const totalCount = perInstrument.reduce((s, p) => s + p.count, 0);
  const weightedRelativeChange =
    perInstrument.reduce((s, p) => s + p.relativeChange * p.count, 0) / totalCount;

  // Normalized to a 1 → 1+change pair so classifySizeShift()/
  // formatSizeShiftPercent() (which only ever read the relative change
  // between before/after) reproduce the exact weighted percentage without
  // needing their own instrument-aware logic.
  return { before: 1, after: 1 + weightedRelativeChange, count: totalCount };
}

function classifySizeShift(shift: SizeShift): string {
  if (shift.before <= 0) return "Stable";
  const change = (shift.after - shift.before) / shift.before;
  if (change >= SIZE_SHIFT_THRESHOLD) return "Increasing Risk";
  if (change <= -SIZE_SHIFT_THRESHOLD) return "Reducing Risk";
  return "Stable";
}

const POSITION_SIZE_AFTER_WINS_LABEL = "Position Size After Wins";
const POSITION_SIZE_AFTER_LOSSES_LABEL = "Position Size After Losses";

const AFTER_WIN_NARRATIVE: Record<string, string> = {
  "Increasing Risk": "You usually increase your position size after winning trades.",
  Stable: "You maintain consistent risk after winning trades.",
  "Reducing Risk": "You tend to reduce your position size after winning trades.",
};

const AFTER_LOSS_NARRATIVE: Record<string, string> = {
  "Increasing Risk": "You frequently increase your position size after a losing trade.",
  Stable: "You maintain consistent risk after losing trades.",
  "Reducing Risk": "You tend to reduce your position size after a losing trade.",
};

// The percentage change in lot size (e.g. "+34%"/"-18%") this returns is
// the one metric the simplified Risk Management card shows for Position
// Size After Loss — Trader DNA V4.
function formatSizeShiftPercent(shift: SizeShift): string {
  const pct = shift.before > 0 ? Math.round(((shift.after - shift.before) / shift.before) * 100) : 0;
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

function buildSizeShiftInsight(label: string, shift: SizeShift | null, narrativeMap: Record<string, string>): RiskInsight {
  if (shift === null) return notEnoughDataInsight(label);
  const classification = classifySizeShift(shift);
  return {
    label,
    value: classification,
    metricLabel: formatSizeShiftPercent(shift),
    narrative: narrativeMap[classification],
    sampleSize: shift.count,
  };
}

// ── 5. Lot Size Sweet Spot ────────────────────────────────────────────────
// For each of the same top-traded instruments as Average Position Size,
// group that instrument's trades by lot size and find the size with the
// highest expectancy. Lot sizes are rounded to 2 decimals only to collapse
// floating-point noise (e.g. 0.20000000000000004) — every distinct size a
// trader actually used stays its own bucket, never merged with a
// neighboring size, so this stays a historical lookup, not a smoothed
// optimizer. A bucket needs MIN_GROUP_SAMPLE_SIZE trades before it can win,
// same floor as Your Edge/Blind Spots' expectancy rankings.

interface LotExpectancy {
  symbol: string;
  lot: number;
  expectancy: number;
  count: number;
}

function roundLot(quantity: number): number {
  return Math.round(quantity * 100) / 100;
}

function findLotSweetSpot(trades: Trade[], symbol: string): LotExpectancy | null {
  const symbolTrades = trades.filter((t) => t.symbol === symbol && t.quantity > 0);
  const groups = new Map<number, { sum: number; count: number }>();
  for (const t of symbolTrades) {
    const lot = roundLot(t.quantity);
    const g = groups.get(lot) ?? { sum: 0, count: 0 };
    g.sum += t.pnl;
    g.count += 1;
    groups.set(lot, g);
  }

  let best: LotExpectancy | null = null;
  for (const [lot, { sum, count }] of groups) {
    if (count < MIN_GROUP_SAMPLE_SIZE) continue;
    const expectancy = sum / count;
    if (best === null || expectancy > best.expectancy) {
      best = { symbol, lot, expectancy, count };
    }
  }
  return best;
}

function getLotSizeSweetSpots(trades: Trade[], instruments: InstrumentLotSize[]): LotExpectancy[] {
  const results: LotExpectancy[] = [];
  for (const { symbol } of instruments) {
    const best = findLotSweetSpot(trades, symbol);
    if (best) results.push(best);
  }
  return results;
}

// ── 6. Executive Summary ─────────────────────────────────────────────────
// A single deterministic paragraph stitched from Risk Consistency,
// Position Size After Losses, and the strongest Lot Size Sweet Spot — no
// data this engine hasn't already computed.

function summaryOpener(riskConsistency: RiskInsight): string | null {
  switch (riskConsistency.value) {
    case "Highly Consistent":
    case "Consistent":
      return "Your overall risk management is disciplined.";
    case "Variable":
      return "Your overall risk management is inconsistent.";
    case "Highly Variable":
      return "Your overall risk management is highly inconsistent.";
    default:
      return null;
  }
}

function summaryMiddle(riskConsistency: RiskInsight, afterLosses: RiskInsight): string {
  const consistencyKnown = riskConsistency.value !== NOT_ENOUGH_DATA;
  const afterLossKnown = afterLosses.value !== NOT_ENOUGH_DATA;

  const consistencyClause =
    riskConsistency.value === "Highly Consistent" || riskConsistency.value === "Consistent"
      ? "You generally maintain consistent position sizing"
      : "Your position sizing varies noticeably from trade to trade";

  const lossClause =
    afterLosses.value === "Increasing Risk"
      ? "although you tend to increase risk after losing trades"
      : afterLosses.value === "Reducing Risk"
        ? "and you actively reduce risk after losing trades"
        : "and you keep your risk steady after losing trades";

  if (consistencyKnown && afterLossKnown) return `${consistencyClause}, ${lossClause}.`;
  if (consistencyKnown) return `${consistencyClause}.`;
  if (afterLossKnown) return `${lossClause.charAt(0).toUpperCase()}${lossClause.slice(1)}.`;
  return "";
}

// Referencing the Loss Discipline Score (rather than the Lot Size Sweet
// Spot, which V4 no longer surfaces) keeps this summary consistent with
// what the simplified card actually shows.
function summaryClosing(lossDisciplineScore: RiskInsight): string {
  if (lossDisciplineScore.value === NOT_ENOUGH_DATA) return "";
  return `Your loss discipline score is ${lossDisciplineScore.value.toLowerCase()} at ${lossDisciplineScore.metricLabel}.`;
}

function buildExecutiveSummary(riskConsistency: RiskInsight, afterLosses: RiskInsight, lossDisciplineScore: RiskInsight): string {
  const opener = summaryOpener(riskConsistency);
  const middle = summaryMiddle(riskConsistency, afterLosses);
  const closing = summaryClosing(lossDisciplineScore);

  if (!opener && !middle && !closing) {
    return "Not enough trade history yet to assess your risk management.";
  }
  return [opener, middle, closing].filter(Boolean).join(" ");
}

// ============================================================
// Loss Psychology (Trader DNA V3)
// ============================================================
// Answers one question: "How do I behave immediately after losing or
// winning?" — this is the one place in Trader DNA that looks directly at
// emotional/behavioral reactions to an outcome, still purely from
// historical trades (no AI, no inference beyond arithmetic on pnl,
// quantity, and timestamps already on Trade). Reuses this file's own
// mean()/sortChronologically()/formatExpectancy() and the
// computeSizeShiftAfterOutcome()/classifySizeShift() pair already built
// for Position Size After Wins/Losses — Revenge Trading Score treats that
// existing classification as one of its three inputs rather than
// recomputing position-size behavior a second way.

// Every insight below shares the same "not a coincidence" floor as the
// rest of this file's expectancy-based groupings.
const LOSS_PSYCHOLOGY_MIN_SAMPLE = MIN_GROUP_SAMPLE_SIZE;

// ── 7 & 8. Performance After Loss / After Win ────────────────────────────
// For every trade matching the trigger outcome, take the very next trade's
// pnl. "Expectancy" and "Average PnL" are the same figure for this
// subset (mean pnl) — Win Rate is computed too, but only feeds the
// Revenge Trading Score below rather than getting its own display row,
// since neither example in the spec shows it as a headline value.

interface NextTradeOutcomes {
  pnls: number[];
  winRate: number;
}

function getNextTradeOutcomes(sorted: Trade[], isTrigger: (t: Trade) => boolean): NextTradeOutcomes {
  const pnls: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (isTrigger(sorted[i])) pnls.push(sorted[i + 1].pnl);
  }
  const wins = pnls.filter((p) => p > 0).length;
  return { pnls, winRate: pnls.length > 0 ? wins / pnls.length : 0 };
}

const PERFORMANCE_AFTER_LOSS_LABEL = "Performance After Loss";
const PERFORMANCE_AFTER_WIN_LABEL = "Performance After Win";

// After a loss, "recovery" is judged on absolute sign: did the very next
// trade land back in profit, or compound the loss? A relative comparison
// to the trader's own baseline isn't used here — recovering into profit
// is recovering, regardless of how strong the trader's normal edge is.
function classifyAfterLoss(avgPnl: number): string {
  if (avgPnl > 0) return "Positive Recovery";
  if (avgPnl < 0) return "Negative Recovery";
  return "Neutral";
}

// After a win, "improving/declining" is inherently relative — it's only
// meaningful compared against how the trader performs on average, not
// against zero (a trader with a strong baseline could post a positive
// pnl after a win and still be declining from their normal level).
const PERFORMANCE_SHIFT_THRESHOLD = SIZE_SHIFT_THRESHOLD;

function classifyAfterWin(avgPnl: number, overallExpectancy: number): string {
  const scale = Math.max(Math.abs(overallExpectancy), 1);
  const diff = avgPnl - overallExpectancy;
  if (diff >= scale * PERFORMANCE_SHIFT_THRESHOLD) return "Improving";
  if (diff <= -scale * PERFORMANCE_SHIFT_THRESHOLD) return "Declining";
  return "Stable";
}

const AFTER_LOSS_PERFORMANCE_NARRATIVE: Record<string, string> = {
  "Positive Recovery": "You generally bounce back with a profitable trade immediately after a loss.",
  Neutral: "Your performance immediately after a losing trade is roughly break-even.",
  "Negative Recovery": "You generally underperform immediately after a losing trade.",
};

const AFTER_WIN_PERFORMANCE_NARRATIVE: Record<string, string> = {
  Improving: "You tend to build on momentum and perform even better after a winning trade.",
  Stable: "You usually maintain strong execution after winning.",
  Declining: "Your execution tends to drop off immediately after a winning trade.",
};

function buildPerformanceAfterLoss(outcomes: NextTradeOutcomes): RiskInsight {
  if (outcomes.pnls.length < LOSS_PSYCHOLOGY_MIN_SAMPLE) return notEnoughDataInsight(PERFORMANCE_AFTER_LOSS_LABEL);
  const avgPnl = mean(outcomes.pnls);
  const classification = classifyAfterLoss(avgPnl);
  return {
    label: PERFORMANCE_AFTER_LOSS_LABEL,
    value: classification,
    metricLabel: formatPnlPerTrade(avgPnl),
    narrative: AFTER_LOSS_PERFORMANCE_NARRATIVE[classification],
    sampleSize: outcomes.pnls.length,
  };
}

function buildPerformanceAfterWin(outcomes: NextTradeOutcomes, overallExpectancy: number): RiskInsight {
  if (outcomes.pnls.length < LOSS_PSYCHOLOGY_MIN_SAMPLE) return notEnoughDataInsight(PERFORMANCE_AFTER_WIN_LABEL);
  const avgPnl = mean(outcomes.pnls);
  const classification = classifyAfterWin(avgPnl, overallExpectancy);
  return {
    label: PERFORMANCE_AFTER_WIN_LABEL,
    value: classification,
    metricLabel: formatPnlPerTrade(avgPnl),
    narrative: AFTER_WIN_PERFORMANCE_NARRATIVE[classification],
    sampleSize: outcomes.pnls.length,
  };
}

// ── 9. Revenge Trading Risk ───────────────────────────────────────────────
// Compares average re-entry delay after a loss to average re-entry delay
// after a win. A much shorter delay after losing (re-entering fast to
// "win it back") is the classic revenge-trading tell.

const REVENGE_RISK_LABEL = "Revenge Trading Risk";
const REVENGE_HIGH_RATIO = 0.5; // after-loss delay at or under half the after-win delay
const REVENGE_MODERATE_RATIO = 0.75;

function classifyRevengeRisk(afterLossDelay: number, afterWinDelay: number): string {
  if (afterWinDelay <= 0) return "Low";
  const ratio = afterLossDelay / afterWinDelay;
  if (ratio <= REVENGE_HIGH_RATIO) return "High";
  if (ratio <= REVENGE_MODERATE_RATIO) return "Moderate";
  return "Low";
}

const REVENGE_RISK_NARRATIVE: Record<string, string> = {
  High: "You tend to re-enter the market much faster after losing.",
  Moderate: "You re-enter the market somewhat faster after losing trades.",
  Low: "Your re-entry timing is similar whether you just won or lost.",
};

function getReentryDelays(sorted: Trade[], isTrigger: (t: Trade) => boolean): number[] {
  const delays: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (!isTrigger(sorted[i])) continue;
    const delay = getReentryMinutes(sorted[i], sorted[i + 1]);
    if (delay !== null) delays.push(delay);
  }
  return delays;
}

function buildRevengeTradingRisk(afterLossDelays: number[], afterWinDelays: number[]): RiskInsight {
  if (afterLossDelays.length < LOSS_PSYCHOLOGY_MIN_SAMPLE || afterWinDelays.length < LOSS_PSYCHOLOGY_MIN_SAMPLE) {
    return notEnoughDataInsight(REVENGE_RISK_LABEL);
  }
  const afterLossDelay = mean(afterLossDelays);
  const afterWinDelay = mean(afterWinDelays);
  const classification = classifyRevengeRisk(afterLossDelay, afterWinDelay);
  return {
    label: REVENGE_RISK_LABEL,
    value: classification,
    metricLabel: `${formatMinutes(afterLossDelay)} after loss vs ${formatMinutes(afterWinDelay)} after win`,
    narrative: REVENGE_RISK_NARRATIVE[classification],
    sampleSize: Math.min(afterLossDelays.length, afterWinDelays.length),
  };
}

// ── 10. Recovery Rate ─────────────────────────────────────────────────────
// For every losing trade with at least 3 trades after it, checks whether
// those 3 trades' combined pnl fully offsets the loss's magnitude.

const RECOVERY_RATE_LABEL = "Recovery Rate";
const RECOVERY_WINDOW = 3;

function buildRecoveryRate(sorted: Trade[]): RiskInsight {
  let evaluable = 0;
  let recovered = 0;

  for (let i = 0; i < sorted.length; i++) {
    const loss = sorted[i];
    if (loss.pnl >= 0) continue;

    const nextThree = sorted.slice(i + 1, i + 1 + RECOVERY_WINDOW);
    if (nextThree.length < RECOVERY_WINDOW) continue;

    evaluable += 1;
    const recoveredAmount = nextThree.reduce((sum, t) => sum + t.pnl, 0);
    if (recoveredAmount >= Math.abs(loss.pnl)) recovered += 1;
  }

  if (evaluable < LOSS_PSYCHOLOGY_MIN_SAMPLE) return notEnoughDataInsight(RECOVERY_RATE_LABEL);

  const rate = Math.round((recovered / evaluable) * 100);
  return {
    label: RECOVERY_RATE_LABEL,
    value: `${rate}%`,
    metricLabel: `${recovered} of ${evaluable} losses recovered`,
    narrative: `You recover your losses within three trades in ${rate}% of cases.`,
    sampleSize: evaluable,
  };
}

// ── 11. Revenge Trading Score ─────────────────────────────────────────────
// A composite of three signals this file has already computed elsewhere:
// position-size increase after a loss (positionSizeAfterLosses), reduced
// re-entry delay after a loss (revengeTradingRisk), and weaker performance
// after a loss (performanceAfterLoss). Each contributes 0-2 points toward
// a 0-6 total, which maps to a single overall label.

const REVENGE_SCORE_LABEL = "Revenge Trading Score";

function scoreRevengeSignals(
  positionSizeAfterLosses: RiskInsight,
  revengeTradingRisk: RiskInsight,
  performanceAfterLoss: RiskInsight
): number {
  let points = 0;
  if (positionSizeAfterLosses.value === "Increasing Risk") points += 2;

  if (revengeTradingRisk.value === "High") points += 2;
  else if (revengeTradingRisk.value === "Moderate") points += 1;

  if (performanceAfterLoss.value === "Negative Recovery") points += 2;
  else if (performanceAfterLoss.value === "Neutral") points += 1;

  return points;
}

function classifyRevengeScore(points: number): string {
  if (points <= 0) return "Excellent";
  if (points <= 1) return "Good";
  if (points <= 3) return "Moderate";
  if (points <= 4) return "Poor";
  return "High Risk";
}

const REVENGE_SCORE_NARRATIVE: Record<string, string> = {
  Excellent: "You stay composed after losses, with no signs of revenge trading.",
  Good: "You mostly maintain discipline after losses, with only minor behavioural shifts.",
  Moderate: "You show some emotional trading tendencies after losses.",
  Poor: "You often show emotional trading tendencies after losses.",
  "High Risk": "You frequently increase risk and re-enter quickly after losses, leading to weaker performance.",
};

function buildRevengeTradingScore(
  positionSizeAfterLosses: RiskInsight,
  revengeTradingRisk: RiskInsight,
  performanceAfterLoss: RiskInsight
): RiskInsight {
  if (
    positionSizeAfterLosses.value === NOT_ENOUGH_DATA ||
    revengeTradingRisk.value === NOT_ENOUGH_DATA ||
    performanceAfterLoss.value === NOT_ENOUGH_DATA
  ) {
    return notEnoughDataInsight(REVENGE_SCORE_LABEL);
  }

  const points = scoreRevengeSignals(positionSizeAfterLosses, revengeTradingRisk, performanceAfterLoss);
  const classification = classifyRevengeScore(points);
  return {
    label: REVENGE_SCORE_LABEL,
    value: classification,
    metricLabel: `${points}/6 risk signals detected`,
    narrative: REVENGE_SCORE_NARRATIVE[classification],
    sampleSize: Math.min(
      positionSizeAfterLosses.sampleSize,
      revengeTradingRisk.sampleSize,
      performanceAfterLoss.sampleSize
    ),
  };
}

// ── 12. Loss Discipline Score (Trader DNA V4) ─────────────────────────────
// The single number the simplified Risk Management card shows for "how
// disciplined am I after a loss?" — a 0-100 composite averaging four
// sub-scores from insights this file already computed: Recovery Rate
// (parsed straight from its own "NN%" value), Revenge Trading Risk,
// Performance After Loss, and Position Size After Loss. Any sub-score
// whose source insight is NOT_ENOUGH_DATA is simply left out of the
// average rather than forced to a default — a trader missing only the
// Revenge Trading Risk sample still gets a score from the other three.
// Future behavioural metrics (drawdown behavior, fatigue/overtrading
// indicators, etc. — see the "Hidden Metrics" list this ticket keeps
// alive elsewhere in Trader DNA) can be folded in the same way later.

const LOSS_DISCIPLINE_SCORE_LABEL = "Loss Discipline Score";

function parseRecoveryRatePercent(recoveryRate: RiskInsight): number | null {
  const match = recoveryRate.value.match(/^(\d+)%$/);
  return match ? Number(match[1]) : null;
}

function revengeRiskSubScore(revengeTradingRisk: RiskInsight): number | null {
  switch (revengeTradingRisk.value) {
    case "Low":
      return 100;
    case "Moderate":
      return 50;
    case "High":
      return 0;
    default:
      return null;
  }
}

function performanceAfterLossSubScore(performanceAfterLoss: RiskInsight): number | null {
  switch (performanceAfterLoss.value) {
    case "Positive Recovery":
      return 100;
    case "Neutral":
      return 50;
    case "Negative Recovery":
      return 0;
    default:
      return null;
  }
}

function positionSizeAfterLossSubScore(positionSizeAfterLosses: RiskInsight): number | null {
  switch (positionSizeAfterLosses.value) {
    case "Reducing Risk":
      return 100;
    case "Stable":
      return 75;
    case "Increasing Risk":
      return 0;
    default:
      return null;
  }
}

function classifyLossDisciplineScore(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Average";
  return "Needs Attention";
}

const LOSS_DISCIPLINE_SCORE_NARRATIVE: Record<string, string> = {
  Excellent: "Your discipline after losing trades is excellent, with no signs of harmful behavioural patterns.",
  Good: "You generally handle losses well, with only minor behavioural drift.",
  Average: "Your behaviour after losses is mixed — some patterns could use attention.",
  "Needs Attention": "Your behaviour after losses shows clear room for improvement.",
};

function buildLossDisciplineScore(
  recoveryRate: RiskInsight,
  revengeTradingRisk: RiskInsight,
  performanceAfterLoss: RiskInsight,
  positionSizeAfterLosses: RiskInsight
): RiskInsight {
  const components = [
    { score: parseRecoveryRatePercent(recoveryRate), sampleSize: recoveryRate.sampleSize },
    { score: revengeRiskSubScore(revengeTradingRisk), sampleSize: revengeTradingRisk.sampleSize },
    { score: performanceAfterLossSubScore(performanceAfterLoss), sampleSize: performanceAfterLoss.sampleSize },
    { score: positionSizeAfterLossSubScore(positionSizeAfterLosses), sampleSize: positionSizeAfterLosses.sampleSize },
  ].filter((c): c is { score: number; sampleSize: number } => c.score !== null);

  if (components.length === 0) return notEnoughDataInsight(LOSS_DISCIPLINE_SCORE_LABEL);

  const score = Math.round(mean(components.map((c) => c.score)));
  const classification = classifyLossDisciplineScore(score);
  return {
    label: LOSS_DISCIPLINE_SCORE_LABEL,
    value: classification,
    metricLabel: `${score}/100`,
    narrative: LOSS_DISCIPLINE_SCORE_NARRATIVE[classification],
    sampleSize: Math.min(...components.map((c) => c.sampleSize)),
  };
}

// ── 13. Loss Psychology Executive Summary ────────────────────────────────
// A second, dedicated summary (separate from Risk Management's own) built
// only from this section's own insights and the existing lossShift
// (before/after lot size around a loss) already computed for Position
// Size After Losses.

function buildLossPsychologySummary(
  performanceAfterWin: RiskInsight,
  positionSizeAfterLosses: RiskInsight,
  lossShift: SizeShift | null,
  revengeTradingRisk: RiskInsight,
  revengeTradingScore: RiskInsight
): string {
  if (performanceAfterWin.value === NOT_ENOUGH_DATA && revengeTradingScore.value === NOT_ENOUGH_DATA) {
    return "Not enough trade history yet to assess your behaviour around wins and losses.";
  }

  const winClause =
    performanceAfterWin.value === NOT_ENOUGH_DATA
      ? "Your win-side sample is still limited"
      : performanceAfterWin.value === "Declining"
        ? "Your execution quality drops even after winning trades"
        : "You remain disciplined after winning trades";

  const behaviorChangesAfterLoss =
    revengeTradingScore.value === "High Risk" ||
    revengeTradingScore.value === "Poor" ||
    positionSizeAfterLosses.value === "Increasing Risk";

  const lossClause = behaviorChangesAfterLoss
    ? "but your behaviour changes noticeably after losses"
    : "and your behaviour remains just as disciplined after losses";

  const sentences: string[] = [`${winClause}, ${lossClause}.`];

  const detailParts: string[] = [];
  if (lossShift && lossShift.before > 0) {
    const pctChange = Math.round(((lossShift.after - lossShift.before) / lossShift.before) * 100);
    if (Math.abs(pctChange) >= 1) {
      detailParts.push(`Position sizing ${pctChange > 0 ? "increases" : "decreases"} by ${Math.abs(pctChange)}%`);
    }
  }
  if (revengeTradingRisk.value === "High") detailParts.push("re-entry time decreases significantly");
  else if (revengeTradingRisk.value === "Moderate") detailParts.push("re-entry time decreases moderately");

  if (detailParts.length > 0) sentences.push(`${detailParts.join(" and ")}.`);

  return sentences.join(" ");
}

// ── TraderDiscipline ("Risk Management") ─────────────────────────────────

export interface TraderDiscipline {
  // Surfaced on the card (Trader DNA V4 simplification).
  riskConsistency: RiskInsight;
  positionSizeAfterLosses: RiskInsight;
  lossDisciplineScore: RiskInsight;
  executiveSummary: string;
  // Kept for the AI Coach — no longer shown on the card, but still
  // computed on every call.
  averagePositionSize: InstrumentLotSize[];
  averagePositionSizeNarrative: string;
  positionSizeAfterWins: RiskInsight;
  lotSizeSweetSpot: InstrumentSweetSpot[];
  performanceAfterLoss: RiskInsight;
  performanceAfterWin: RiskInsight;
  revengeTradingRisk: RiskInsight;
  recoveryRate: RiskInsight;
  revengeTradingScore: RiskInsight;
  lossPsychologySummary: string;
  metadata: TraderDisciplineMetadata;
}

export function getTraderDiscipline(trades: Trade[]): TraderDiscipline {
  const valid = trades.filter((t) => !!t.entryDate);
  const sorted = sortChronologically(valid);
  const sampleSize = sorted.length;

  const tradingDays = new Set(sorted.map((t) => t.entryDate)).size;
  const firstTrade = sampleSize > 0 ? sorted[0].entryDate : null;
  const lastTrade = sampleSize > 0 ? sorted[sampleSize - 1].entryDate : null;

  const riskConsistency = computeRiskConsistency(sorted);

  const topInstruments = getTopInstrumentAverageLots(sorted);

  const winShift = computeSizeShiftAfterOutcome(sorted, (t) => t.pnl > 0);
  const lossShift = computeSizeShiftAfterOutcome(sorted, (t) => t.pnl < 0);
  const positionSizeAfterWins = buildSizeShiftInsight(POSITION_SIZE_AFTER_WINS_LABEL, winShift, AFTER_WIN_NARRATIVE);
  const positionSizeAfterLosses = buildSizeShiftInsight(
    POSITION_SIZE_AFTER_LOSSES_LABEL,
    lossShift,
    AFTER_LOSS_NARRATIVE
  );

  const sweetSpots = getLotSizeSweetSpots(sorted, topInstruments);
  const lotSizeSweetSpot: InstrumentSweetSpot[] = sweetSpots.map((s) => ({
    symbol: s.symbol,
    lot: formatLot(s.lot),
    metricLabel: formatExpectancy(s.expectancy),
    narrative: `Your strongest statistical performance on ${s.symbol} currently occurs around ${s.lot.toFixed(2)} lot.`,
  }));

  // ── Loss Psychology (Trader DNA V3) ──
  const overallExpectancy = mean(sorted.map((t) => t.pnl));

  const afterLossOutcomes = getNextTradeOutcomes(sorted, (t) => t.pnl < 0);
  const performanceAfterLoss = buildPerformanceAfterLoss(afterLossOutcomes);

  const afterWinOutcomes = getNextTradeOutcomes(sorted, (t) => t.pnl > 0);
  const performanceAfterWin = buildPerformanceAfterWin(afterWinOutcomes, overallExpectancy);

  const afterLossDelays = getReentryDelays(sorted, (t) => t.pnl < 0);
  const afterWinDelays = getReentryDelays(sorted, (t) => t.pnl > 0);
  const revengeTradingRisk = buildRevengeTradingRisk(afterLossDelays, afterWinDelays);

  const recoveryRate = buildRecoveryRate(sorted);

  const revengeTradingScore = buildRevengeTradingScore(positionSizeAfterLosses, revengeTradingRisk, performanceAfterLoss);

  const lossDisciplineScore = buildLossDisciplineScore(
    recoveryRate,
    revengeTradingRisk,
    performanceAfterLoss,
    positionSizeAfterLosses
  );

  const lossPsychologySummary = buildLossPsychologySummary(
    performanceAfterWin,
    positionSizeAfterLosses,
    lossShift,
    revengeTradingRisk,
    revengeTradingScore
  );

  return {
    riskConsistency,
    positionSizeAfterLosses,
    lossDisciplineScore,
    executiveSummary: buildExecutiveSummary(riskConsistency, positionSizeAfterLosses, lossDisciplineScore),
    averagePositionSize: topInstruments,
    averagePositionSizeNarrative:
      topInstruments.length > 0
        ? "This is your typical position size for each market."
        : "Not enough trade history yet to measure typical position size.",
    positionSizeAfterWins,
    lotSizeSweetSpot,
    performanceAfterLoss,
    performanceAfterWin,
    revengeTradingRisk,
    recoveryRate,
    revengeTradingScore,
    lossPsychologySummary,
    metadata: {
      sampleSize,
      tradingDays,
      firstTrade,
      lastTrade,
    },
  };
}
