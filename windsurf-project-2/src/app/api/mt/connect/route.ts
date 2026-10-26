import { NextRequest, NextResponse } from "next/server";
import { connectAccount, MtPlatform } from "@/lib/mt/metaapi";

// POST /api/mt/connect — links a MetaTrader 4/5 account (via MetaApi).
// Protected by the session proxy (not in PUBLIC_API_ROUTES). Use the broker's
// INVESTOR (read-only) password: this app only reads trade history.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { name, login, password, server, platform } = body ?? {};
  if (
    typeof login !== "string" || typeof password !== "string" ||
    typeof server !== "string" || (platform !== "mt4" && platform !== "mt5")
  ) {
    return NextResponse.json(
      { error: "invalid_input", message: "login, password, server and platform (mt4|mt5) are required" },
      { status: 400 }
    );
  }
  try {
    const { id } = await connectAccount({
      name: typeof name === "string" && name ? name : `${platform}-${login}`,
      login, password, server, platform: platform as MtPlatform,
    });
    return NextResponse.json({ metaApiAccountId: id });
  } catch (err) {
    // Never echo the upstream body: it may contain credentials context.
    console.error("[mt/connect] failed:", err instanceof Error ? err.message.slice(0, 80) : "unknown");
    return NextResponse.json({ error: "connect_failed" }, { status: 502 });
  }
}
