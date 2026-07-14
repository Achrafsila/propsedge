import type { HistoryQuality } from "@/lib/market/types";
import { isCompleteCandle, type CompletedCandle } from "@/lib/market/engines/swingDetection";
import { Timeframe, TimeframeCandles } from "../types";

// ============================================================
// Edge Pulse — Supply & Demand Engine (deterministic)
// ============================================================
// Mechanical zone detection, not an ICT/SMC clone: a zone is simply "the
// last opposing-close candle immediately before a mechanically-confirmed
// impulsive break of recent structure." The break definition reuses
// marketPhase.ts's own already-documented expansion rule (range >=1.5x a
// trailing baseline median AND a close beyond the recent structural
// high/low) — generalized here to scan every candle in the series, not
// just the latest one, since a Supply/Demand map needs every zone still on
// the board, not only whether the most recent candle just expanded.
//
// State machine (strict order, one pass per zone):
//   Broken     — a later candle CLOSED beyond the zone's far boundary (permanent, excludes it from selection)
//   Mitigated  — not broken, but a later candle's CLOSE landed inside the zone
//   Tested     — not broken/mitigated, but a later candle's WICK touched the zone
//   Fresh      — none of the above
// "Nearest-only, per side, per timeframe" falls out of the selection rule
// itself (closest non-broken zone to current price) — never a separate cap.

const RECENT_WINDOW = 6; // same value as marketPhase.ts's RECENT_WINDOW — "prior structure" window a break must clear
const BASELINE_WINDOW = 12; // same value as marketPhase.ts's BASELINE_WINDOW — trailing median-range baseline
const MIN_COMPLETED_CANDLES = RECENT_WINDOW + BASELINE_WINDOW; // 18, same floor as marketPhase.ts
const EXPANSION_RANGE_RATIO_THRESHOLD = 1.5; // same value as marketPhase.ts's EXPANSION_RANGE_RATIO_THRESHOLD

export type ZoneSide = "supply" | "demand";
export type ZoneState = "fresh" | "tested" | "mitigated" | "broken";

export interface SupplyDemandZone {
  side: ZoneSide;
  low: number;
  high: number;
  formedDatetime: string;
  state: ZoneState;
  distance: number; // signed: currentPrice - nearest zone boundary; 0 if price is currently trading inside the zone
}

export interface SupplyDemandResult {
  symbol: string;
  timeframe: Timeframe;
  quality: HistoryQuality;
  nearestSupply: SupplyDemandZone | null;
  nearestDemand: SupplyDemandZone | null;
}

interface RawZone {
  side: ZoneSide;
  low: number;
  high: number;
  formedIndex: number; // index of the origin (opposing-close) candle in the chronological array
  formedDatetime: string;
  // Index of the breakout candle that CONFIRMED this zone. State tracking
  // (tested/mitigated/broken) starts strictly AFTER this index, never at
  // formedIndex+1 — the breakout candle's own wick routinely overlaps the
  // zone it just created (that's what "breaking away from the base" looks
  // like), and that overlap must never itself count as the zone being
  // "tested" the instant it's born.
  confirmedIndex: number;
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
function candleRange(c: CompletedCandle): number {
  return c.high - c.low;
}
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Scans the whole chronological series for impulsive break candles and
// returns the zone each one produces (or nothing, if no opposing-close
// origin candle exists before it).
function findRawZones(chrono: CompletedCandle[]): RawZone[] {
  const zones: RawZone[] = [];
  for (let i = MIN_COMPLETED_CANDLES; i < chrono.length; i++) {
    const baselineSlice = chrono.slice(i - RECENT_WINDOW - BASELINE_WINDOW, i - RECENT_WINDOW);
    const recentPriorSlice = chrono.slice(i - RECENT_WINDOW, i);
    const baselineMedianRange = median(baselineSlice.map(candleRange));
    const lastRangeRatio = baselineMedianRange > 0 ? candleRange(chrono[i]) / baselineMedianRange : 1;
    const rangeExpanded = lastRangeRatio >= EXPANSION_RANGE_RATIO_THRESHOLD;
    if (!rangeExpanded) continue;

    const priorStructureHigh = Math.max(...recentPriorSlice.map((c) => c.high));
    const priorStructureLow = Math.min(...recentPriorSlice.map((c) => c.low));
    const closedAbove = chrono[i].close > priorStructureHigh;
    const closedBelow = chrono[i].close < priorStructureLow;
    if (!closedAbove && !closedBelow) continue;

    // Walk backward from the candle immediately before the break for the
    // nearest opposing-close candle (down-close for a bullish break,
    // up-close for a bearish break) — its full [low, high] is the zone.
    // A bullish break wants the nearest preceding DOWN-close candle (its
    // base becomes the Demand zone); a bearish break wants the nearest
    // preceding UP-close candle (its base becomes the Supply zone). A flat
    // candle (close === open) is neither and is skipped over.
    const wantDownClose = closedAbove;
    let originIndex = -1;
    for (let j = i - 1; j >= 0; j--) {
      const isDownClose = chrono[j].close < chrono[j].open;
      const isUpClose = chrono[j].close > chrono[j].open;
      if (wantDownClose ? isDownClose : isUpClose) {
        originIndex = j;
        break;
      }
    }
    if (originIndex === -1) continue;

    const origin = chrono[originIndex];
    zones.push({
      side: closedAbove ? "demand" : "supply",
      low: origin.low,
      high: origin.high,
      formedIndex: originIndex,
      formedDatetime: origin.datetime,
      confirmedIndex: i,
    });
  }
  return zones;
}

function classifyState(chrono: CompletedCandle[], zone: RawZone): ZoneState {
  const isSupply = zone.side === "supply";
  const farBoundary = isSupply ? zone.high : zone.low; // invalidation boundary
  let state: ZoneState = "fresh";

  for (let k = zone.confirmedIndex + 1; k < chrono.length; k++) {
    const c = chrono[k];
    const closedBeyondFar = isSupply ? c.close > farBoundary : c.close < farBoundary;
    if (closedBeyondFar) return "broken"; // permanent — short-circuits immediately

    const closedInside = c.close >= zone.low && c.close <= zone.high;
    if (closedInside) {
      state = "mitigated";
      continue;
    }
    const wickTouched = c.low <= zone.high && c.high >= zone.low;
    if (wickTouched && state === "fresh") state = "tested";
  }
  return state;
}

function distanceFromZone(zone: RawZone, currentPrice: number): number {
  if (currentPrice > zone.high) return round(currentPrice - zone.high, 5);
  if (currentPrice < zone.low) return round(currentPrice - zone.low, 5);
  return 0; // price is currently trading inside the zone
}

function selectNearest(zones: RawZone[], chrono: CompletedCandle[], currentPrice: number): SupplyDemandZone | null {
  const candidates = zones
    .map((z) => ({ zone: z, state: classifyState(chrono, z) }))
    .filter((z) => z.state !== "broken");
  if (candidates.length === 0) return null;

  const best = candidates.reduce((a, b) => {
    const da = Math.abs(distanceFromZone(a.zone, currentPrice));
    const db = Math.abs(distanceFromZone(b.zone, currentPrice));
    if (da !== db) return da < db ? a : b;
    return a.zone.confirmedIndex > b.zone.confirmedIndex ? a : b; // tie-break: most recently confirmed
  });

  return {
    side: best.zone.side,
    low: best.zone.low,
    high: best.zone.high,
    formedDatetime: best.zone.formedDatetime,
    state: best.state,
    distance: distanceFromZone(best.zone, currentPrice),
  };
}

function unavailableResult(symbol: string, timeframe: Timeframe): SupplyDemandResult {
  return { symbol, timeframe, quality: "unavailable", nearestSupply: null, nearestDemand: null };
}

export function computeSupplyDemand(symbol: string, timeframeCandles: TimeframeCandles, currentPrice: number | null): SupplyDemandResult {
  const { timeframe, candles, quality } = timeframeCandles;
  if (quality === "unavailable" || candles.length === 0 || currentPrice === null) {
    return unavailableResult(symbol, timeframe);
  }

  const completed = candles.slice(1).filter(isCompleteCandle);
  if (completed.length < MIN_COMPLETED_CANDLES) {
    return unavailableResult(symbol, timeframe);
  }

  const chrono = [...completed].reverse();
  const zones = findRawZones(chrono);
  const supplyZones = zones.filter((z) => z.side === "supply");
  const demandZones = zones.filter((z) => z.side === "demand");

  return {
    symbol,
    timeframe,
    quality,
    nearestSupply: selectNearest(supplyZones, chrono, currentPrice),
    nearestDemand: selectNearest(demandZones, chrono, currentPrice),
  };
}
