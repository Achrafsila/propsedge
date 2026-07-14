import type { InstrumentKey } from "./types";

// ============================================================
// PropEdge — Instrument relevance rules (shared, deterministic)
// ============================================================
// Extracted verbatim from marketIntelligence.ts so both news scoring
// (marketIntelligence.ts's scoreNewsRelevance, unchanged behavior) and Edge
// Pulse's Catalyst Engine (matching economic-calendar events to an
// instrument) share one keyword<->instrument mapping instead of
// duplicating it. This file only relocates code — it does not change any
// keyword, weight, or matching rule.
//
// Index keywords are intentionally specific ("nasdaq 100", not bare
// "nasdaq") so an unrelated article/event that merely mentions it's
// Nasdaq-listed isn't tagged as NDX-relevant. "euro" alone is avoided for
// the same reason (ambiguous) in favour of eur/usd, ecb, etc.

export interface RelevanceRule {
  keywords: string[];
  instruments: InstrumentKey[];
  weight: number;
}

export const RELEVANCE_RULES: RelevanceRule[] = [
  // Macro USD — moves every USD-quoted instrument.
  {
    keywords: ["federal reserve", "fomc", "interest rate", "interest rates", "rate cut", "rate hike", "rate decision", "inflation", "treasury yield", "treasury yields", "u.s. dollar", "us dollar", "dollar index", "dxy", "nonfarm", "payrolls", "jobs report"],
    instruments: ["XAUUSD", "NDX", "US30", "EURUSD"],
    weight: 2,
  },
  { keywords: ["gold", "xau", "bullion"], instruments: ["XAUUSD"], weight: 3 },
  { keywords: ["nasdaq 100", "nasdaq-100", "nasdaq composite", "nasdaq index", "ndx"], instruments: ["NDX"], weight: 3 },
  { keywords: ["dow jones", "dow 30", "djia", "dow industrials", "us30"], instruments: ["US30"], weight: 3 },
  { keywords: ["eur/usd", "eurusd", "ecb", "european central bank", "eurozone", "euro zone", "lagarde"], instruments: ["EURUSD"], weight: 3 },
];

// Single alphanumeric tokens (gold, xau, ndx, djia, us30, eurusd…) match on
// a word boundary so "gold" doesn't hit "Goldman"; multi-word / symbol
// phrases ("nasdaq 100", "eur/usd") match as substrings.
export function keywordHit(haystack: string, keyword: string): boolean {
  if (/^[a-z0-9]+$/.test(keyword)) return new RegExp(`\\b${keyword}\\b`, "i").test(haystack);
  return haystack.includes(keyword);
}
