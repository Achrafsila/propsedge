import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Position={id:string;user_id:string;symbol:string;timeframe:string;side:number;entry:number;sl:number;tp:number;committed_at:string;last_candle_time:number|null};
type Candle={time:number;open:number;high:number;low:number;close:number};
const intervals:Record<string,string>={'5m':'5min','15m':'15min','30m':'30min','1h':'1h','4h':'4h'};
function signals(p:Position,c:Candle,history:Candle[]){
 const stop=p.side===1?c.low<=p.sl:c.high>=p.sl;
 const target=p.side===1?c.high>=p.tp:c.low<=p.tp;
 if(stop&&target)return [{kind:'both_touched',message:'SL et TP théoriques traversés dans une même bougie : séquence intrabougie inconnue. Vérifie MT5.'}];
 if(stop)return [{kind:'stop_touched',message:'SL théorique touché : vérifie la position et le prix exécuté chez ton broker.'}];
 if(target)return [{kind:'target_touched',message:'TP théorique touché : vérifie la position chez ton broker.'}];
 const prior=history.slice(-5,-1);
 if(prior.length>=3 && (p.side===1?c.close<Math.min(...prior.map(x=>x.low)):c.close>Math.max(...prior.map(x=>x.high))))return [{kind:'structure_warning',message:'Clôture contre la structure récente : réévalue le risque de la position.'}];
 return [];
}
export async function GET(req:NextRequest){
 const secret=process.env.EXECUTION_MONITOR_SECRET;
 if(!secret||req.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized'},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,service=process.env.SUPABASE_SERVICE_ROLE_KEY,key=process.env.TWELVEDATA_API_KEY;
 if(!url||!service||!key)return NextResponse.json({error:'Monitor not configured'},{status:503});
 const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:positions,error}=await db.from('execution_positions').select('id,user_id,symbol,timeframe,side,entry,sl,tp,committed_at,last_candle_time').eq('status','open').order('committed_at',{ascending:true}).limit(100);
 if(error)return NextResponse.json({error:'Position query failed'},{status:503});
 const byTf=new Map<string,Position[]>();for(const p of (positions||[]) as Position[]){byTf.set(p.timeframe,[...(byTf.get(p.timeframe)||[]),p]);}
 let evaluated=0,created=0;const failures:string[]=[];
 for(const [tf,group] of byTf){const interval=intervals[tf];if(!interval){failures.push(tf+': invalid timeframe');continue;}
  try{
   const response=await fetch(`https://api.twelvedata.com/time_series?symbol=XAU%2FUSD&interval=${interval}&outputsize=12&timezone=UTC&apikey=${encodeURIComponent(key)}`,{cache:'no-store',signal:AbortSignal.timeout(10000)});
   const json=await response.json() as {values?:Array<{datetime:string;open:string;high:string;low:string;close:string}>};
   if(!response.ok||!Array.isArray(json.values)){failures.push(tf+': provider unavailable');continue;}
   const candles=json.values.map(x=>({time:Date.parse(x.datetime.replace(' ','T')+'Z')/1000,open:Number(x.open),high:Number(x.high),low:Number(x.low),close:Number(x.close)})).filter(x=>Number.isFinite(x.time)&&[x.open,x.high,x.low,x.close].every(Number.isFinite)).sort((a,b)=>a.time-b.time);
   // Never interpret the current still-forming candle as a confirmed close.
   const completed=candles.slice(0,-1);const latest=completed.at(-1);
   if(!latest||Date.now()-latest.time*1000>3*({ '5m':300000,'15m':900000,'30m':1800000,'1h':3600000,'4h':14400000 }[tf]||300000)){failures.push(tf+': stale candles');continue;}
   for(const p of group){const newCandles=completed.filter(c=>c.time>(p.last_candle_time||Date.parse(p.committed_at)/1000));
    for(const c of newCandles){const i=completed.indexOf(c);const alerts=signals(p,c,completed.slice(Math.max(0,i-4),i+1));for(const alert of alerts){const {error:e}=await db.from('execution_alerts').upsert({user_id:p.user_id,position_id:p.id,candle_time:c.time,...alert},{onConflict:'position_id,candle_time,kind',ignoreDuplicates:true});if(!e)created++;else failures.push('Alert write failed');}}
    if(newCandles.length){await db.from('execution_positions').update({last_candle_time:newCandles.at(-1)!.time,last_checked_at:new Date().toISOString()}).eq('id',p.id).eq('status','open');}evaluated++;
   }
  }catch{failures.push(tf+': market feed error');}
 }
 return NextResponse.json({evaluated,alertsProcessed:created,failures},{headers:{'Cache-Control':'no-store'}});
}
