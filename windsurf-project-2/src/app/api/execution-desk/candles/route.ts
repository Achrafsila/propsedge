import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
const intervals: Record<string,string> = { "5m":"5min", "15m":"15min", "30m":"30min", "1h":"1h", "4h":"4h" };
export async function GET(req: NextRequest) {
  const tf = req.nextUrl.searchParams.get("tf") || "15m";
  const interval = intervals[tf];
  if (!interval) return NextResponse.json({ error:"Invalid timeframe" },{status:400});
  const key = process.env.TWELVEDATA_API_KEY;
  if (!key) return NextResponse.json({error:"XAU/USD provider not configured",candles:[]},{status:503});
  const url = "https://api.twelvedata.com/time_series?symbol=XAU%2FUSD&interval="+interval+"&outputsize=300&timezone=UTC&apikey="+encodeURIComponent(key);
  try {
    const res = await fetch(url,{next:{revalidate:300},signal:AbortSignal.timeout(12000)});
    const body = await res.json() as {values?:Array<{datetime:string;open:string;high:string;low:string;close:string}>;status?:string;message?:string};
    if (!res.ok || !Array.isArray(body.values)) return NextResponse.json({error:"Price history temporarily unavailable",candles:[]},{status:503});
    const candles = body.values.map(x=>({time:Math.floor(Date.parse(x.datetime.replace(" ","T")+"Z")/1000),open:Number(x.open),high:Number(x.high),low:Number(x.low),close:Number(x.close)}))
      .filter(x=>Number.isFinite(x.time)&&[x.open,x.high,x.low,x.close].every(Number.isFinite)).sort((a,b)=>a.time-b.time);
    return NextResponse.json({symbol:"XAU/USD",provider:"Twelve Data",interval:tf,asOf:new Date().toISOString(),candles},{headers:{"Cache-Control":"private, max-age=0"}});
  } catch { return NextResponse.json({error:"Market data unavailable",candles:[]},{status:503}); }
}
