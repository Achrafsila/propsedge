import { NextRequest, NextResponse } from "next/server";
import { fetchClosedTrades } from "@/lib/mt/metaapi";

// GET /api/mt/sync?accountId=<metaApiAccountId>&days=30
// Returns closed MT4/MT5 trades in a shape the existing import flow can map
// onto ParsedTrade (see src/lib/importTrades.ts).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("accountId");
  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get("days")) || 30, 1), 365);
  if (!accountId || !/^[\w-]{8,64}$/.test(accountId)) {
    return NextResponse.json({ error: "invalid_account" }, { status: 400 });
  }
  try {
    const from = new Date(Date.now() - days * 86_400_000);
    const trades = await fetchClosedTrades(accountId, from);
    return NextResponse.json({ trades });
  } catch (err) {
    console.error("[mt/sync] failed:", err instanceof Error ? err.message.slice(0, 80) : "unknown");
    return NextResponse.json({ error: "sync_failed" }, { status: 502 });
  }
}
