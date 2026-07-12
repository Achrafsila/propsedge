import { NextRequest, NextResponse } from "next/server";
import { getMarketIntelligence } from "@/lib/market/marketIntelligence";
import { buildUnavailableIntelligence } from "@/lib/market/types";

// Server-side Route Handler — the ONLY place in the request path that
// touches the market providers (and therefore the API keys). Runs on the
// Node runtime so process.env is available. React components fetch THIS,
// never Finnhub/TwelveData directly, and never see an API key.
export const runtime = "nodejs";
// Explicit, not implicit: this route must never be served from Next's Full
// Route Cache (a GET handler with no dynamic API usage can otherwise be
// frozen at build/first-request time). Freshness is already governed
// per-domain by each provider's own `next: { revalidate }` window
// (news 15m / calendar 30m / prices 5m / weekly 30m) — this only makes sure
// the route wrapper itself is never an extra, stale caching layer on top.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // The user's timezone comes from the client (Intl) so event times can be
  // formatted locally. Defaults to UTC; never trusted for anything but tz.
  const tz = req.nextUrl.searchParams.get("tz") || "UTC";
  try {
    const data = await getMarketIntelligence(tz);
    return NextResponse.json(data);
  } catch (err) {
    // Never return a stack trace or anything that could echo a key — only a
    // well-formed unavailable object the UI can render cleanly.
    console.error("[market-intelligence] build failed:", err instanceof Error ? err.name : "unknown error");
    return NextResponse.json(
      buildUnavailableIntelligence(tz, [{ domain: "news", code: "internal", message: "Market intelligence temporarily unavailable." }])
    );
  }
}
