import { KeyLevels, KeyLevelDistance, MarketContext, StructuralBias } from "./types";

// ============================================================
// PropEdge — Market Context engine (deterministic, V1)
// ============================================================
// Pure functions only — no network, no AI, no invented numbers. Every
// output here is derived strictly from a symbol's real currentPrice + the
// KeyLevels already computed from provider OHLC (marketIntelligence.ts).
// If a level isn't available, it's simply excluded — never guessed, never
// interpolated. This file has nothing to do with EdgePilot's risk/decision/
// compliance engines; it is informational market context only.

const LEVEL_LABELS: { key: keyof KeyLevels; label: string }[] = [
  { key: "dailyOpen", label: "Daily Open" },
  { key: "previousDayHigh", label: "Prev Day High" },
  { key: "previousDayLow", label: "Prev Day Low" },
  { key: "previousDayClose", label: "Prev Day Close" },
  { key: "weeklyOpen", label: "Weekly Open" },
  { key: "previousWeekHigh", label: "Prev Week High" },
  { key: "previousWeekLow", label: "Prev Week Low" },
];

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

// Every level actually present in `levels`, turned into a signed distance
// from currentPrice, sorted nearest-first. Levels with a null value are
// skipped entirely — never treated as zero or interpolated.
export function computeKeyLevelDistances(currentPrice: number, levels: KeyLevels): KeyLevelDistance[] {
  const distances: KeyLevelDistance[] = [];
  for (const { key, label } of LEVEL_LABELS) {
    const price = levels[key];
    if (price === null || price === 0) continue;
    const distance = currentPrice - price;
    distances.push({ label, price, distance: round(distance, 5), distancePercent: round((distance / price) * 100, 3) });
  }
  return distances.sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance));
}

export function findNearestLevel(distances: KeyLevelDistance[]): KeyLevelDistance | null {
  return distances.length > 0 ? distances[0] : null;
}

// Deterministic structural read: price above BOTH its weekly open and
// daily open reads bullish (trading above both reference opens this
// week/day), below both reads bearish, split reads neutral. Requires both
// reference levels — "unknown" (never guessed) if either is missing, e.g.
// early in the week before a full picture exists.
export function computeStructuralBias(currentPrice: number, levels: KeyLevels): StructuralBias {
  const { weeklyOpen, dailyOpen } = levels;
  if (weeklyOpen === null || dailyOpen === null) return "unknown";
  const aboveWeekly = currentPrice > weeklyOpen;
  const aboveDaily = currentPrice > dailyOpen;
  if (aboveWeekly && aboveDaily) return "bullish";
  if (!aboveWeekly && !aboveDaily) return "bearish";
  return "neutral";
}

const BIAS_PHRASE: Record<Exclude<StructuralBias, "unknown">, string> = {
  bullish: "holding above both its weekly and daily open",
  bearish: "holding below both its weekly and daily open",
  neutral: "split between its weekly and daily open — no clean directional read",
};

// One concise, template-built sentence — never generated text. Combines the
// bias (if known) with the nearest real level (if any); degrades gracefully
// when either input is missing rather than fabricating a read.
export function buildMarketContextInsight(symbol: string, bias: StructuralBias, nearest: KeyLevelDistance | null): string {
  const biasClause = bias === "unknown" ? null : `${symbol} is ${BIAS_PHRASE[bias]}`;
  const levelClause = nearest
    ? `${nearest.distance >= 0 ? "up" : "down"} ${Math.abs(nearest.distancePercent)}% from its nearest key level (${nearest.label} at ${nearest.price})`
    : null;

  if (biasClause && levelClause) return `${biasClause}, ${levelClause}.`;
  if (biasClause) return `${biasClause}.`;
  if (levelClause) return `${symbol} is ${levelClause}.`;
  return `Not enough key-level data yet to build market context for ${symbol}.`;
}

// currentPrice/levels come straight from the already-normalized
// InstrumentMarketData — returns null only when there's truly nothing to
// compute from (no live price), matching the rest of this module's "null
// means genuinely unavailable" convention.
export function buildMarketContext(symbol: string, currentPrice: number | null, levels: KeyLevels | null): MarketContext | null {
  if (currentPrice === null || levels === null) return null;
  const distances = computeKeyLevelDistances(currentPrice, levels);
  const nearestLevel = findNearestLevel(distances);
  const bias = computeStructuralBias(currentPrice, levels);
  return { bias, nearestLevel, distances, insight: buildMarketContextInsight(symbol, bias, nearestLevel) };
}
