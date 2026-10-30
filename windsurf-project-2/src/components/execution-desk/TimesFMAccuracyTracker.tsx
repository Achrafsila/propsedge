"use client";
import { useCallback, useEffect, useState } from "react";

export type ForecastRecord = {
  id: string; baseTime: number; baseClose: number;
  predictions: number[]; lower: number[]; upper: number[];
  savedAt: number;
};
type Bar = { time: number; close: number };
const STORE = "propsedge:timesfm:shadow:v1";
const STEPS = [3,6,12] as const;
const fmt = (n:number) => n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});

function load(): ForecastRecord[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) || "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter((x):x is ForecastRecord => !!x && typeof x === "object" &&
      typeof x.id === "string" && Number.isFinite(x.baseTime) &&
      Number.isFinite(x.baseClose) && Array.isArray(x.predictions) &&
      x.predictions.length === 12 && x.predictions.every((n:unknown)=>typeof n==="number"&&Number.isFinite(n)))
      .slice(0,100);
  } catch { return []; }
}
export function recordForecast(f:{lastClosedCandleAt:string;lastClose:number;predictions:number[];lowerBand:number[];upperBand:number[]}) {
  const baseTime = Date.parse(f.lastClosedCandleAt);
  if (!Number.isFinite(baseTime) || f.predictions.length!==12 || !f.predictions.every(Number.isFinite)) return;
  const old = load();
  // One immutable forecast per completed candle: a recalculation never overwrites history.
  if (old.some(x=>x.baseTime===baseTime)) return;
  const entry:ForecastRecord = {
    id:String(baseTime), baseTime, baseClose:f.lastClose,
    predictions:[...f.predictions], lower:[...f.lowerBand], upper:[...f.upperBand],
    savedAt:Date.now()
  };
  try { localStorage.setItem(STORE,JSON.stringify([entry,...old].slice(0,100))); } catch {}
  window.dispatchEvent(new Event("timesfm-shadow-saved"));
}

function actualFor(bars:Bar[], base:number, step:number):number|null {
  const target = base + (step+1)*300000;
  // Twelve Data time is candle OPEN. Forecast starts after base candle closes. Evaluate only a fully closed candle,
  // comparing its closing price to the forecast at the matching horizon.
  const bar = bars.find(x=>x.time*1000===base+step*300000);
  return bar && Date.now()>=target && Number.isFinite(bar.close)?bar.close:null;
}
export default function TimesFMAccuracyTracker() {
  const [records,setRecords]=useState<ForecastRecord[]>([]);
  const [bars,setBars]=useState<Bar[]>([]);
  const [error,setError]=useState("");
  const reloadRecords=useCallback(()=>setRecords(load()),[]);
  const refresh=useCallback(async()=>{
    try {
      const res=await fetch("/api/execution-desk/candles?tf=5m",{cache:"no-store"});
      const json=await res.json();
      if(!res.ok || !Array.isArray(json.candles)) throw new Error("Bougies indisponibles");
      setBars(json.candles.filter((x:Bar)=>Number.isFinite(x.time)&&Number.isFinite(x.close)));
      setError("");
    } catch {setError("Données d'évaluation indisponibles");}
  },[]);
  useEffect(()=>{
    reloadRecords();void refresh();
    const onSave=()=>{reloadRecords();void refresh();};
    window.addEventListener("timesfm-shadow-saved",onSave);
    const interval=setInterval(()=>void refresh(),300000);
    return()=>{window.removeEventListener("timesfm-shadow-saved",onSave);clearInterval(interval);};
  },[reloadRecords,refresh]);
  const latest=records[0];
  const now=Date.now();
  const status=!latest?"NO DATA":now < latest.baseTime+600000?"ACTIVE":
    now > latest.baseTime+3900000 && STEPS.every(s=>actualFor(bars,latest.baseTime,s)!==null)?"EVALUATED":
    now>latest.baseTime+3900000?"EXPIRED / DATA PENDING":
    bars.length && bars[bars.length-1].time*1000 < latest.baseTime?"STALE":"ACTIVE";
  const evaluated=records.flatMap(r=>STEPS.map(h=>{
    const actual=actualFor(bars,r.baseTime,h);
    return actual===null?null:{h,actual,predicted:r.predictions[h-1],base:r.baseClose};
  }).filter((v):v is {h:3|6|12;actual:number;predicted:number;base:number}=>v!==null));
  const mae=(h:number)=>{const v=evaluated.filter(x=>x.h===h);return v.length? v.reduce((a,b)=>a+Math.abs(b.actual-b.predicted),0)/v.length:null;};
  const direction=(h:number)=>{const v=evaluated.filter(x=>x.h===h && x.predicted!==x.base && x.actual!==x.base);return v.length? v.filter(x=>Math.sign(x.predicted-x.base)===Math.sign(x.actual-x.base)).length/v.length*100:null;};
  return <section className="rounded-2xl border border-white/10 bg-[#0c1325]/85 p-4 text-slate-100" aria-label="Forecast accuracy tracking">
    <div className="flex flex-wrap justify-between gap-2">
      <div><h3 className="text-sm font-semibold">Forecast vs Reality</h3><p className="mt-1 text-xs text-slate-400">Prévisions figées · clôtures réelles Twelve Data · historique local au navigateur</p></div>
      <span className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold text-slate-300">{status}</span>
    </div>
    {error && <p role="status" className="mt-3 text-xs text-amber-300">{error}</p>}
    {latest ? <>
      <p className="mt-3 text-xs text-slate-400">Snapshot: {new Date(latest.baseTime).toLocaleString()} · base {fmt(latest.baseClose)}</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {STEPS.map(h=>{
          const observed=actualFor(bars,latest.baseTime,h);
          const target=latest.predictions[h-1];
          const due=new Date(latest.baseTime+(h+1)*300000);
          const pending=now<due.getTime();
          const mismatch=observed!==null ? observed-target : null;
          return <div key={h} className="rounded-xl border border-white/10 bg-white/[.04] p-3">
            <p className="text-xs font-semibold">{h*5} min · {pending?"ACTIVE":observed===null?"DATA PENDING":"EVALUATED"}</p>
            <p className="mt-2 text-xs text-slate-400">Prévision : {fmt(target)}</p>
            <p className="text-xs text-slate-300">Réel : {observed===null?"—":fmt(observed)}</p>
            <p className="text-xs text-slate-400">Erreur : {mismatch===null?"—":fmt(Math.abs(mismatch))}</p>
            <p className="mt-2 text-[10px] text-slate-500">Échéance : {due.toLocaleTimeString()}</p>
          </div>;
        })}
      </div>
    </>:<p className="mt-3 text-xs text-slate-500">Calcule une première prévision pour activer le suivi.</p>}
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
      {STEPS.map(h=><div key={h} className="rounded-lg bg-white/[.03] p-3">
        <p className="text-[11px] text-slate-400">Accuracy · {h*5} min</p>
        <p className="mt-1 text-sm font-semibold">{mae(h)===null?"—":`MAE ${fmt(mae(h)!)}`}</p>
        <p className="text-xs text-slate-400">Direction : {direction(h)===null?"—":`${direction(h)!.toFixed(0)}%`} · n={evaluated.filter(x=>x.h===h).length}</p>
      </div>)}
    </div>
    <p className="mt-3 text-[10px] text-slate-500">Historique conservé sur cet appareil uniquement (100 snapshots max). Les horizons non échus ou sans bougie correspondante ne sont jamais évalués. Les anciennes prévisions ne sont pas reconstituées.</p>
  </section>;
}
