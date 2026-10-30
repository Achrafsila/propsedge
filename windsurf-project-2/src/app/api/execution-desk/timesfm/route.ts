import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only shadow forecast. This route does not change orders, setups, or scores.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const engine = process.env.TIMESFM_SERVICE_URL;
  const token = process.env.TIMESFM_API_KEY;
  const twelveDataKey = process.env.TWELVEDATA_API_KEY;
  if (!engine || !token || !twelveDataKey) {
    return NextResponse.json({ status: "unconfigured", error: "TimesFM cloud service not configured" }, { status: 503 });
  }
  let serviceUrl: URL;
  try {
    serviceUrl = new URL("/forecast", engine);
    if (serviceUrl.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && serviceUrl.hostname === "127.0.0.1")) {
      throw new Error("HTTPS required");
    }
  } catch {
    return NextResponse.json({ error: "Invalid TIMESFM_SERVICE_URL" }, { status: 503 });
  }

  const tf = req.nextUrl.searchParams.get("tf") ?? "5m";
  if (tf !== "5m") return NextResponse.json({ error: "Only 5m is enabled for shadow validation" }, { status: 400 });

  try {
    const url = new URL("https://api.twelvedata.com/time_series");
    url.searchParams.set("symbol", "XAU/USD");
    url.searchParams.set("interval", "5min");
    url.searchParams.set("outputsize", "300");
    url.searchParams.set("timezone", "UTC");
    url.searchParams.set("apikey", twelveDataKey);
    const marketRes = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12000) });
    const market = await marketRes.json() as {
      values?: Array<{ datetime: string; close: string }>;
      message?: string;
    };
    if (!marketRes.ok || !Array.isArray(market.values)) {
      return NextResponse.json({ error: "Market data unavailable", detail: market.message?.slice(0, 100) }, { status: 503 });
    }

    const now = Date.now();
    const candles = market.values
      .map(v => ({ time: Date.parse(v.datetime.replace(" ", "T") + "Z"), close: Number(v.close) }))
      .filter(v => Number.isFinite(v.time) && v.time + 300000 <= now && Number.isFinite(v.close) && v.close > 0)
      .sort((a, b) => a.time - b.time);
    if (candles.length < 128) {
      return NextResponse.json({ error: "Not enough closed candles", count: candles.length }, { status: 503 });
    }
    const closes = candles.slice(-300).map(v => v.close);
    const forecastRes = await fetch(serviceUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ symbol: "XAUUSD", timeframe: "5m", closes }),
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    if (!forecastRes.ok) return NextResponse.json({ error: "TimesFM service unavailable" }, { status: 503 });
    const result = await forecastRes.json() as {
      predictions?: number[]; lower_band?: number[]; upper_band?: number[];
    };
    if (![result.predictions, result.lower_band, result.upper_band].every(
      arr => Array.isArray(arr) && arr.length === 12 && arr.every(v => typeof v === "number" && Number.isFinite(v))
    )) return NextResponse.json({ error: "Invalid TimesFM output" }, { status: 502 });

    return NextResponse.json({
      mode: "shadow",
      model: "TimesFM 2.5",
      symbol: "XAUUSD",
      timeframe: "5m",
      provider: "Twelve Data",
      lastClosedCandleAt: new Date(candles[candles.length - 1].time).toISOString(),
      lastClose: closes[closes.length - 1],
      horizon: 12,
      predictions: result.predictions,
      lowerBand: result.lower_band,
      upperBand: result.upper_band,
      affectsTrading: false,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Forecast temporarily unavailable" }, { status: 503 });
  }
}
