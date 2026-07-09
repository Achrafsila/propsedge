import { TraderDiscipline } from "./traderDiscipline";
import { TraderEdge } from "./traderEdge";
import { TraderEvolution } from "./traderEvolution";

// ============================================================
// PropEdge — Morning Briefing copy generators (V1, deterministic)
// ============================================================
// Two responsibilities, kept separate from aiCoach.ts (which owns risk/Mode
// math, not prose): a Market Brief backed by the server-only
// /api/market-brief route (Finnhub — see src/lib/finnhub.ts, never
// imported here since this file has no access to FINNHUB_API_KEY and
// shouldn't), and two single-sentence generators (EdgePilot Insight, Daily
// Motivation) that only ever read fields the Trader DNA engines already
// compute — no new analytics, no AI call, no randomness that changes on
// re-render.

// ── Market Brief ─────────────────────────────────────────────────────────

export interface MarketInstrumentBrief {
  symbol: string;
  highImpactNews: string | null;
  sentiment: "bullish" | "bearish" | "neutral" | null;
  openingPrice: number | null;
  keyLevels: string | null;
  // Reserved for future data feeds (Fear & Greed, VIX, Dollar Index, Bond
  // Yields) — always null in V1, not rendered by MarketBriefStep yet, kept
  // here so the type doesn't need to change when a real source is wired up.
  fearGreedIndex: number | null;
  vix: number | null;
  dollarIndex: number | null;
  bondYields: string | null;
}

export interface MarketBrief {
  gold: MarketInstrumentBrief;
  ndx: MarketInstrumentBrief;
  us30: MarketInstrumentBrief;
  eurusd: MarketInstrumentBrief;
  generatedAt: string;
}

function emptyInstrumentBrief(symbol: string): MarketInstrumentBrief {
  return {
    symbol,
    highImpactNews: null,
    sentiment: null,
    openingPrice: null,
    keyLevels: null,
    fearGreedIndex: null,
    vix: null,
    dollarIndex: null,
    bondYields: null,
  };
}

// The safe fallback shape — every field a graceful placeholder
// (MarketBriefStep renders "Data unavailable" copy for nulls). Used as the
// initial render state before the fetch below resolves, and as the result
// of getMarketBrief() itself on any network failure, non-2xx response, or
// unexpected shape, so a Finnhub outage or rate limit never breaks the
// Morning Briefing.
export function buildEmptyMarketBrief(): MarketBrief {
  return {
    gold: emptyInstrumentBrief("Gold"),
    ndx: emptyInstrumentBrief("NDX"),
    us30: emptyInstrumentBrief("US30"),
    eurusd: emptyInstrumentBrief("EURUSD"),
    generatedAt: new Date().toISOString(),
  };
}

function isMarketInstrumentBrief(value: unknown): value is MarketInstrumentBrief {
  return typeof value === "object" && value !== null && typeof (value as { symbol?: unknown }).symbol === "string";
}

function isMarketBrief(value: unknown): value is MarketBrief {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    isMarketInstrumentBrief(v.gold) &&
    isMarketInstrumentBrief(v.ndx) &&
    isMarketInstrumentBrief(v.us30) &&
    isMarketInstrumentBrief(v.eurusd)
  );
}

// Fetches real data from Finnhub via the server-only /api/market-brief
// route (this file has no direct access to FINNHUB_API_KEY, and never
// should — see src/lib/finnhub.ts). Falls back to buildEmptyMarketBrief()
// on any failure, keeping this function's shape exactly what it was in V1
// (a Promise<MarketBrief>, no caller changes needed beyond awaiting it) —
// the "Future Ready" swap this file's header already anticipated.
export async function getMarketBrief(): Promise<MarketBrief> {
  try {
    const res = await fetch("/api/market-brief");
    if (!res.ok) return buildEmptyMarketBrief();
    const data: unknown = await res.json();
    return isMarketBrief(data) ? data : buildEmptyMarketBrief();
  } catch {
    return buildEmptyMarketBrief();
  }
}

// ── EdgePilot Insight ────────────────────────────────────────────────────
// One sentence, picked from already-computed fields in priority order (same
// "first applicable wins" convention aiCoach.ts's own selectMainPriority
// uses) — never a plan-adherence win-rate claim, since no per-trade "did I
// follow my plan" tag exists anywhere in this schema.

// Same 10-trade "not a coincidence" floor Your Edge/Blind Spots/Discipline
// use for their own expectancy-based groupings (duplicated, not imported,
// per this file's self-contained convention).
const MIN_SAMPLE_FOR_INSIGHT = 10;

export function getEdgePilotInsight(discipline: TraderDiscipline, edge: TraderEdge, evolution: TraderEvolution): string {
  if (
    discipline.positionSizeAfterLosses.value === "Increasing Risk" &&
    discipline.positionSizeAfterLosses.sampleSize >= MIN_SAMPLE_FOR_INSIGHT
  ) {
    return discipline.positionSizeAfterLosses.narrative;
  }

  if (
    (discipline.revengeTradingScore.value === "Poor" || discipline.revengeTradingScore.value === "High Risk") &&
    discipline.revengeTradingScore.sampleSize >= MIN_SAMPLE_FOR_INSIGHT
  ) {
    return discipline.revengeTradingScore.narrative;
  }

  if (evolution.expectancyTrend.value === "Increasing") {
    return `Your expectancy is trending up — ${evolution.expectancyTrend.reasons}.`;
  }

  if (edge.bestSetup.sampleSize >= MIN_SAMPLE_FOR_INSIGHT) {
    return `${edge.bestSetup.value}${edge.bestSetup.detail ? ` (${edge.bestSetup.detail})` : ""} remains your strongest statistical edge over your last ${edge.bestSetup.sampleSize} trades.`;
  }

  if (
    discipline.lossDisciplineScore.value === "Needs Attention" &&
    discipline.lossDisciplineScore.sampleSize >= MIN_SAMPLE_FOR_INSIGHT
  ) {
    return discipline.lossDisciplineScore.narrative;
  }

  return "Building history — insights will sharpen as you log more trades.";
}

// ── Daily Motivation ─────────────────────────────────────────────────────
// Prefers one personalized line from real data; falls back to a small
// curated, static quote list — never generated text, never random per
// render (indexed deterministically by day-of-year so it's stable for the
// whole day and only changes the next calendar day).

const CURATED_QUOTES: string[] = [
  "Plan the trade, trade the plan.",
  "Cut your losses short and let your winners run.",
  "The market can stay irrational longer than you can stay solvent — protect your capital first.",
  "Risk comes from not knowing what you're doing.",
  "Consistency beats intensity — protect your capital first, profits follow.",
  "Every professional trader was once an amateur who refused to give up.",
  "Discipline is the bridge between goals and accomplishment.",
  "Your edge only pays off if you're still in the game to use it.",
  "The best traders aren't the ones who never lose — they're the ones who never blow up.",
];

// Days since Jan 1 of the same year, from a "YYYY-MM-DD" key — used only to
// pick a stable index into CURATED_QUOTES, never for date arithmetic that
// needs to be exact across year boundaries.
function dayOfYear(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return 0;
  const start = Date.UTC(y, 0, 1);
  const current = Date.UTC(y, m - 1, d);
  return Math.floor((current - start) / (24 * 60 * 60 * 1000));
}

export function getDailyMotivation(discipline: TraderDiscipline, evolution: TraderEvolution, dateSeed: string): string {
  if (evolution.expectancyTrend.value === "Increasing") {
    return "Your expectancy is moving in the right direction — stay with the process that got you here today.";
  }

  if (discipline.lossDisciplineScore.value === "Excellent" || discipline.lossDisciplineScore.value === "Good") {
    return "Your discipline after losses is one of your real strengths right now — bring that same composure into today's session.";
  }

  const index = dayOfYear(dateSeed) % CURATED_QUOTES.length;
  return CURATED_QUOTES[index];
}
