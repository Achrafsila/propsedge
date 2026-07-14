import type { HistoryQuality } from "@/lib/market/types";
import { detectSwings, isCompleteCandle, type SwingPoint, type CompletedCandle } from "@/lib/market/engines/swingDetection";
import { Timeframe, TimeframeCandles } from "../types";

// ============================================================
// Edge Pulse — Liquidity Engine (deterministic)
// ============================================================
// Mechanical liquidity-pool detection built entirely on top of the shared
// fractal swing utility (swingDetection.ts) — no ICT/SMC branding, every
// field is a plain derivation of "where are confirmed swing highs/lows
// that price hasn't traded back through yet." No AI, no invented levels.
//
// Computed on ONE reference timeframe per call (Daily, by convention —
// see composeEdgePulse.ts) since the spec's Liquidity Map section is one
// flat list, not a per-timeframe grid like Structure/Supply-Demand.
//
// "Buy-side Liquidity" and "Liquidity Resting Above" are the SAME pool
// (nearest unbroken swing high above price) surfaced under two labels —
// the spec lists them as separate bullets, but they are mechanically
// identical; computing them twice would just duplicate the same number.
// Sell-side/Resting-Below are the symmetric low-side pool.

const MIN_CANDLES_FOR_LIQUIDITY = 5; // same floor as Structure Engine — below this a fractal window can't resolve
const EQUAL_LEVEL_LOOKBACK_SWINGS = 6; // cluster among the last N unbroken swings on a side
const EQUAL_LEVEL_TOLERANCE_RATIO = 0.25; // self-scaling: 25% of the median of the last MEDIAN_RANGE_WINDOW candle ranges
const MEDIAN_RANGE_WINDOW = 20;
const SWEEP_SCAN_LOOKBACK_CANDLES = 20; // how far back a "most recent sweep" search looks

export interface LiquidityLevel {
  price: number;
  distance: number; // currentPrice - price (signed, same convention as marketContext.ts's KeyLevelDistance)
  distancePercent: number;
}

export interface EqualLevelCluster extends LiquidityLevel {
  count: number;
  swingPrices: number[];
}

export interface LiquiditySweep {
  side: "high" | "low"; // which side's liquidity was swept
  sweptPrice: number;
  sweptDatetime: string;
  sweepCandleDatetime: string;
  distance: number;
}

export interface LiquidityResult {
  symbol: string;
  timeframe: Timeframe;
  quality: HistoryQuality;
  buySideLiquidity: LiquidityLevel | null;
  sellSideLiquidity: LiquidityLevel | null;
  liquidityRestingAbove: LiquidityLevel | null; // === buySideLiquidity
  liquidityRestingBelow: LiquidityLevel | null; // === sellSideLiquidity
  equalHighs: EqualLevelCluster | null;
  equalLows: EqualLevelCluster | null;
  internalLiquidity: LiquidityLevel[];
  externalLiquidity: LiquidityLevel[];
  nearestSweep: LiquiditySweep | null;
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function toLevel(price: number, currentPrice: number): LiquidityLevel {
  const distance = currentPrice - price;
  return { price, distance: round(distance, 5), distancePercent: round((distance / price) * 100, 3) };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// A swing is "unbroken" when no LATER completed candle has closed beyond
// its price — the same close-beyond-level test detectBreakout already
// uses for a single candle, generalized here over every later candle.
function isUnbroken(chrono: CompletedCandle[], swing: SwingPoint): boolean {
  for (let i = swing.index + 1; i < chrono.length; i++) {
    if (swing.type === "high" && chrono[i].close > swing.price) return false;
    if (swing.type === "low" && chrono[i].close < swing.price) return false;
  }
  return true;
}

function nearestAbove(swings: SwingPoint[], currentPrice: number): SwingPoint | null {
  const above = swings.filter((s) => s.price > currentPrice);
  if (above.length === 0) return null;
  return above.reduce((best, s) => (s.price < best.price ? s : best));
}
function nearestBelow(swings: SwingPoint[], currentPrice: number): SwingPoint | null {
  const below = swings.filter((s) => s.price < currentPrice);
  if (below.length === 0) return null;
  return below.reduce((best, s) => (s.price > best.price ? s : best));
}

// Deterministic single-pass clustering: sort by price, group consecutive
// swings whose price sits within `tolerance` of the previous member,
// return the largest such group (ties broken by first-found, i.e. the
// lowest-priced qualifying group) as long as it has 2+ members.
function clusterEqualLevels(swings: SwingPoint[], tolerance: number, currentPrice: number): EqualLevelCluster | null {
  if (swings.length < 2) return null;
  const sorted = [...swings].sort((a, b) => a.price - b.price);
  let best: SwingPoint[] = [];
  let current: SwingPoint[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].price - current[current.length - 1].price <= tolerance) {
      current.push(sorted[i]);
    } else {
      if (current.length > best.length) best = current;
      current = [sorted[i]];
    }
  }
  if (current.length > best.length) best = current;
  if (best.length < 2) return null;
  const avgPrice = best.reduce((sum, s) => sum + s.price, 0) / best.length;
  return { ...toLevel(avgPrice, currentPrice), count: best.length, swingPrices: best.map((s) => s.price) };
}

// Most recent candle (scanning back SWEEP_SCAN_LOOKBACK_CANDLES) whose
// wick pierced a confirmed swing level but whose close came back on the
// origin side — the same "pierced but closed back through" shape
// detectBreakout already checks for a single candle, generalized across a
// window and every confirmed swing rather than only the latest candle vs.
// only the single nearest prior swing.
function findNearestSweep(chrono: CompletedCandle[], swingHighs: SwingPoint[], swingLows: SwingPoint[], currentPrice: number): LiquiditySweep | null {
  const start = Math.max(0, chrono.length - SWEEP_SCAN_LOOKBACK_CANDLES);
  for (let j = chrono.length - 1; j >= start; j--) {
    const candle = chrono[j];
    const priorHighs = swingHighs.filter((s) => s.index < j);
    const priorLows = swingLows.filter((s) => s.index < j);

    const sweptHighs = priorHighs.filter((s) => candle.high > s.price && candle.close < s.price);
    const sweptLows = priorLows.filter((s) => candle.low < s.price && candle.close > s.price);

    const candidates: LiquiditySweep[] = [
      ...sweptHighs.map((s) => ({ side: "high" as const, sweptPrice: s.price, sweptDatetime: s.datetime, sweepCandleDatetime: candle.datetime, distance: 0 })),
      ...sweptLows.map((s) => ({ side: "low" as const, sweptPrice: s.price, sweptDatetime: s.datetime, sweepCandleDatetime: candle.datetime, distance: 0 })),
    ];
    if (candidates.length === 0) continue;

    // Multiple swings swept by the same candle: nearest to current price wins.
    const nearest = candidates.reduce((best, c) => (Math.abs(currentPrice - c.sweptPrice) < Math.abs(currentPrice - best.sweptPrice) ? c : best));
    return { ...nearest, distance: round(currentPrice - nearest.sweptPrice, 5) };
  }
  return null;
}

function unavailableResult(symbol: string, timeframe: Timeframe): LiquidityResult {
  return {
    symbol,
    timeframe,
    quality: "unavailable",
    buySideLiquidity: null,
    sellSideLiquidity: null,
    liquidityRestingAbove: null,
    liquidityRestingBelow: null,
    equalHighs: null,
    equalLows: null,
    internalLiquidity: [],
    externalLiquidity: [],
    nearestSweep: null,
  };
}

export function computeLiquidity(symbol: string, timeframeCandles: TimeframeCandles, currentPrice: number | null): LiquidityResult {
  const { timeframe, candles, quality } = timeframeCandles;
  if (quality === "unavailable" || candles.length === 0 || currentPrice === null) {
    return unavailableResult(symbol, timeframe);
  }

  // Rule: index 0 is always the currently-forming candle — never analysed.
  const completed = candles.slice(1).filter(isCompleteCandle);
  if (completed.length < MIN_CANDLES_FOR_LIQUIDITY) {
    return unavailableResult(symbol, timeframe);
  }

  const chrono = [...completed].reverse();
  const swings = detectSwings(chrono);
  const swingHighs = swings.filter((s) => s.type === "high");
  const swingLows = swings.filter((s) => s.type === "low");

  const unbrokenHighs = swingHighs.filter((s) => isUnbroken(chrono, s));
  const unbrokenLows = swingLows.filter((s) => isUnbroken(chrono, s));

  const buySideSwing = nearestAbove(unbrokenHighs, currentPrice);
  const sellSideSwing = nearestBelow(unbrokenLows, currentPrice);
  const buySideLiquidity = buySideSwing ? toLevel(buySideSwing.price, currentPrice) : null;
  const sellSideLiquidity = sellSideSwing ? toLevel(sellSideSwing.price, currentPrice) : null;

  const recentRanges = chrono.slice(-MEDIAN_RANGE_WINDOW).map((c) => c.high - c.low);
  const tolerance = EQUAL_LEVEL_TOLERANCE_RATIO * median(recentRanges);
  const equalHighs = clusterEqualLevels(unbrokenHighs.slice(-EQUAL_LEVEL_LOOKBACK_SWINGS), tolerance, currentPrice);
  const equalLows = clusterEqualLevels(unbrokenLows.slice(-EQUAL_LEVEL_LOOKBACK_SWINGS), tolerance, currentPrice);

  // Dealing range = the two unbroken swings currently bracketing price.
  // External liquidity is exactly those two boundary pools; internal
  // liquidity is any OTHER unbroken swing strictly inside that range,
  // formed after the range was established (i.e. after whichever boundary
  // swing formed later — only then do both boundaries co-exist).
  const externalLiquidity: LiquidityLevel[] = [buySideLiquidity, sellSideLiquidity].filter((l): l is LiquidityLevel => l !== null);
  let internalLiquidity: LiquidityLevel[] = [];
  if (buySideSwing && sellSideSwing) {
    const rangeEstablishedAt = Math.max(buySideSwing.index, sellSideSwing.index);
    const otherUnbroken = [...unbrokenHighs, ...unbrokenLows].filter(
      (s) => s !== buySideSwing && s !== sellSideSwing && s.index > rangeEstablishedAt && s.price > sellSideSwing.price && s.price < buySideSwing.price
    );
    internalLiquidity = otherUnbroken.map((s) => toLevel(s.price, currentPrice));
  }

  const nearestSweep = findNearestSweep(chrono, swingHighs, swingLows, currentPrice);

  return {
    symbol,
    timeframe,
    quality,
    buySideLiquidity,
    sellSideLiquidity,
    liquidityRestingAbove: buySideLiquidity,
    liquidityRestingBelow: sellSideLiquidity,
    equalHighs,
    equalLows,
    internalLiquidity,
    externalLiquidity,
    nearestSweep,
  };
}
