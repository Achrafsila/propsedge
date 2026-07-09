import { NextResponse } from "next/server";
import { getQuote, getGeneralMarketNews, FinnhubNewsItem } from "@/lib/finnhub";
import { MarketBrief, MarketInstrumentBrief } from "@/lib/analytics/morningBriefing";

// Server-side Route Handler — the only place in the request path that
// touches src/lib/finnhub.ts (and therefore process.env.FINNHUB_API_KEY).
// Runs on the Node runtime so process.env is available.
export const runtime = "nodejs";

type InstrumentKey = "gold" | "ndx" | "us30" | "eurusd";

// OANDA-format symbols Finnhub's /quote endpoint expects for forex/
// commodities/CFD indices. These only resolve to real data on a Finnhub
// plan with market-data access for that asset class — getQuote() already
// returns null (not a fabricated price) for any symbol this token can't
// access, so MarketBriefStep just renders "Data unavailable" for those
// fields until the plan supports them.
const INSTRUMENT_SYMBOLS: Record<InstrumentKey, string> = {
  gold: "OANDA:XAU_USD",
  ndx: "OANDA:NAS100_USD",
  us30: "OANDA:US30_USD",
  eurusd: "OANDA:EUR_USD",
};

const INSTRUMENT_LABELS: Record<InstrumentKey, string> = {
  gold: "Gold",
  ndx: "NDX",
  us30: "US30",
  eurusd: "EURUSD",
};

// Finnhub's general news feed isn't per-instrument, so headlines are
// keyword-matched against each instrument — a real (if imperfect) mapping
// rather than showing the same top headline under all four.
const NEWS_KEYWORDS: Record<InstrumentKey, string[]> = {
  gold: ["gold", "xau", "bullion"],
  ndx: ["nasdaq", "ndx"],
  us30: ["dow jones", "dow 30", "us30"],
  eurusd: ["euro", "ecb", "eur/usd", "eurusd", "dollar index"],
};

// Word-boundary matching, not plain substring — a naive .includes("gold")
// false-positives on "Goldman Sachs" (confirmed against real Finnhub news
// data during verification), so every keyword is matched as a whole word.
function findHeadline(news: FinnhubNewsItem[], keywords: string[]): string | null {
  const patterns = keywords.map((k) => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"));
  const match = news.find((n) => {
    const haystack = `${n.headline} ${n.summary}`;
    return patterns.some((p) => p.test(haystack));
  });
  return match ? match.headline : null;
}

// A quote's percent-change is the only real signal available for a
// deterministic bullish/bearish/neutral read — a fixed, auditable
// threshold, not an invented classification.
const SENTIMENT_THRESHOLD = 0.1;

async function buildInstrumentBrief(key: InstrumentKey, news: FinnhubNewsItem[]): Promise<MarketInstrumentBrief> {
  const quote = await getQuote(INSTRUMENT_SYMBOLS[key]);
  const sentiment =
    quote?.percentChange == null
      ? null
      : quote.percentChange > SENTIMENT_THRESHOLD
        ? "bullish"
        : quote.percentChange < -SENTIMENT_THRESHOLD
          ? "bearish"
          : "neutral";

  return {
    symbol: INSTRUMENT_LABELS[key],
    highImpactNews: findHeadline(news, NEWS_KEYWORDS[key]),
    sentiment,
    openingPrice: quote?.open ?? null,
    keyLevels: quote ? `Support ${quote.low.toFixed(2)} · Resistance ${quote.high.toFixed(2)}` : null,
    fearGreedIndex: null,
    vix: null,
    dollarIndex: null,
    bondYields: null,
  };
}

export async function GET() {
  try {
    const news = await getGeneralMarketNews();
    const [gold, ndx, us30, eurusd] = await Promise.all([
      buildInstrumentBrief("gold", news),
      buildInstrumentBrief("ndx", news),
      buildInstrumentBrief("us30", news),
      buildInstrumentBrief("eurusd", news),
    ]);

    const marketBrief: MarketBrief = { gold, ndx, us30, eurusd, generatedAt: new Date().toISOString() };
    return NextResponse.json(marketBrief);
  } catch (err) {
    // Never log/return the Finnhub key or raw error internals — only the
    // error constructor name, same convention as src/lib/finnhub.ts.
    console.error("[market-brief] Failed to build market brief:", err instanceof Error ? err.name : "unknown error");
    return NextResponse.json({ error: "Market brief temporarily unavailable" }, { status: 502 });
  }
}
