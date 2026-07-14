import type { KeyLevels, MarketCandle } from "@/lib/market/types";
import type { LiquidityResult } from "./liquidityEngine";

// ============================================================
// Edge Pulse — Institutional Levels Engine (deterministic)
// ============================================================
// Extends the EXISTING KeyLevels (Daily/Weekly Open, Prev Day/Week
// High/Low — already computed by marketContext.ts/marketIntelligence.ts,
// never recomputed here) with:
//   - Monthly Open: derived from the already-fetched daily candles (the
//     `open` of whichever daily candle is the first trading day of the
//     current calendar month) — no new fetch, no resampling.
//   - Nearest Swing High/Low: reused directly from the Daily Liquidity
//     Engine result's buy-side/sell-side pool (same underlying swing,
//     framed here as a reference level rather than a liquidity pool —
//     avoids a third independent swing computation).
//   - Major Psychological / Half / Round levels: pure per-instrument
//     step-size math off currentPrice — never guessed for an instrument
//     without a documented step table.
// Everything is merged into one list, proximity-sorted (nearest first),
// reusing the same signed-distance convention marketContext.ts's
// KeyLevelDistance already established.

export interface InstitutionalLevel {
  label: string;
  price: number;
  distance: number; // currentPrice - price
  distancePercent: number;
}

export interface InstitutionalLevelsResult {
  symbol: string;
  levels: InstitutionalLevel[]; // sorted nearest-first
}

interface StepTable {
  round: number; // major psychological / "round number" step
  half: number; // half-level step
  minor: number; // minor round-number step
}

// Documented per-instrument step sizes — an instrument with no entry here
// gets NO psychological/half/round levels rather than a guessed step size.
const STEP_TABLE: Record<string, StepTable> = {
  XAUUSD: { round: 100, half: 50, minor: 10 },
  EURUSD: { round: 0.01, half: 0.005, minor: 0.002 },
  US30: { round: 1000, half: 500, minor: 100 },
};

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function toLevel(label: string, price: number, currentPrice: number): InstitutionalLevel {
  const distance = currentPrice - price;
  return { label, price: round(price, 6), distance: round(distance, 5), distancePercent: round((distance / price) * 100, 3) };
}

const KEY_LEVEL_LABELS: { key: keyof KeyLevels; label: string }[] = [
  { key: "dailyOpen", label: "Daily Open" },
  { key: "weeklyOpen", label: "Weekly Open" },
  { key: "previousDayHigh", label: "Prev Day High" },
  { key: "previousDayLow", label: "Prev Day Low" },
  { key: "previousWeekHigh", label: "Prev Week High" },
  { key: "previousWeekLow", label: "Prev Week Low" },
];

// The forming candle (index 0) defines "today"/"this month" — same
// convention KeyLevels.dailyOpen already relies on (it reads today.open
// directly). The oldest candle whose datetime falls in that same
// calendar month is the first trading day of the month; its open is the
// Monthly Open. Unlike swing/regime analysis, reading a candle's `open`
// field for a level is not "analysing" it, so the forming candle itself
// legitimately qualifies when today happens to be the month's first
// trading day.
function deriveMonthlyOpen(dailyCandles: MarketCandle[]): number | null {
  if (dailyCandles.length === 0) return null;
  const forming = dailyCandles[0];
  const formingMonth = typeof forming.datetime === "string" ? forming.datetime.slice(0, 7) : null;
  if (!formingMonth) return null;

  const inMonth = dailyCandles.filter((c) => typeof c.datetime === "string" && c.datetime.slice(0, 7) === formingMonth && c.open !== null);
  if (inMonth.length === 0) return null;
  // dailyCandles is newest-first; the LAST element of this filtered
  // (order-preserving) subset is the oldest in-month candle.
  return inMonth[inMonth.length - 1].open;
}

// Nearest step-multiple at or below currentPrice, and the next one above.
function nearestStepLevels(currentPrice: number, step: number): [number, number] {
  const below = Math.floor(currentPrice / step) * step;
  const above = below + step;
  return [below, above];
}

function buildStepLevels(label: string, currentPrice: number, step: number): InstitutionalLevel[] {
  const [below, above] = nearestStepLevels(currentPrice, step);
  const levels: InstitutionalLevel[] = [];
  if (below > 0) levels.push(toLevel(label, below, currentPrice));
  if (above > 0 && above !== below) levels.push(toLevel(label, above, currentPrice));
  return levels;
}

export function computeInstitutionalLevels(
  symbol: string,
  currentPrice: number | null,
  keyLevels: KeyLevels | null,
  dailyCandles: MarketCandle[],
  dailyLiquidity: LiquidityResult | null
): InstitutionalLevelsResult {
  if (currentPrice === null) return { symbol, levels: [] };

  const levels: InstitutionalLevel[] = [];

  if (keyLevels) {
    for (const { key, label } of KEY_LEVEL_LABELS) {
      const price = keyLevels[key];
      if (price !== null && price !== 0) levels.push(toLevel(label, price, currentPrice));
    }
  }

  const monthlyOpen = deriveMonthlyOpen(dailyCandles);
  if (monthlyOpen !== null && monthlyOpen !== 0) levels.push(toLevel("Monthly Open", monthlyOpen, currentPrice));

  if (dailyLiquidity?.buySideLiquidity) levels.push(toLevel("Nearest Swing High", dailyLiquidity.buySideLiquidity.price, currentPrice));
  if (dailyLiquidity?.sellSideLiquidity) levels.push(toLevel("Nearest Swing Low", dailyLiquidity.sellSideLiquidity.price, currentPrice));

  const stepTable = STEP_TABLE[symbol];
  if (stepTable) {
    levels.push(...buildStepLevels("Major Psychological Level", currentPrice, stepTable.round));
    levels.push(...buildStepLevels("Half Level", currentPrice, stepTable.half));
    levels.push(...buildStepLevels("Round Number", currentPrice, stepTable.minor));
  }

  levels.sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance));

  return { symbol, levels };
}
