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
  const intervals: Record<string,{api:string,minutes:number}> = { "5m":{api:"5min",minutes:5}, "15m":{api:"15min",minutes:15}, "30m":{api:"30min",minutes:30}, "1h":{api:"1h",minutes:60}, "4h":{api:"4h",minutes:240} };
  const selected = intervals[tf];
  if (!selected) return NextResponse.json({ error: "Unsupported timeframe" }, { status: 400 });

  try {
    const url = new URL("https://api.twelvedata.com/time_series");
    url.searchParams.set("symbol", "XAU/USD");
    url.searchParams.set("interval", selected.api);
    url.searchParams.set("outputsize", "300");
    url.searchParams.set("timezone", "UTC");
    url.searchParams.set("apikey", twelveDataKey);
    const marketRes = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12000) });
    const market = await marketRes.json() as {
      values?: Array<{ datetime: string; close: string; high: string; low: string }>;
      message?: string;
    };
    if (!marketRes.ok || !Array.isArray(market.values)) {
      return NextResponse.json({ error: "Market data unavailable", detail: market.message?.slice(0, 100) }, { status: 503 });
    }

    const now = Date.now();
    const candles = market.values
      .map(v => ({ time: Date.parse(v.datetime.replace(" ", "T") + "Z"), close: Number(v.close), high: Number(v.high), low: Number(v.low) }))
      .filter(v => Number.isFinite(v.time) && v.time + selected.minutes*60000 <= now && Number.isFinite(v.close) && v.close > 0 && Number.isFinite(v.high) && Number.isFinite(v.low))
      .sort((a, b) => a.time - b.time);
    if (candles.length < 128) {
      return NextResponse.json({ error: "Not enough closed candles", count: candles.length }, { status: 503 });
    }
    const closedCandles = candles.slice(-300);
    const closes = closedCandles.map(v => v.close);
    // Same timestamped, closed-candle snapshot as TimesFM: no cross-feed comparisons.
    const ema = (length: number) => {
      let value = closes.slice(0, length).reduce((a, b) => a + b, 0) / length;
      for (let i = length; i < closes.length; i++) value += (closes[i] - value) * (2 / (length + 1));
      return value;
    };
    const e20 = closes.length >= 20 ? ema(20) : NaN;
    const e50 = closes.length >= 50 ? ema(50) : NaN;
    const e200 = closes.length >= 200 ? ema(200) : NaN;
    const structure = ![e20, e50, e200].every(Number.isFinite) ? "Unknown"
      : e20 > e50 && e50 > e200 ? "Bullish"
      : e20 < e50 && e50 < e200 ? "Bearish" : "Mixed";
    let atr: number | null = null;
    if (closedCandles.length >= 15) {
      const trs = closedCandles.slice(1).map((bar, i) => Math.max(
        bar.high - bar.low,
        Math.abs(bar.high - closedCandles[i].close),
        Math.abs(bar.low - closedCandles[i].close)
      ));
      let value = trs.slice(0, 14).reduce((a, b) => a + b, 0) / 14;
      for (const tr of trs.slice(14)) value = (value * 13 + tr) / 14;
      atr = Number.isFinite(value) && value > 0 ? value : null;
    }
    const forecastRes = await fetch(serviceUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ symbol: "XAUUSD", timeframe: tf, closes }),
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
      timeframe: tf,
      candleMinutes: selected.minutes,
      provider: "Twelve Data",
      lastClosedCandleAt: new Date(candles[candles.length - 1].time).toISOString(),
      lastClose: closes[closes.length - 1],
      horizon: 12,
      marketStructure: structure,
      atr,
      predictions: result.predictions,
      lowerBand: result.lower_band,
      upperBand: result.upper_band,
      affectsTrading: false,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Forecast temporarily unavailable" }, { status: 503 });
  }
}
