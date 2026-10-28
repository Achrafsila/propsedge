"use client";
import {useEffect,useState} from "react";
import {analyzeMarketContext,type MarketContext,type OHLC} from "@/lib/execution/marketContext";
type Result={tf:string;context:MarketContext|null;error:string};
export default function MarketContextPanel(){
 const [results,setResults]=useState<Result[]>([]),[loading,setLoading]=useState(true);
 useEffect(()=>{let live=true;async function load(){
  setLoading(true);
  const next=await Promise.all(["1h","15m"].map(async tf=>{
   try{const response=await fetch("/api/execution-desk/candles?tf="+tf,{cache:"no-store"});const body=await response.json();
    if(!response.ok)throw Error(body.error||"Market data unavailable");
    return {tf,context:analyzeMarketContext(body.candles as OHLC[]),error:""};
   }catch(e){return {tf,context:null,error:e instanceof Error?e.message:"Unavailable"};}
  }));
  if(live){setResults(next);setLoading(false);}
 }void load();const timer=setInterval(()=>void load(),300000);return()=>{live=false;clearInterval(timer)}},[]);
 return <section className="rounded-2xl border border-cyan-500/20 bg-[#0c1325]/90 p-3 sm:p-4" aria-label="Multi timeframe market context">
  <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-sm font-bold text-white sm:text-base">Market Context · H1 / M15</h2><span className="text-[10px] text-slate-400">OHLC Twelve Data · closed candles</span></div>
  <div className="grid grid-cols-2 gap-2">{["1h","15m"].map(tf=>{const r=results.find(x=>x.tf===tf),c=r?.context;
   return <div key={tf} className="min-w-0 rounded-xl border border-white/10 bg-white/[.03] p-2.5 sm:p-3">
    <p className="text-[10px] font-semibold text-slate-400">{tf==="1h"?"H1 · Direction":"M15 · Structure"}</p>
    <p className={"mt-1 text-sm font-bold "+(c?.trend==="bullish"?"text-emerald-300":c?.trend==="bearish"?"text-rose-300":"text-slate-200")}>{loading?"Loading…":c?(c.trend==="bullish"?"Bullish":c.trend==="bearish"?"Bearish":"Range / mixed"):"Data unavailable"}</p>
    {c?<><p className="mt-1 text-xs text-slate-400">{c.structure} · {c.phase}</p><p className="mt-1 text-[10px] text-slate-500">Range {c.support.toFixed(2)}–{c.resistance.toFixed(2)}</p></>:<p className="mt-1 break-words text-[10px] text-amber-300">{r?.error||(!loading?"Not enough validated candles":"")}</p>}
   </div>})}</div>
  <p className="mt-2 text-[10px] leading-4 text-slate-500">Context only, not a standalone signal. No fictitious confirmations; liquidity and MSS validation remain under development.</p>
 </section>;
}
