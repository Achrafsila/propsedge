"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCcw, AlertTriangle } from "lucide-react";

type Candle = {time:number;open:number;high:number;low:number;close:number};
type Proposal = {id:string;title:string;side:1|-1;entry:number;sl:number;tp:number;reason:string;type:"market"|"rebound"|"breakout"};
const n=(v:number)=>v.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const ema=(arr:number[],len:number)=>{if(arr.length<len)return NaN;let value=arr.slice(0,len).reduce((a,b)=>a+b,0)/len;for(let i=len;i<arr.length;i++)value=value+(arr[i]-value)*2/(len+1);return value};
function atr(c:Candle[]){if(c.length<16)return NaN;let result=0;for(let i=1;i<=14;i++) result+=Math.max(c[i].high-c[i].low,Math.abs(c[i].high-c[i-1].close),Math.abs(c[i].low-c[i-1].close));result/=14;for(let i=15;i<c.length;i++){const t=Math.max(c[i].high-c[i].low,Math.abs(c[i].high-c[i-1].close),Math.abs(c[i].low-c[i-1].close));result=(result*13+t)/14}return result}
function proposals(c:Candle[],rr:number):{options:Proposal[];trend:string;atr:number;price:number} {
  if(c.length<220)return {options:[],trend:"Insufficient history",atr:NaN,price:NaN};
  // Only closed candles enter calculations. The feed's most recent candle may still be forming.
  const closed=c.slice(0,-1), last=closed[closed.length-1], price=last.close, a=atr(closed);
  const cs=closed.map(x=>x.close),e20=ema(cs,20),e50=ema(cs,50),e200=ema(cs,200);
  const up=e20>e50&&e50>e200,down=e20<e50&&e50<e200;
  const d:1|-1=up?1:down?-1:price>=e200?1:-1;
  const trend=up?"EMA aligned bullish":down?"EMA aligned bearish":"Mixed EMAs · directional preference only";
  const high=Math.max(...closed.slice(-20).map(x=>x.high)),low=Math.min(...closed.slice(-20).map(x=>x.low));
  const opts:Proposal[]=[];
  const push=(type:Proposal["type"],title:string,entry:number,sl:number,reason:string,side:1|-1=d)=>{
    const risk=Math.abs(entry-sl);if(!Number.isFinite(entry)||!Number.isFinite(sl)||risk<=0||(entry-sl)*side<=0)return;
    opts.push({id:type+"-"+side,title,side,entry,sl,tp:entry+side*rr*risk,reason,type});
  };
  // Boussole's approach: recent 20-bar breakout, EMA20 rebound, recent signal/market opportunity.
  // Expose both buy and sell scenarios as conditional alternatives; do not pretend all are confirmed.
  for(const side of [1,-1] as const){
    const label=side===1?"Achat":"Vente";
    const structural=side===1?Math.min(...closed.slice(-6).map(x=>x.low))-.2*a:Math.max(...closed.slice(-6).map(x=>x.high))+.2*a;
    if((price-structural)*side>0)push("market",label+" au marché",price,structural,"Prix de dernière bougie clôturée · scénario conditionnel, non exécuté",side);
    const pullback=side===1?Math.min(e50-.3*a,e20-a):Math.max(e50+.3*a,e20+a);
    if((e20-pullback)*side>0)push("rebound",label+" sur rebond EMA20",e20,pullback,"Ordre limite théorique au repli EMA20 · attendre confirmation du playbook",side);
    const breakout=(side===1?high:low)+side*.1*a;
    push("breakout",label+" sur cassure 20 bougies",breakout,breakout-side*1.5*a,"Ordre stop conditionnel au-delà du range 20 bougies + 0,1 ATR",side);
  }
  return {options:opts,trend,atr:a,price};
}
export default function BoussoleEntries(){
  const [tf,setTf]=useState("15m"),[data,setData]=useState<Candle[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState(false),[selected,setSelected]=useState<string|null>(null),[rr,setRr]=useState(2),[asOf,setAsOf]=useState("");
  const load=useCallback(async()=>{setBusy(true);setError("");try{const r=await fetch("/api/execution-desk/candles?tf="+tf,{cache:"no-store"});const j=await r.json();if(!r.ok||!Array.isArray(j.candles))throw Error(j.error||"No data");setData(j.candles);setAsOf(j.asOf||"");}catch(e){setError(e instanceof Error?e.message:"No data");setData([]);}finally{setBusy(false)}},[tf]);
  useEffect(()=>{void load();const t=setInterval(()=>void load(),300000);return()=>clearInterval(t)},[load]);
  const result=useMemo(()=>proposals(data,rr),[data,rr]);
  useEffect(()=>{if(selected&&!result.options.some(o=>o.id===selected))setSelected(null)},[result.options,selected]);
  const active=result.options.find(p=>p.id===selected)||null;
  return <section className="space-y-4 rounded-2xl border border-cyan-500/20 bg-[#0c1325]/90 p-4 sm:p-5">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-white">Entrées proposées</h2><p className="text-xs text-slate-400">XAU/USD spot · Twelve Data · bougies clôturées · actualisation toutes les 5 min</p></div><div className="flex gap-2"><select aria-label="Timeframe" className="rounded-lg border border-white/10 bg-[#182239] px-2 py-2 text-sm" value={tf} onChange={e=>{setTf(e.target.value);setSelected(null)}}>{["5m","15m","30m","1h","4h"].map(x=><option key={x}>{x}</option>)}</select><button onClick={()=>void load()} disabled={busy} className="flex items-center gap-2 rounded-lg border border-cyan-400/30 px-3 py-2 text-xs font-semibold text-cyan-200"><RefreshCcw size={13} className={busy?"animate-spin":""}/> Recalculer</button></div></header>
    {error&&<p role="alert" className="flex gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200"><AlertTriangle size={15}/>{error} · Aucun prix ni signal n'est inventé.</p>}
    <div className="space-y-3 rounded-xl border border-white/10 bg-[#080f20] p-3"><div className="flex flex-wrap justify-between gap-2 text-xs"><span>Dernière clôture Twelve Data : <b className="text-white">{n(result.price)}</b></span><span>{result.trend} · ATR14 : {n(result.atr)}</span></div><p className="text-[11px] text-amber-200">Les niveaux proviennent de Twelve Data. Le graphique TradingView intégré utilise une autre source et ne permet pas un tracé piloté depuis les cartes.</p></div>
      <div className="space-y-3"><div className="flex justify-between"><h3 className="font-semibold">Opportunités conditionnelles</h3><label className="text-xs text-slate-400">R:R <select aria-label="Target ratio" value={rr} onChange={e=>setRr(Number(e.target.value))} className="ml-1 rounded bg-[#182239] p-1">{[1.5,2,3].map(x=><option key={x} value={x}>1:{x}</option>)}</select></label></div>
        <p className="text-[11px] text-slate-400">Ces scénarios ne sont pas des signaux confirmés. Valide liquidité, structure, MSS et risque avec ton playbook avant toute exécution.</p>
        <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">{result.options.map(p=><button onClick={()=>setSelected(p.id)} key={p.id} className={"w-full rounded-xl border p-3 text-left transition "+(selected===p.id?"border-cyan-400 bg-cyan-500/10":"border-white/10 bg-white/[.03] hover:bg-white/[.07]")}><div className="flex items-center justify-between"><strong className="text-sm text-slate-100">{p.title}</strong><span className={"text-[10px] font-bold "+(p.side===1?"text-emerald-300":"text-rose-300")}>{p.side===1?"BUY":"SELL"}</span></div><p className="my-2 text-[11px] text-slate-400">{p.reason}</p><div className="grid grid-cols-3 gap-2 text-xs"><span>Entrée<br/><b className="text-amber-200">{n(p.entry)}</b></span><span>SL<br/><b className="text-rose-300">{n(p.sl)}</b></span><span>TP<br/><b className="text-emerald-300">{n(p.tp)}</b></span></div></button>)}</div>
        {active&&<div className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-3 text-xs text-cyan-100">Sélection : {active.title} · Entrée {n(active.entry)} · SL {n(active.sl)} · TP {n(active.tp)}. Utilise les outils Position longue / courte du graphique pour les reporter.</div>}
        {!result.options.length&&!busy&&<p className="text-sm text-slate-400">Aucune proposition calculable pour le moment.</p>}
      </div>
    <footer className="flex flex-wrap justify-between gap-2 text-[11px] text-slate-500"><span>Recalcul basé sur 300 bougies OHLC · EMA20/50/200 · ATR14 · range 20 bougies.</span><span>{asOf?"Dernière requête : "+new Date(asOf).toLocaleTimeString():"En attente des cours"}</span></footer>
  </section>;
}
