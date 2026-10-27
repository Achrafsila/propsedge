"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert, XCircle } from "lucide-react";

export type TrackedTrade = {
  id: string; symbol: "XAU/USD"; timeframe: string; side: 1 | -1;
  title: string; entry: number; sl: number; tp: number;
  committedAt: string; sourceCandleTime: number; initialReason: string;
};
type Candle = {time:number;open:number;high:number;low:number;close:number};
const fmt = (n:number) => n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
type DbPosition = {id:string;symbol:"XAU/USD";timeframe:string;side:1|-1;title:string;entry:number;sl:number;tp:number;committed_at:string;source_candle_time:number;reason:string};
const normalize = (p:DbPosition):TrackedTrade=>({id:p.id,symbol:p.symbol,timeframe:p.timeframe,side:p.side,title:p.title,entry:Number(p.entry),sl:Number(p.sl),tp:Number(p.tp),committedAt:p.committed_at,sourceCandleTime:p.source_candle_time,initialReason:p.reason});
export function useTrackedTrade() {
  const [trade,setTrade]=useState<TrackedTrade|null>(null);
  const [loaded,setLoaded]=useState(false);
  const [storageError,setStorageError]=useState("");
  useEffect(()=>{let cancelled=false;fetch('/api/execution-desk/positions',{cache:'no-store'}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||'Position storage unavailable');if(!cancelled)setTrade(j.position?normalize(j.position):null)}).catch(e=>{if(!cancelled)setStorageError(e instanceof Error?e.message:'Connection unavailable')}).finally(()=>{if(!cancelled)setLoaded(true)});return()=>{cancelled=true}},[]);
  const commit=async(next:TrackedTrade)=>{
    const r=await fetch('/api/execution-desk/positions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({symbol:next.symbol,timeframe:next.timeframe,side:next.side,title:next.title,entry:next.entry,sl:next.sl,tp:next.tp,reason:next.initialReason,source_candle_time:next.sourceCandleTime})});
    const j=await r.json();if(!r.ok)throw Error(j.error||'Commit failed');setTrade(normalize(j.position));
  };
  const close=async()=>{if(!trade)return;const r=await fetch('/api/execution-desk/positions',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:trade.id})});const j=await r.json();if(!r.ok)throw Error(j.error||'Close failed');setTrade(null)};
  return {trade,loaded,storageError,commit,close};
}

export default function LiveTradeCopilot({trade,candles,asOf,error,onClose}:{trade:TrackedTrade;candles:Candle[];asOf:string;error:string;onClose:()=>void|Promise<void>}) {
  const [confirmClose,setConfirmClose] = useState(false);
  const [closeError,setCloseError]=useState("");
  const closed = candles.length>1 ? candles[candles.length-2] : undefined;
  const timestamp = asOf ? Date.parse(asOf) : NaN;
  const age = Number.isFinite(timestamp) ? Date.now()-timestamp : Infinity;
  const timeframeMs:Record<string,number> = {"5m":300000,"15m":900000,"30m":1800000,"1h":3600000,"4h":14400000};
  const maxAge = Math.max(600000,(timeframeMs[trade.timeframe]||300000)*2);
  const fresh = !error && age>=0 && age<maxAge && !!closed && closed.time*1000>=Date.parse(trade.committedAt)-maxAge;
  const analysis=useMemo(()=>{
    if(!closed || candles.length<8) return null;
    const price=closed.close, risk=Math.abs(trade.entry-trade.sl);
    const r = (price-trade.entry)*trade.side/risk;
    const invalidated = trade.side===1 ? closed.close<=trade.sl : closed.close>=trade.sl;
    const target = trade.side===1 ? closed.close>=trade.tp : closed.close<=trade.tp;
    const adverse = trade.side===1 ? closed.low<=trade.sl : closed.high>=trade.sl;
    const reached = trade.side===1 ? closed.high>=trade.tp : closed.low<=trade.tp;
    const recent = candles.slice(-7,-1);
    const opposite = recent.length>=4 && (trade.side===1 ? recent.at(-1)!.close<Math.min(...recent.slice(0,-1).map(x=>x.low)) : recent.at(-1)!.close>Math.max(...recent.slice(0,-1).map(x=>x.high)));
    return {price,r,invalidated,target,adverse,reached,opposite};
  },[candles,closed,trade]);
  const validRisk=(trade.entry-trade.sl)*trade.side>0 && (trade.tp-trade.entry)*trade.side>0;
  return <section className="space-y-3 rounded-2xl border border-cyan-500/30 bg-[#0c1325]/90 p-4 sm:p-5" aria-label="Live position copilot">
    <header className="flex items-center justify-between gap-2"><div><p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-300">Position déclarée · Copilote</p><h2 className="text-lg font-bold text-white">{trade.side===1?"BUY":"SELL"} · {trade.title}</h2></div><span className="rounded-lg bg-cyan-400/10 px-2 py-1 text-[10px] text-cyan-200">Suivi à chaque mise à jour</span></header>
    <div className="grid grid-cols-3 gap-2 text-xs"><div className="rounded-xl bg-white/5 p-2">Entrée<br/><b>{fmt(trade.entry)}</b></div><div className="rounded-xl bg-white/5 p-2">SL<br/><b className="text-rose-300">{fmt(trade.sl)}</b></div><div className="rounded-xl bg-white/5 p-2">TP<br/><b className="text-emerald-300">{fmt(trade.tp)}</b></div></div>
    <p className="text-[11px] text-slate-400">Commit {new Date(trade.committedAt).toLocaleString()} · {trade.timeframe} · prix et niveaux figés au commit · aucun ordre broker envoyé.</p>
    {!fresh && <div role="alert" className="flex gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-100"><AlertTriangle size={16} className="shrink-0"/> Données absentes ou périmées : copilote suspendu. Aucune recommandation temps réel fiable tant que le flux n'est pas à jour.</div>}
    {!validRisk && <div role="alert" className="text-xs text-rose-300">Niveaux de risque incohérents : vérifie le setup enregistré.</div>}
    {fresh && validRisk && analysis && <div className="space-y-2 rounded-xl border border-white/10 bg-[#080f20] p-3 text-sm">
      <div className="flex justify-between gap-2"><span className="text-slate-400">Dernière clôture disponible</span><b>{fmt(analysis.price)}</b></div>
      <div className="flex justify-between gap-2"><span className="text-slate-400">Performance théorique</span><b className={analysis.r>=0?"text-emerald-300":"text-rose-300"}>{analysis.r>=0?"+":""}{analysis.r.toFixed(2)} R</b></div>
      {(analysis.adverse||analysis.reached) ? <div className="flex gap-2 text-amber-200"><ShieldAlert size={17} className="shrink-0"/><span>{analysis.adverse && analysis.reached ? "La bougie a traversé SL et TP : ordre intrabougie inconnu." : analysis.adverse ? "Le prix a touché ou traversé le SL théorique. Vérifie l'exécution sur ton broker." : "Le prix a touché ou traversé le TP théorique. Vérifie l'exécution sur ton broker."}</span></div> : analysis.invalidated ? <div className="flex gap-2 text-rose-300"><XCircle size={17} className="shrink-0"/><span>Clôture au-delà du stop structurel enregistré : scénario invalidé.</span></div> : analysis.target ? <div className="flex gap-2 text-emerald-300"><CheckCircle2 size={17}/><span>Objectif dépassé sur clôture : vérifie ton ordre réel.</span></div> : analysis.opposite ? <div className="flex gap-2 text-amber-200"><ShieldAlert size={17} className="shrink-0"/><span>Cassure récente contre la position. Réévalue la structure et le risque, sans déplacer automatiquement le SL.</span></div> : <div className="flex gap-2 text-slate-300"><CheckCircle2 size={17} className="shrink-0 text-cyan-300"/><span>Pas d'invalidation du SL détectée sur cette dernière clôture. Cela ne confirme pas à lui seul le setup.</span></div>}
    </div>}
    <p className="text-[11px] leading-5 text-slate-400">Surveillance indicative des bougies clôturées Twelve Data pendant que cette page est ouverte. Les fills, sorties partielles, spread, stops et TP réels ne sont pas synchronisés avec MT5. Ne remplace pas les protections configurées chez le broker.</p>
    {closeError&&<p role="alert" className="text-xs text-rose-300">{closeError}</p>}
    {!confirmClose ? <button className="w-full rounded-xl border border-white/15 px-3 py-2 text-sm text-slate-200 hover:bg-white/5" onClick={()=>setConfirmClose(true)}>Déclarer la clôture de la position</button> : <div className="flex gap-2"><button className="flex-1 rounded-xl border border-white/15 px-3 py-2 text-xs" onClick={()=>setConfirmClose(false)}>Annuler</button><button className="flex-1 rounded-xl bg-rose-500/20 px-3 py-2 text-xs text-rose-200" onClick={()=>{void Promise.resolve(onClose()).catch(e=>setCloseError(e instanceof Error?e.message:"Clôture impossible"))}}>Confirmer la clôture</button></div>}
  </section>;
}
