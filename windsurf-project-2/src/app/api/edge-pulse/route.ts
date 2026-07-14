import { NextRequest, NextResponse } from "next/server";
import { getEdgePulse } from "@/lib/edge-pulse/edgePulseIntelligence";
import { INSTRUMENT_KEYS, InstrumentKey } from "@/lib/market/types";

// Server-side Route Handler — the only place in Edge Pulse's request path
// that touches the market providers (and therefore the API keys). Same
// runtime/caching conventions as /api/market-intelligence. One instrument
// per request (query param `symbol`) — fetched on demand, never all 4
// eagerly (the multi-timeframe payload is materially heavier).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isInstrumentKey(value: string | null): value is InstrumentKey {
  return value !== null && (INSTRUMENT_KEYS as string[]).includes(value);
}

export async function GET(req: NextRequest) {
  const tz = req.nextUrl.searchParams.get("tz") || "UTC";
  const symbolParam = req.nextUrl.searchParams.get("symbol");

  if (!isInstrumentKey(symbolParam)) {
    return NextResponse.json({ error: "invalid_symbol", message: "symbol must be one of " + INSTRUMENT_KEYS.join(", ") }, { status: 400 });
  }

  try {
    const result = await getEdgePulse(symbolParam, tz);
    return NextResponse.json(result);
  } catch (err) {
    // Never return a stack trace or anything that could echo a key.
    console.error("[edge-pulse] build failed:", err instanceof Error ? err.name : "unknown error");
    return NextResponse.json({ error: "internal", message: "Edge Pulse temporarily unavailable." }, { status: 500 });
  }
}
