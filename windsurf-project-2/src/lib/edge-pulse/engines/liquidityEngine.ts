import type { HistoryQuality } from "@/lib/market/types";
import { detectSwings, isCompleteCandle, type SwingPoint, type CompletedCandle } from "@/lib/market/engines/swingDetection";
import { Timeframe, TimeframeCandles } from "../types";

// ============================================================
// Edge Pulse — Liquidity Engine (deterministic)
// ============================================================
// Sprint 1 / Phase 2 rewrite. Implements the candidate-based, stateful,
// timeframe-aware model defined in docs/edge-pulse-market-definitions.md
// (Chapter 1 — Liquidity Definitions). Every rule below is cross-referenced
// to that document; do not change a decision rule here without updating
// the doc (and vice versa).
//
// No AI, no invented levels, no ICT/SMC branding in field names — every
// value is a mechanical derivation of confirmed swing points (and clusters
// of them) scanned against the instrument's own closed-candle history.
//
// This file preserves its OLD exported surface (`computeLiquidity`,
// `LiquidityResult` and friends) as a compatibility adapter over the new
// model — composeEdgePulse.ts, institutionalLevelsEngine.ts, copy.ts, and
// LiquidityMapSection.tsx all keep working unchanged. The new rich API
// (`computeTimeframeLiquidity`, `computeMultiTimeframeLiquidity`,
// `LiquidityLevel`) is additive and not wired into the UI yet — that is a
// deliberate, separate decision left for a future sprint.

// ── §Part 3 model (docs/edge-pulse-market-definitions.md, Appendix B) ────

export type LiquiditySide = "buy_side" | "sell_side";

// State machine is monotonic in severity: untouched -> tested -> swept ->
// consumed, with "consumed" permanent once reached (a later candle can
// never un-consume a level). "invalidated" is a DISTINCT, non-consumed
// outcome — reported only when a level was superseded by a newer, more
// extreme confirmed candidate on the same side WITHOUT ever itself being
// closed through (see docs §9: "Not every Invalidated level is Consumed").
// If a level is BOTH consumed and superseded, "consumed" is reported (more
// specific/informative) — "invalidated" as a literal state value therefore
// only ever means "superseded, not consumed."
export type LiquidityState = "untouched" | "tested" | "swept" | "consumed" | "invalidated";

export type LiquidityOrigin =
  | "swing_high"
  | "swing_low"
  | "equal_highs"
  | "equal_lows"
  | "previous_day_high"
  | "previous_day_low"
  | "previous_week_high"
  | "previous_week_low"
  | "range_high"
  | "range_low";

// previous_day/week_* and range_* origins are declared now for forward
// compatibility with the approved model, but are NOT produced by this
// engine yet — Previous Day/Week High/Low already exist as KeyLevels
// elsewhere (institutionalLevelsEngine.ts) and are deliberately not merged
// into liquidity candidacy in this phase (scoped out — see the sprint
// report). Only swing_high/swing_low/equal_highs/equal_lows are ever
// produced today.

export type LiquidityTimeframeLabel = "M15" | "H1" | "H4" | "D1";
export type LiquidityStrength = "low" | "medium" | "high";

export interface LiquidityLevel {
  symbol: string;
  timeframe: LiquidityTimeframeLabel;
  side: LiquiditySide;
  origin: LiquidityOrigin;
  price: number;
  formedAt: string;
  state: LiquidityState;
  touches: number;
  distance: number;
  distancePercent: number;
  strength: LiquidityStrength;
  evidence: string[];
  // Adapted fields, added per "adapt fields only where required by the
  // existing codebase":
  stateChangedAt: string | null; // timestamp of the candle that produced the CURRENT state; null while untouched
  equalLevelCount: number | null; // cluster member count, only for equal_highs/equal_lows origin
  equalLevelMembers: number[] | null; // cluster member prices, only for equal_highs/equal_lows origin
}

// ── Internal working types ────────────────────────────────────────────────

interface RawCandidate {
  side: LiquiditySide;
  origin: LiquidityOrigin;
  price: number;
  formedIndex: number; // index into chrono
  formedAt: string;
  equalLevelCount: number | null;
  equalLevelMembers: number[] | null;
}

const TIMEFRAME_TO_LABEL: Record<Timeframe, LiquidityTimeframeLabel> = { daily: "D1", h4: "H4", h1: "H1", m15: "M15" };

// ── §1/§2 — Confirmed Swing High/Low: unchanged, reused from swingDetection.ts ──
// (N = DEFAULT_FRACTAL_WING = 2, enforced there, not duplicated here.)

// ── §5/§6 — Equal Highs/Lows: bounded clustering ──────────────────────────
//
// Tolerance formula (docs §5, "Proposed improved tolerance", now the live
// rule): self-scaling ratio of recent candle ranges, floored by a small
// per-instrument absolute minimum so near-zero volatility windows don't
// collapse tolerance to an unreasonable near-zero value. Never a blind
// fixed percentage of price.
const EQUAL_LEVEL_LOOKBACK_SWINGS = 6;
const EQUAL_LEVEL_TOLERANCE_RATIO = 0.25;
const MEDIAN_RANGE_WINDOW = 20;

// Per-instrument absolute tolerance floor — reuses the same per-instrument
// step-size table PATTERN institutionalLevelsEngine.ts already established
// for psychological/half/round levels (a new, separate table here, since
// this one is a tolerance floor, not a display level). An instrument with
// no entry gets no floor (falls back to the pure ratio) rather than a
// guessed value.
const EQUAL_LEVEL_TOLERANCE_FLOOR: Record<string, number> = {
  XAUUSD: 0.5,
  EURUSD: 0.0003,
  US30: 5,
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

export function computeTolerance(symbol: string, chrono: CompletedCandle[]): number {
  const recentRanges = chrono.slice(-MEDIAN_RANGE_WINDOW).map((c) => c.high - c.low);
  const ratioTolerance = EQUAL_LEVEL_TOLERANCE_RATIO * median(recentRanges);
  const floor = EQUAL_LEVEL_TOLERANCE_FLOOR[symbol] ?? 0;
  return Math.max(ratioTolerance, floor);
}

// Bounded clustering (docs §3 of this sprint): every accepted member must
// be within `tolerance` of the GROUP'S OWN REFERENCE (its lowest-priced
// member, since candidates are sorted ascending before grouping) — not the
// previous member pairwise. This guarantees the first-to-last span of the
// returned group never exceeds `tolerance` (span = last - reference <=
// tolerance, by construction), closing the chain-transitivity gap the old
// pairwise-chaining implementation had. Every start index is tried and the
// largest resulting group wins (ties broken toward the lower-priced
// group), so a borderline early candidate can never suppress a better,
// larger cluster starting one position later.
// Exported (in addition to being used internally) specifically so the
// bounded-clustering property can be unit-tested in isolation, independent
// of the supersession interaction the full pipeline also applies.
export function clusterEqualLevels(swings: SwingPoint[], tolerance: number): SwingPoint[] | null {
  if (swings.length < 2) return null;
  const sorted = [...swings].sort((a, b) => a.price - b.price);

  let best: SwingPoint[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const reference = sorted[i].price;
    const group: SwingPoint[] = [sorted[i]];
    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[j].price - reference <= tolerance) group.push(sorted[j]);
      else break; // sorted ascending: once one candidate fails, every later one is farther still
    }
    if (group.length > best.length) best = group;
  }

  return best.length >= 2 ? best : null;
}

// ── State classification (docs §7/§8/§9) ──────────────────────────────────
//
// Scans EVERY closed candle after formation, in chronological order, once.
// State only ever escalates in severity (untouched -> tested -> swept),
// with "consumed" as a permanent, terminal outcome that short-circuits the
// scan — this is the direct fix for the audit's flagged bug (a level later
// closed through must report as consumed, never merely swept, no matter
// how the scan reached that point).
interface StateScanResult {
  state: "untouched" | "tested" | "swept" | "consumed";
  touches: number;
  stateChangedAt: string | null;
}

function scanState(chrono: CompletedCandle[], side: LiquiditySide, price: number, formedIndex: number): StateScanResult {
  let state: StateScanResult["state"] = "untouched";
  let touches = 0;
  let stateChangedAt: string | null = null;

  for (let k = formedIndex + 1; k < chrono.length; k++) {
    const c = chrono[k];
    const touchedWick = side === "buy_side" ? c.high >= price : c.low <= price;
    if (!touchedWick) continue;

    const closedBeyond = side === "buy_side" ? c.close > price : c.close < price;
    if (closedBeyond) {
      touches++;
      state = "consumed";
      stateChangedAt = c.datetime;
      break; // terminal — no later candle can change this
    }

    const piercedBeyond = side === "buy_side" ? c.high > price : c.low < price;
    touches++;
    if (piercedBeyond) {
      state = "swept"; // upgrades tested -> swept; never downgraded by a later, milder touch
      stateChangedAt = c.datetime;
    } else if (state === "untouched") {
      state = "tested";
      stateChangedAt = c.datetime;
    }
  }

  return { state, touches, stateChangedAt };
}

// Supersession (docs §9, "invalidated" as a distinct, non-consumed state):
// a candidate is superseded when a LATER-formed confirmed swing on the SAME
// side exists with a strictly more extreme price (higher, for buy-side /
// highs; lower, for sell-side / lows) — a fresh structural extreme that
// makes the older level less relevant even if it was never itself traded
// through. Deliberately a purely geometric/chronological check, independent
// of whatever later happens to the superseding swing itself (documented
// simplification, not a hidden bug).
//
// Bounded by a multiple of the equal-level tolerance: a later swing only
// supersedes an older one if it is more extreme by MORE than
// SUPERSESSION_TOLERANCE_MULTIPLIER x tolerance. Without a bound clearly
// wider than the clustering tolerance itself, two nearly-identical swings
// (exactly the case Equal Highs/Lows exists to recognize as mutually
// reinforcing) would spuriously supersede each other one candle apart —
// clustering and supersession would fight over the same price gap. A
// genuinely fresh extreme (clearly beyond the equal-level band) still
// supersedes normally.
const SUPERSESSION_TOLERANCE_MULTIPLIER = 2;

function isSuperseded(side: LiquiditySide, price: number, formedIndex: number, sameSideSwings: SwingPoint[], tolerance: number): boolean {
  const supersessionThreshold = tolerance * SUPERSESSION_TOLERANCE_MULTIPLIER;
  return sameSideSwings.some((s) => {
    if (s.index <= formedIndex) return false;
    const diff = side === "buy_side" ? s.price - price : price - s.price;
    return diff > supersessionThreshold;
  });
}

// ── Strength scoring (documented, no hidden weights) ──────────────────────
//
// score = originWeight + timeframeWeight + freshnessWeight(state)
//         + memberBonus(equal-level count) + testBonus(touches) + rangeBonus
// Every component is a named constant below. Thresholds are an initial,
// explicit calibration (documented in the sprint report) — revisit once
// real cross-instrument distributions are sampled, same caveat the
// Definition Book already carries for equal-level tolerance.

const ORIGIN_WEIGHT: Record<LiquidityOrigin, number> = {
  swing_high: 1.0,
  swing_low: 1.0,
  equal_highs: 2.0,
  equal_lows: 2.0,
  previous_day_high: 1.5,
  previous_day_low: 1.5,
  previous_week_high: 1.75,
  previous_week_low: 1.75,
  range_high: 1.5,
  range_low: 1.5,
};

const TIMEFRAME_WEIGHT: Record<LiquidityTimeframeLabel, number> = { D1: 2.0, H4: 1.5, H1: 1.0, M15: 0.5 };

// Only untouched/tested/swept are ever scored — consumed/invalidated
// candidates are excluded from scoring entirely (never nearest/strongest
// candidates), per "consumed levels excluded."
const FRESHNESS_WEIGHT: Record<"untouched" | "tested" | "swept", number> = { untouched: 1.0, tested: 0.6, swept: 0.3 };

const MEMBER_BONUS_PER_EXTRA_MEMBER = 0.25;
const MEMBER_BONUS_CAP = 1.0;
const TEST_BONUS_PER_TOUCH = 0.2;
const TEST_BONUS_MAX_TOUCHES = 3; // caps at 3 touches — repeated reactions matter, but with diminishing weight
const RANGE_BONUS = 0.5; // awarded to whichever candidate is currently an active-range boundary (external liquidity)

const STRENGTH_HIGH_THRESHOLD = 4.0;
const STRENGTH_MEDIUM_THRESHOLD = 2.6;

function scoreStrength(
  origin: LiquidityOrigin,
  timeframe: LiquidityTimeframeLabel,
  state: "untouched" | "tested" | "swept",
  equalLevelCount: number | null,
  touches: number,
  isRangeBoundary: boolean
): { score: number; strength: LiquidityStrength } {
  const memberBonus = equalLevelCount ? Math.min((equalLevelCount - 2) * MEMBER_BONUS_PER_EXTRA_MEMBER, MEMBER_BONUS_CAP) : 0;
  const testBonus = Math.min(touches, TEST_BONUS_MAX_TOUCHES) * TEST_BONUS_PER_TOUCH;
  const rangeBonus = isRangeBoundary ? RANGE_BONUS : 0;

  const score = ORIGIN_WEIGHT[origin] + TIMEFRAME_WEIGHT[timeframe] + FRESHNESS_WEIGHT[state] + memberBonus + testBonus + rangeBonus;
  const strength: LiquidityStrength = score >= STRENGTH_HIGH_THRESHOLD ? "high" : score >= STRENGTH_MEDIUM_THRESHOLD ? "medium" : "low";
  return { score, strength };
}

// ── Per-timeframe report ──────────────────────────────────────────────────

export interface TimeframeLiquidityReport {
  symbol: string;
  timeframe: LiquidityTimeframeLabel;
  quality: HistoryQuality;
  currentPrice: number | null;
  candidates: LiquidityLevel[]; // every non-excluded (untouched/tested/swept) candidate
  activeRange: { low: number; high: number } | null;
  nearestUntouchedBuySide: LiquidityLevel | null;
  strongestUntouchedBuySide: LiquidityLevel | null;
  nearestUntouchedSellSide: LiquidityLevel | null;
  strongestUntouchedSellSide: LiquidityLevel | null;
  latestValidSweep: LiquidityLevel | null;
  internalLiquidity: LiquidityLevel[];
  externalLiquidity: LiquidityLevel[];
}

const MIN_CANDLES_FOR_LIQUIDITY = 5; // floor to attempt even one fractal window

function unavailableReport(symbol: string, timeframe: LiquidityTimeframeLabel, currentPrice: number | null): TimeframeLiquidityReport {
  return {
    symbol,
    timeframe,
    quality: "unavailable",
    currentPrice,
    candidates: [],
    activeRange: null,
    nearestUntouchedBuySide: null,
    strongestUntouchedBuySide: null,
    nearestUntouchedSellSide: null,
    strongestUntouchedSellSide: null,
    latestValidSweep: null,
    internalLiquidity: [],
    externalLiquidity: [],
  };
}

function toEvidence(candidate: RawCandidate, state: LiquidityState, touches: number): string[] {
  const sideLabel = candidate.side === "buy_side" ? "above" : "below";
  const originLabel = candidate.origin === "equal_highs" || candidate.origin === "equal_lows" ? `${candidate.equalLevelCount}-member equal level` : "confirmed swing";
  return [
    `${originLabel} formed at ${candidate.price} (${candidate.formedAt}), resting ${sideLabel} the market.`,
    `State: ${state}, ${touches} touch(es) recorded since formation.`,
  ];
}

// Selects by rule: nearest (smallest abs distance) or strongest (highest
// score), restricted to the given set of eligible states, per side.
// Ties on "nearest" broken by higher score; ties on "strongest" broken by
// smaller distance — always deterministic, never arbitrary array order.
//
// Critically also requires the candidate to be GEOMETRICALLY on the
// correct side of current price right now (buy_side must have
// distance < 0, i.e. price > currentPrice; sell_side must have
// distance > 0) — not just carry a buy_side/sell_side origin tag. A swing
// high's `side` is fixed at formation (it IS a high-type swing forever),
// but price can later trade up past it, at which point it is no longer
// genuinely "resting above the market" (docs §3: "a valid level must be
// above current price") and must fall out of buy-side selection —
// eligible only as Internal Liquidity from that point on, never as
// nearest/strongest/external buy-side liquidity.
function selectByRule(
  candidates: LiquidityLevel[],
  side: LiquiditySide,
  states: LiquidityState[],
  scores: Map<LiquidityLevel, number>,
  mode: "nearest" | "strongest"
): LiquidityLevel | null {
  const eligible = candidates.filter((c) => c.side === side && states.includes(c.state) && (side === "buy_side" ? c.distance < 0 : c.distance > 0));
  if (eligible.length === 0) return null;

  return eligible.reduce((best, c) => {
    if (mode === "nearest") {
      const bd = Math.abs(best.distance);
      const cd = Math.abs(c.distance);
      if (cd !== bd) return cd < bd ? c : best;
      return (scores.get(c) ?? 0) > (scores.get(best) ?? 0) ? c : best;
    } else {
      const bs = scores.get(best) ?? 0;
      const cs = scores.get(c) ?? 0;
      if (cs !== bs) return cs > bs ? c : best;
      return Math.abs(c.distance) < Math.abs(best.distance) ? c : best;
    }
  });
}

const ACTIVE_STATES: LiquidityState[] = ["untouched", "tested", "swept"];

export function computeTimeframeLiquidity(symbol: string, timeframeCandles: TimeframeCandles, currentPrice: number | null): TimeframeLiquidityReport {
  const { timeframe: tf, candles, quality } = timeframeCandles;
  const timeframe = TIMEFRAME_TO_LABEL[tf];

  if (quality === "unavailable" || candles.length === 0 || currentPrice === null) {
    return unavailableReport(symbol, timeframe, currentPrice);
  }
  const price: number = currentPrice; // narrowed once, referenced from closures below (buildLevel)

  // Rule: index 0 is always the currently-forming candle — never analysed,
  // and can never affect the result (docs shared vocabulary).
  const completed = candles.slice(1).filter(isCompleteCandle);
  if (completed.length < MIN_CANDLES_FOR_LIQUIDITY) {
    return unavailableReport(symbol, timeframe, currentPrice);
  }

  const chrono = [...completed].reverse();
  const swings = detectSwings(chrono);
  const swingHighs = swings.filter((s) => s.type === "high");
  const swingLows = swings.filter((s) => s.type === "low");

  const tolerance = computeTolerance(symbol, chrono);
  const equalHighsCluster = clusterEqualLevels(swingHighs.slice(-EQUAL_LEVEL_LOOKBACK_SWINGS), tolerance);
  const equalLowsCluster = clusterEqualLevels(swingLows.slice(-EQUAL_LEVEL_LOOKBACK_SWINGS), tolerance);

  // Raw candidates: every individual confirmed swing, PLUS one candidate
  // per equal-level cluster (using its most-recently-formed member's index
  // as the cluster's own formation point, and the average price as its
  // level) — the clustered members individually are still also present as
  // their own swing_high/swing_low candidates, exactly as docs §5/§6
  // describe ("clustering ON TOP OF confirmed swings, never a substitute").
  const rawCandidates: RawCandidate[] = [];
  for (const s of swingHighs) {
    rawCandidates.push({ side: "buy_side", origin: "swing_high", price: s.price, formedIndex: s.index, formedAt: s.datetime, equalLevelCount: null, equalLevelMembers: null });
  }
  for (const s of swingLows) {
    rawCandidates.push({ side: "sell_side", origin: "swing_low", price: s.price, formedIndex: s.index, formedAt: s.datetime, equalLevelCount: null, equalLevelMembers: null });
  }
  if (equalHighsCluster) {
    const latest = equalHighsCluster.reduce((a, b) => (b.index > a.index ? b : a));
    const avg = equalHighsCluster.reduce((sum, s) => sum + s.price, 0) / equalHighsCluster.length;
    rawCandidates.push({
      side: "buy_side",
      origin: "equal_highs",
      price: avg,
      formedIndex: latest.index,
      formedAt: latest.datetime,
      equalLevelCount: equalHighsCluster.length,
      equalLevelMembers: equalHighsCluster.map((s) => s.price),
    });
  }
  if (equalLowsCluster) {
    const latest = equalLowsCluster.reduce((a, b) => (b.index > a.index ? b : a));
    const avg = equalLowsCluster.reduce((sum, s) => sum + s.price, 0) / equalLowsCluster.length;
    rawCandidates.push({
      side: "sell_side",
      origin: "equal_lows",
      price: avg,
      formedIndex: latest.index,
      formedAt: latest.datetime,
      equalLevelCount: equalLowsCluster.length,
      equalLevelMembers: equalLowsCluster.map((s) => s.price),
    });
  }

  // Resolve state + supersession for every raw candidate.
  const resolved = rawCandidates.map((rc) => {
    const scan = scanState(chrono, rc.side, rc.price, rc.formedIndex);
    const sameSideSwings = rc.side === "buy_side" ? swingHighs : swingLows;
    const superseded = scan.state !== "consumed" && isSuperseded(rc.side, rc.price, rc.formedIndex, sameSideSwings, tolerance);
    const state: LiquidityState = scan.state === "consumed" ? "consumed" : superseded ? "invalidated" : scan.state;
    return { rc, state, touches: scan.touches, stateChangedAt: scan.stateChangedAt };
  });

  // Only untouched/tested/swept ever become reportable LiquidityLevel
  // candidates ("consumed levels excluded" — and invalidated ones are
  // equally excluded from active reporting, since they are, by definition,
  // no longer a relevant live reference).
  const activeResolved = resolved.filter((r) => ACTIVE_STATES.includes(r.state));

  // First pass: build levels without rangeBonus (range membership is only
  // known after nearest buy/sell-side are selected) — placeholder score
  // map filled in below, then rebuilt once range boundaries are known.
  function buildLevel(r: (typeof resolved)[number], isRangeBoundary: boolean): { level: LiquidityLevel; score: number } {
    const state = r.state as "untouched" | "tested" | "swept"; // activeResolved guarantees this
    const { score, strength } = scoreStrength(r.rc.origin, timeframe, state, r.rc.equalLevelCount, r.touches, isRangeBoundary);
    const distance = price - r.rc.price;
    const level: LiquidityLevel = {
      symbol,
      timeframe,
      side: r.rc.side,
      origin: r.rc.origin,
      price: round(r.rc.price, 6),
      formedAt: r.rc.formedAt,
      state,
      touches: r.touches,
      distance: round(distance, 5),
      distancePercent: round((distance / r.rc.price) * 100, 3),
      strength,
      evidence: toEvidence(r.rc, state, r.touches),
      stateChangedAt: r.stateChangedAt,
      equalLevelCount: r.rc.equalLevelCount,
      equalLevelMembers: r.rc.equalLevelMembers,
    };
    return { level, score };
  }

  const provisional = activeResolved.map((r) => buildLevel(r, false));
  const provisionalScores = new Map(provisional.map((p) => [p.level, p.score]));

  const provisionalNearestBuy = selectByRule(provisional.map((p) => p.level), "buy_side", ACTIVE_STATES, provisionalScores, "nearest");
  const provisionalNearestSell = selectByRule(provisional.map((p) => p.level), "sell_side", ACTIVE_STATES, provisionalScores, "nearest");

  // Active range (docs §11: explicit range definition) = the nearest
  // active swing/cluster bracketing price on each side. Rebuild levels now
  // that we know which raw candidates are the range boundary, so their
  // score correctly includes the range bonus.
  const rangeBoundaryPrices = new Set([provisionalNearestBuy?.price, provisionalNearestSell?.price].filter((p): p is number => p !== undefined && p !== null));

  const finalPairs = activeResolved.map((r) => buildLevel(r, rangeBoundaryPrices.has(round(r.rc.price, 6))));
  const candidates = finalPairs.map((p) => p.level);
  const scores = new Map(finalPairs.map((p) => [p.level, p.score]));

  const nearestBuySide = selectByRule(candidates, "buy_side", ACTIVE_STATES, scores, "nearest");
  const nearestSellSide = selectByRule(candidates, "sell_side", ACTIVE_STATES, scores, "nearest");
  const nearestUntouchedBuySide = selectByRule(candidates, "buy_side", ["untouched"], scores, "nearest");
  const strongestUntouchedBuySide = selectByRule(candidates, "buy_side", ["untouched"], scores, "strongest");
  const nearestUntouchedSellSide = selectByRule(candidates, "sell_side", ["untouched"], scores, "nearest");
  const strongestUntouchedSellSide = selectByRule(candidates, "sell_side", ["untouched"], scores, "strongest");

  const activeRange = nearestBuySide && nearestSellSide ? { low: nearestSellSide.price, high: nearestBuySide.price } : null;

  const externalLiquidity: LiquidityLevel[] = [nearestBuySide, nearestSellSide].filter((l): l is LiquidityLevel => l !== null);
  let internalLiquidity: LiquidityLevel[] = [];
  if (activeRange && nearestBuySide && nearestSellSide) {
    const rangeEstablishedAt = Math.max(
      rawCandidates.find((rc) => round(rc.price, 6) === nearestBuySide.price)?.formedIndex ?? 0,
      rawCandidates.find((rc) => round(rc.price, 6) === nearestSellSide.price)?.formedIndex ?? 0
    );
    internalLiquidity = candidates.filter((c) => {
      if (c === nearestBuySide || c === nearestSellSide) return false;
      const originalIndex = rawCandidates.find((rc) => round(rc.price, 6) === c.price && rc.side === c.side)?.formedIndex ?? -1;
      return originalIndex > rangeEstablishedAt && c.price > activeRange.low && c.price < activeRange.high;
    });
  }

  // Latest valid sweep: among candidates whose CURRENT state is "swept"
  // (by construction, never one that was later consumed — scanState
  // already resolved that permanently), the most recently changed one.
  const sweptCandidates = candidates.filter((c) => c.state === "swept");
  const latestValidSweep =
    sweptCandidates.length === 0
      ? null
      : sweptCandidates.reduce((best, c) => ((c.stateChangedAt ?? "") > (best.stateChangedAt ?? "") ? c : best));

  return {
    symbol,
    timeframe,
    quality,
    currentPrice,
    candidates,
    activeRange,
    nearestUntouchedBuySide,
    strongestUntouchedBuySide,
    nearestUntouchedSellSide,
    strongestUntouchedSellSide,
    latestValidSweep,
    internalLiquidity,
    externalLiquidity,
  };
}

// ── Multi-timeframe (docs §4 of this sprint) ──────────────────────────────
// Computed independently per timeframe; candle arrays are never merged —
// each call to computeTimeframeLiquidity only ever sees its own timeframe's
// own candles (MultiTimeframeHistory already keeps them fully separate).

export interface MultiTimeframeLiquidityResult {
  symbol: string;
  d1: TimeframeLiquidityReport;
  h4: TimeframeLiquidityReport;
  h1: TimeframeLiquidityReport;
  m15: TimeframeLiquidityReport;
}

export function computeMultiTimeframeLiquidity(
  symbol: string,
  timeframes: { daily: TimeframeCandles; h4: TimeframeCandles; h1: TimeframeCandles; m15: TimeframeCandles },
  currentPrice: number | null
): MultiTimeframeLiquidityResult {
  return {
    symbol,
    d1: computeTimeframeLiquidity(symbol, timeframes.daily, currentPrice),
    h4: computeTimeframeLiquidity(symbol, timeframes.h4, currentPrice),
    h1: computeTimeframeLiquidity(symbol, timeframes.h1, currentPrice),
    m15: computeTimeframeLiquidity(symbol, timeframes.m15, currentPrice),
  };
}

// ============================================================
// Legacy compatibility adapter — preserves the OLD exported surface
// ============================================================
// composeEdgePulse.ts, institutionalLevelsEngine.ts, copy.ts, and
// LiquidityMapSection.tsx all import computeLiquidity/LiquidityResult by
// these exact names and shapes. Values may differ from the pre-calibration
// engine specifically where the old engine was wrong per the Definition
// Book (e.g. a level later closed through no longer shows as a live
// sweep) — the SHAPE is unchanged, the corrected VALUES are the point of
// this sprint.

export interface LegacyLiquidityLevel {
  price: number;
  distance: number;
  distancePercent: number;
}
export interface LegacyEqualLevelCluster extends LegacyLiquidityLevel {
  count: number;
  swingPrices: number[];
}
export interface LegacyLiquiditySweep {
  side: "high" | "low";
  sweptPrice: number;
  sweptDatetime: string; // the level's own formation timestamp (kept for shape compatibility)
  sweepCandleDatetime: string; // when the sweep candle occurred
  distance: number;
}

export interface LiquidityResult {
  symbol: string;
  timeframe: Timeframe;
  quality: HistoryQuality;
  buySideLiquidity: LegacyLiquidityLevel | null;
  sellSideLiquidity: LegacyLiquidityLevel | null;
  liquidityRestingAbove: LegacyLiquidityLevel | null;
  liquidityRestingBelow: LegacyLiquidityLevel | null;
  equalHighs: LegacyEqualLevelCluster | null;
  equalLows: LegacyEqualLevelCluster | null;
  internalLiquidity: LegacyLiquidityLevel[];
  externalLiquidity: LegacyLiquidityLevel[];
  nearestSweep: LegacyLiquiditySweep | null;
}

function toLegacyLevel(l: LiquidityLevel): LegacyLiquidityLevel {
  return { price: l.price, distance: l.distance, distancePercent: l.distancePercent };
}

function toLegacyCluster(l: LiquidityLevel): LegacyEqualLevelCluster {
  return { price: l.price, distance: l.distance, distancePercent: l.distancePercent, count: l.equalLevelCount ?? 0, swingPrices: l.equalLevelMembers ?? [] };
}

export function computeLiquidity(symbol: string, timeframeCandles: TimeframeCandles, currentPrice: number | null): LiquidityResult {
  const report = computeTimeframeLiquidity(symbol, timeframeCandles, currentPrice);

  if (report.quality === "unavailable") {
    return {
      symbol,
      timeframe: timeframeCandles.timeframe,
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

  // "Buy/sell-side liquidity" in the legacy shape meant "nearest not-yet-
  // fully-broken swing" — the closest analogue under the new model is
  // nearest ACTIVE (untouched/tested/swept), matching prior behavior for
  // everything except the swept-that-was-later-consumed bug (now fixed).
  const buySide = report.externalLiquidity.find((l) => l.side === "buy_side") ?? null;
  const sellSide = report.externalLiquidity.find((l) => l.side === "sell_side") ?? null;
  const equalHighs = report.candidates.find((l) => l.origin === "equal_highs") ?? null;
  const equalLows = report.candidates.find((l) => l.origin === "equal_lows") ?? null;

  const sweep = report.latestValidSweep;
  const nearestSweep: LegacyLiquiditySweep | null = sweep
    ? {
        side: sweep.side === "buy_side" ? "high" : "low",
        sweptPrice: sweep.price,
        sweptDatetime: sweep.formedAt,
        sweepCandleDatetime: sweep.stateChangedAt ?? sweep.formedAt,
        distance: sweep.distance,
      }
    : null;

  return {
    symbol,
    timeframe: timeframeCandles.timeframe,
    quality: report.quality,
    buySideLiquidity: buySide ? toLegacyLevel(buySide) : null,
    sellSideLiquidity: sellSide ? toLegacyLevel(sellSide) : null,
    liquidityRestingAbove: buySide ? toLegacyLevel(buySide) : null,
    liquidityRestingBelow: sellSide ? toLegacyLevel(sellSide) : null,
    equalHighs: equalHighs ? toLegacyCluster(equalHighs) : null,
    equalLows: equalLows ? toLegacyCluster(equalLows) : null,
    internalLiquidity: report.internalLiquidity.map(toLegacyLevel),
    externalLiquidity: report.externalLiquidity.map(toLegacyLevel),
    nearestSweep,
  };
}
