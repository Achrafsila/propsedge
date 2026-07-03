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

function computeRiskConsistency(lots: number[]): RiskInsight {
  if (lots.length < MIN_TRADES_FOR_LOT_ANALYSIS) return notEnoughDataInsight(RISK_CONSISTENCY_LABEL);

  const avg = mean(lots);
  const med = median(lots);
  const sd = stdDev(lots);
  const cv = avg > 0 ? sd / avg : 0;

  // "Typical band": the range within one standard deviation of the median
  // lot size, and what share of trades actually falls inside it — this is
  // what the narrative reports, not the raw stdDev number.
  const low = Math.max(0, med - sd);
  const high = med + sd;
  const withinBand = lots.filter((l) => l >= low && l <= high).length;
  const bandPercentage = Math.round((withinBand / lots.length) * 100);

  return {
    label: RISK_CONSISTENCY_LABEL,
    value: classifyRiskConsistency(cv),
    metricLabel: `${formatLot(med)} median`,
    narrative: `${bandPercentage}% of your trades are executed between ${low.toFixed(2)} and ${high.toFixed(2)} lots.`,
    sampleSize: lots.length,
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
// Chronologically, for every trade matching the target outcome (win or
// loss), compare its own lot size ("before") to the very next trade's lot
// size ("after") — this is a reaction pattern, not a ranking, so it's
// never gated by MIN_GROUP_SAMPLE_SIZE's expectancy logic, just a plain
// mean-before vs mean-after comparison.

interface SizeShift {
  before: number;
  after: number;
  count: number;
}

function computeSizeShiftAfterOutcome(sorted: Trade[], isOutcome: (t: Trade) => boolean): SizeShift | null {
  const beforeLots: number[] = [];
  const afterLots: number[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (current.quantity > 0 && next.quantity > 0 && isOutcome(current)) {
      beforeLots.push(current.quantity);
      afterLots.push(next.quantity);
    }
  }

  if (beforeLots.length < MIN_GROUP_SAMPLE_SIZE) return null;
  return { before: mean(beforeLots), after: mean(afterLots), count: beforeLots.length };
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

function buildSizeShiftInsight(label: string, shift: SizeShift | null, narrativeMap: Record<string, string>): RiskInsight {
  if (shift === null) return notEnoughDataInsight(label);
  const classification = classifySizeShift(shift);
  return {
    label,
    value: classification,
    metricLabel: `${formatLot(shift.before)} → ${formatLot(shift.after)}`,
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

function summaryClosing(sweetSpots: LotExpectancy[]): string {
  if (sweetSpots.length === 0) return "";
  const best = sweetSpots.reduce((a, b) => (b.expectancy > a.expectancy ? b : a));
  return `Your strongest statistical performance currently occurs around ${best.lot.toFixed(2)} lot on ${best.symbol}.`;
}

function buildExecutiveSummary(riskConsistency: RiskInsight, afterLosses: RiskInsight, sweetSpots: LotExpectancy[]): string {
  const opener = summaryOpener(riskConsistency);
  const middle = summaryMiddle(riskConsistency, afterLosses);
  const closing = summaryClosing(sweetSpots);

  if (!opener && !middle && !closing) {
    return "Not enough trade history yet to assess your risk management.";
  }
  return [opener, middle, closing].filter(Boolean).join(" ");
}

// ── TraderDiscipline ("Risk Management") ─────────────────────────────────

export interface TraderDiscipline {
  riskConsistency: RiskInsight;
  averagePositionSize: InstrumentLotSize[];
  averagePositionSizeNarrative: string;
  positionSizeAfterWins: RiskInsight;
  positionSizeAfterLosses: RiskInsight;
  lotSizeSweetSpot: InstrumentSweetSpot[];
  executiveSummary: string;
  metadata: TraderDisciplineMetadata;
}

export function getTraderDiscipline(trades: Trade[]): TraderDiscipline {
  const valid = trades.filter((t) => !!t.entryDate);
  const sorted = sortChronologically(valid);
  const sampleSize = sorted.length;

  const tradingDays = new Set(sorted.map((t) => t.entryDate)).size;
  const firstTrade = sampleSize > 0 ? sorted[0].entryDate : null;
  const lastTrade = sampleSize > 0 ? sorted[sampleSize - 1].entryDate : null;

  const lots = sorted.map((t) => t.quantity).filter((q) => q > 0);
  const riskConsistency = computeRiskConsistency(lots);

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

  return {
    riskConsistency,
    averagePositionSize: topInstruments,
    averagePositionSizeNarrative:
      topInstruments.length > 0
        ? "This is your typical position size for each market."
        : "Not enough trade history yet to measure typical position size.",
    positionSizeAfterWins,
    positionSizeAfterLosses,
    lotSizeSweetSpot,
    executiveSummary: buildExecutiveSummary(riskConsistency, positionSizeAfterLosses, sweetSpots),
    metadata: {
      sampleSize,
      tradingDays,
      firstTrade,
      lastTrade,
    },
  };
}
