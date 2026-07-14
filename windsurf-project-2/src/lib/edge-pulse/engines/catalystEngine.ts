import type { EconomicEvent, ImpactLevel, InstrumentKey } from "@/lib/market/types";
import { RELEVANCE_RULES, keywordHit } from "@/lib/market/relevanceRules";

// ============================================================
// Edge Pulse — Catalyst Engine (deterministic)
// ============================================================
// Matches already-fetched economic-calendar events (Finnhub, via the
// existing marketIntelligence.ts pipeline — this file fetches nothing
// itself) to the selected instrument, reusing the SAME keyword<->
// instrument mapping news scoring already uses (relevanceRules.ts) so
// there is one source of truth for "which instrument does this concern,"
// not a second hand-rolled list. Adds a currency-code match as a second,
// independently documented deterministic signal (EconomicEvent.currency
// is a structured field, more reliable than title keywords alone).
//
// Honesty note: the live orchestrator (marketIntelligence.ts) currently
// only ever fetches a SINGLE day's calendar (today) — it has never fetched
// a week-wide range, and Finnhub's calendar endpoint is currently 403'ing
// on this plan regardless (see providers/finnhub.ts). This engine does not
// assume which date range it was given: it buckets whatever events it
// receives into "today" vs. "this week" relative to `now`, and reports the
// fallback sentence when nothing qualifies — which will be the common
// case in production until the fetch range is widened. That is correct,
// honest behavior, not a bug.

export type CatalystSource = "Central Bank" | "Inflation" | "Employment" | "Geopolitics" | "News Theme" | "Economic Calendar";

export interface CatalystItem {
  title: string;
  scheduledAt: string;
  impact: ImpactLevel;
  source: CatalystSource;
}

export interface CatalystResult {
  symbol: string;
  todaysCatalyst: CatalystItem | null;
  weeklyCatalyst: CatalystItem | null; // null whenever it would just repeat todaysCatalyst, or nothing else qualifies
  fallbackMessage: string | null; // set only when both are null
}

export const NO_CATALYST_MESSAGE = "No confirmed catalyst currently dominates the market.";

// Currency a scheduled event is denominated in -> which instruments that
// currency structurally concerns (USD-quoted gold/indices/EURUSD all care
// about USD events; only EURUSD cares about EUR events). A second,
// independent signal alongside title-keyword matching — never a
// replacement for it.
const CURRENCY_INSTRUMENTS: Record<string, InstrumentKey[]> = {
  USD: ["XAUUSD", "NDX", "US30", "EURUSD"],
  EUR: ["EURUSD"],
};

// Specific -> generic, first match wins. Central Bank/Inflation/Employment/
// Geopolitics are the spec's named categories; "News Theme" is reserved
// for an instrument match that isn't one of those specific buckets;
// "Economic Calendar" is the final, fully generic fallback.
const SOURCE_RULES: { source: CatalystSource; keywords: string[] }[] = [
  { source: "Central Bank", keywords: ["fomc", "federal reserve", "rate decision", "rate hike", "rate cut", "ecb", "european central bank", "boe", "bank of england", "boj", "bank of japan", "rba", "central bank"] },
  { source: "Inflation", keywords: ["cpi", "inflation", "pce", "ppi"] },
  { source: "Employment", keywords: ["nonfarm", "payrolls", "unemployment", "jobless claims", "employment change", "jobs report"] },
  { source: "Geopolitics", keywords: ["war", "sanction", "election", "geopolitic", "conflict", "tariff"] },
];

function classifySource(title: string): CatalystSource {
  const haystack = title.toLowerCase();
  for (const rule of SOURCE_RULES) {
    if (rule.keywords.some((k) => keywordHit(haystack, k))) return rule.source;
  }
  return "Economic Calendar";
}

function matchesInstrument(event: EconomicEvent, instrument: InstrumentKey): boolean {
  const haystack = event.title.toLowerCase();
  const titleMatch = RELEVANCE_RULES.some((rule) => rule.instruments.includes(instrument) && rule.keywords.some((k) => keywordHit(haystack, k)));
  if (titleMatch) return true;
  const currency = event.currency?.toUpperCase() ?? null;
  return currency !== null && (CURRENCY_INSTRUMENTS[currency]?.includes(instrument) ?? false);
}

const IMPACT_RANK: Record<ImpactLevel, number> = { high: 3, medium: 2, low: 1, unknown: 0 };

function toItem(event: EconomicEvent): CatalystItem {
  return { title: event.title, scheduledAt: event.scheduledAt, impact: event.impact, source: classifySource(event.title) };
}

// Highest impact wins; ties broken by earliest scheduledAt (the soonest
// event is the more immediately relevant one).
function pickTopCatalyst(events: EconomicEvent[]): EconomicEvent | null {
  if (events.length === 0) return null;
  return events.reduce((best, e) => {
    const rankDiff = IMPACT_RANK[e.impact] - IMPACT_RANK[best.impact];
    if (rankDiff !== 0) return rankDiff > 0 ? e : best;
    return e.scheduledAt < best.scheduledAt ? e : best;
  });
}

function isSameUtcDate(isoA: string, isoB: string): boolean {
  return isoA.slice(0, 10) === isoB.slice(0, 10) && isoA.slice(0, 10) !== "";
}

// ISO week (Mon-Sun) containing `now`, compared in UTC calendar terms —
// matches scheduledAt's own UTC convention, no timezone guessing.
function isSameUtcWeek(iso: string, now: Date): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const startOfWeek = new Date(now);
  const day = (startOfWeek.getUTCDay() + 6) % 7; // Monday = 0
  startOfWeek.setUTCDate(startOfWeek.getUTCDate() - day);
  startOfWeek.setUTCHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setUTCDate(endOfWeek.getUTCDate() + 7);
  return d >= startOfWeek && d < endOfWeek;
}

export function computeCatalyst(symbol: InstrumentKey, economicEvents: EconomicEvent[], now: Date): CatalystResult {
  const nowIso = now.toISOString();
  const relevant = economicEvents.filter((e) => e.title !== "" && e.scheduledAt !== "" && matchesInstrument(e, symbol));

  const todaysEvents = relevant.filter((e) => isSameUtcDate(e.scheduledAt, nowIso));
  const weeklyEvents = relevant.filter((e) => isSameUtcWeek(e.scheduledAt, now));

  const topToday = pickTopCatalyst(todaysEvents);
  // Weekly Catalyst only reported when it's a DIFFERENT event from today's
  // — otherwise it would just be a duplicate of the same fact under a
  // second label.
  const weeklyCandidates = weeklyEvents.filter((e) => !topToday || e.id !== topToday.id);
  const topWeekly = pickTopCatalyst(weeklyCandidates);

  const todaysCatalyst = topToday ? toItem(topToday) : null;
  const weeklyCatalyst = topWeekly ? toItem(topWeekly) : null;

  return {
    symbol,
    todaysCatalyst,
    weeklyCatalyst,
    fallbackMessage: !todaysCatalyst && !weeklyCatalyst ? NO_CATALYST_MESSAGE : null,
  };
}
