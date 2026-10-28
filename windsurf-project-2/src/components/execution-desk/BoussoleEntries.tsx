"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCcw, AlertTriangle, Bell, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { analyzeLiquidityStructure } from "@/lib/execution/liquidityStructure";

type Candle = {time:number;open:number;high:number;low:number;close:number};
type Proposal = {id:string;title:string;side:1|-1;entry:number;sl:number;tp:number;reason:string;type:"market"|"rebound"|"breakout"|"reversal";status?:string};
const n=(v:number)=>Number.isFinite(v)?v.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}):"—";
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
    if((side===1&&up||side===-1&&down) && (price-structural)*side>0 && (last.close-last.open)*side>0)push("market",label+" au marché",price,structural,"EMA alignées et dernière bougie clôturée dans le sens du mouvement · confirmation structurelle à vérifier",side);
    const pullback=side===1?Math.min(e50-.3*a,e20-a):Math.max(e50+.3*a,e20+a);
    if((side===1&&up||side===-1&&down) && (e20-pullback)*side>0)push("rebound",label+" sur rebond EMA20",e20,pullback,"Ordre limite théorique au repli EMA20 · attendre sweep / retest confirmé",side);
    const breakout=(side===1?high:low)+side*.1*a;
    if(side===1&&up||side===-1&&down)push("breakout",label+" sur cassure 20 bougies",breakout,breakout-side*1.5*a,"Ordre stop conditionnel au-delà du range 20 bougies + 0,1 ATR · retest du playbook non encore confirmé",side);
  }
  // Sweep reversal: opposite-direction conditional alternative, not an immediate order.
  const liquidity=analyzeLiquidityStructure(c);
  const event=liquidity.lastEvent;
  if(event && event.kind.endsWith("sweep")){
    const lookback=closed.slice(-12);
    const recent=closed.length&&event.time>=lookback[0].time;
    if(recent){
      const bearish=event.kind==="bearish-sweep";
      const side:1|-1=bearish?-1:1;
      const trigger=bearish?Math.min(...lookback.slice(-5).map(x=>x.low)):Math.max(...lookback.slice(-5).map(x=>x.high));
      const stop=bearish?Math.max(event.level,...lookback.map(x=>x.high))+.15*a:Math.min(event.level,...lookback.map(x=>x.low))-.15*a;
      const entry=trigger+side*.1*a,risk=Math.abs(entry-stop);
      if(risk>0 && Number.isFinite(risk)&&risk<8*a)opts.push({id:"reversal-"+side,title:bearish?"SELL · Liquidity reversal":"BUY · Liquidity reversal",side,entry,sl:stop,tp:entry+side*rr*risk,type:"reversal",reason:"Sweep récent identifié · attendre la rupture du niveau de déclenchement · scénario non confirmé",status:"conditional"});
    }
  }
  return {options:opts,trend,atr:a,price};
}
export default function BoussoleEntries(){
  const [tf,setTf]=useState("15m"),[data,setData]=useState<Candle[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState(false),[selected,setSelected]=useState<string|null>(null),[rr,setRr]=useState(2),[asOf,setAsOf]=useState("");
  const load=useCallback(async()=>{setBusy(true);setError("");try{const r=await fetch("/api/execution-desk/candles?tf="+tf,{cache:"no-store"});const j=await r.json();if(!r.ok||!Array.isArray(j.candles))throw Error(j.error||"No data");if(j.candles.length<220)throw Error(`Historique insuffisant : ${j.candles.length} bougies reçues, 220 minimum`);setData(j.candles);setAsOf(j.asOf||"");}catch(e){setError(e instanceof Error?e.message:"No data");setData([]);}finally{setBusy(false)}},[tf]);
  useEffect(()=>{void load();const t=setInterval(()=>void load(),300000);return()=>clearInterval(t)},[load]);
  const result=useMemo(()=>proposals(data,rr),[data,rr]);
  useEffect(()=>{if(selected&&!result.options.some(o=>o.id===selected))setSelected(null)},[result.options,selected]);
  const liquidity=useMemo(()=>analyzeLiquidityStructure(data),[data]);
  const candidates=useMemo(()=>{
    const event=liquidity.lastEvent;
    return result.options.map(p=>{
      const opposite=event && event.time>= (data.at(-14)?.time??Infinity) && (p.side===1?event.kind.startsWith("bearish"):event.kind.startsWith("bullish"));
      const aligned=event && event.time >=(data.at(-14)?.time??Infinity) && (p.side===1?event.kind.startsWith("bullish"):event.kind.startsWith("bearish"));
      const status=p.type==="reversal"?"Waiting for trigger":opposite?"Against liquidity":aligned?"Structure aligned":"Conditional";
      const priority=p.type==="reversal"?3:opposite?0:aligned?2:1;
      return {...p,status,priority};
    }).filter(p=>p.priority>0).sort((a,b)=>b.priority-a.priority).slice(0,3);
  },[result.options,liquidity,data]);
  const active=candidates.find(x=>x.id===selected);
  const [position,setPosition]=useState<{id:string;proposal:Proposal;actualEntry:number;startedAt:number;status:"active"|"closed";lastAlert:string}|null>(null);
  const [saving,setSaving]=useState(false);
  useEffect(()=>{let mounted=true;const supabase=createClient();void (async()=>{
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return;
    const {data:rows,error}=await supabase.from("execution_positions").select("*").eq("user_id",user.id).eq("status","open").order("committed_at",{ascending:false}).limit(1);
    if(!mounted||error||!rows?.length)return;
    const row=rows[0];
    setPosition({id:row.id,actualEntry:Number(row.entry),startedAt:Math.floor(new Date(row.committed_at).getTime()/1000),status:"active",lastAlert:"",proposal:{id:row.id,title:row.title,side:row.side as 1|-1,entry:Number(row.entry),sl:Number(row.sl),tp:Number(row.tp),reason:"Saved committed position",type:"reversal"}});
  })();return()=>{mounted=false}},[]);
  const closePosition=async()=>{
    if(!position)return;setSaving(true);
    const {error}=await createClient().from("execution_positions").update({status:"closed",closed_at:new Date().toISOString()}).eq("id",position.id);
    if(error){setError("Failed to close monitoring: "+error.message)}else {setPosition(null);setAlerts([]);setSeenAlerts([]);setDismissedAlerts([]);setSelected(null);}
    setSaving(false);
  };
  const commitPosition=async()=>{
    if(!commitCandidate||saving||position?.status==="active")return;
    const price=Number(entryInput);
    if(!(price>0))return;
    setSaving(true);setError("");
    const supabase=createClient();
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){setError("Please sign in to save this position");setSaving(false);return;}
    const proposal=commitCandidate;
    const {data:row,error}=await supabase.from("execution_positions").insert({user_id:user.id,symbol:"XAU/USD",side:proposal.side,title:proposal.title,timeframe:tf,entry:price,sl:proposal.sl,tp:proposal.tp,status:"open",reason:proposal.reason,source_candle_time:latest?.time??null}).select("id,committed_at").single();
    if(error||!row){setError("Could not save position: "+(error?.message??"unknown error"));setSaving(false);return;}
    setPosition({id:row.id,proposal,actualEntry:price,startedAt:Math.floor(new Date(row.committed_at).getTime()/1000),status:"active",lastAlert:""});
    setAlerts([]);setSeenAlerts([]);setDismissedAlerts([]);setCommitCandidate(null);setSaving(false);
  };
  const [commitCandidate,setCommitCandidate]=useState<Proposal|null>(null);
  const [entryInput,setEntryInput]=useState("");
  const [alerts,setAlerts]=useState<string[]>([]);
  const [notifyEnabled,setNotifyEnabled]=useState(false);
  const [showWatchlist,setShowWatchlist]=useState(false);
  const latest=data.at(-2);
  const fired=(p:Proposal)=>!!latest && (p.side===1?latest.high>=p.entry:latest.low<=p.entry);
  const pushAlert=useCallback((message:string)=>{
    setAlerts(current=>[message,...current].slice(0,6));
    if(typeof Notification!=="undefined" && Notification.permission==="granted") new Notification("PropEdge · Execution Desk",{body:message});
  },[]);
  const [seenAlerts,setSeenAlerts]=useState<string[]>([]);
  const [dismissedAlerts,setDismissedAlerts]=useState<string[]>([]);
  useEffect(()=>{
    if(!position?.id)return;
    try{
      const key="pe-position-alerts:"+position.id;
      setSeenAlerts(JSON.parse(sessionStorage.getItem(key)??"[]"));
      setDismissedAlerts(JSON.parse(sessionStorage.getItem(key+":dismissed")??"[]"));
      setAlerts([]);
    }catch{setSeenAlerts([]);setDismissedAlerts([]);setAlerts([]);}
  },[position?.id]);
  const dismissCurrentAlert=()=>{
    if(!position?.id||!alerts.length)return;
    const key="pe-position-alerts:"+position.id+":dismissed";
    const next=[...dismissedAlerts,alerts[0]];
    setDismissedAlerts(next);setAlerts(prev=>prev.slice(1));
    try{sessionStorage.setItem(key,JSON.stringify(next))}catch{}
  };
  useEffect(()=>{
    if(!position || position.status!=="active" || !latest)return;
    const p=position.proposal;
    const afterEntry=data.slice(0,-1).filter(c=>c.time>=position.startedAt);
    // A candle before entry must never trigger a stop or target alert.
    const all=afterEntry;
    const favorable=(latest.close-position.actualEntry)*p.side;
    const risk=Math.abs(position.actualEntry-p.sl);
    const progress=risk>0?favorable/risk:0;
    const events:string[]=[];
    if(all.some(c=>p.side===1?c.low<=p.sl:c.high>=p.sl))events.push("Stop-loss touched · check your broker");
    if(all.some(c=>p.side===1?c.high>=p.tp:c.low<=p.tp))events.push("Take-profit touched · check your broker");
    if(afterEntry.length && progress>=1)events.push("Trade reached +1R");
    else if(afterEntry.length && progress>=0.5)events.push("Trade reached +0.5R");
    const adverse=liquidity.lastEvent && liquidity.lastEvent.time>=position.startedAt &&
      (p.side===1?liquidity.lastEvent.kind.startsWith("bearish"):liquidity.lastEvent.kind.startsWith("bullish"));
    if(adverse)events.push("Opposing structure observed");
    const key="pe-position-alerts:"+position.id;
    let stored:string[]=[];
    try{stored=JSON.parse(sessionStorage.getItem(key)??"[]")}catch{}
    const fresh=events.filter(e=>!seenAlerts.includes(position.id+":"+e) && !stored.includes(position.id+":"+e));
    if(fresh.length){
      const merged=[...new Set([...stored,...fresh.map(e=>position.id+":"+e)])];
      try{sessionStorage.setItem(key,JSON.stringify(merged))}catch{}
      setSeenAlerts(merged);
      fresh.forEach(e=>pushAlert(e+" · Indicative Twelve Data candles; verify MT5 execution."));
    }
  },[latest?.time,position?.id,position?.startedAt,data,liquidity.lastEvent?.time,seenAlerts,pushAlert]);
  const currentR=position && latest ? (latest.close-position.actualEntry)*position.proposal.side/Math.abs(position.actualEntry-position.proposal.sl) : null;

  return <section className="rounded-2xl border border-white/10 bg-[#0c1325]/90 p-3 sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="text-base font-bold text-white">Trade opportunities</h2><p className="text-[11px] text-slate-400">Top conditional setups · XAU/USD</p></div>
      <div className="flex items-center gap-2">
        <select aria-label="Timeframe" value={tf} onChange={e=>{setTf(e.target.value);setSelected(null)}} className="rounded-lg border border-white/10 bg-[#182239] px-2 py-2 text-xs">{["5m","15m","30m","1h","4h"].map(t=><option key={t}>{t}</option>)}</select>
        <button onClick={()=>void load()} disabled={busy} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-cyan-400/30 px-3 text-xs font-semibold text-cyan-200"><RefreshCcw size={13} className={busy?"animate-spin":""}/> Refresh</button>
      </div>
    </div>
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
      <span>Close <b className="text-white">{n(result.price)}</b></span><span>ATR <b className="text-white">{n(result.atr)}</b></span><span>{result.trend}</span>
      <label className="ml-auto">R:R <select aria-label="Target ratio" value={rr} onChange={e=>setRr(Number(e.target.value))} className="rounded bg-[#182239] px-1 py-0.5">{[1.5,2,3].map(r=><option key={r} value={r}>1:{r}</option>)}</select></label>
    </div>
    {error&&<p role="alert" className="mt-3 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-200">{error}</p>}
    {position?.status==="active" && <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-emerald-400/30 bg-emerald-400/[.07] px-3 py-2.5">
      <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-wide text-emerald-300">● Active · {position.proposal.side===1?"BUY":"SELL"}</p><p className="truncate text-xs font-bold text-white">{position.proposal.title}</p></div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">{[{label:"Entry",value:n(position.actualEntry)},{label:"SL",value:n(position.proposal.sl)},{label:"TP",value:n(position.proposal.tp)},{label:"Move",value:currentR===null?"—":currentR.toFixed(2)+"R"}].map(x=><div key={x.label}><p className="text-[9px] text-slate-400">{x.label}</p><b className="text-xs tabular-nums text-white">{x.value}</b></div>)}</div>
      <button type="button" onClick={()=>void closePosition()} disabled={saving} className="min-h-9 rounded-lg border border-white/20 px-3 text-[11px]">End tracking</button>
    </div>}
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
      <button type="button" onClick={()=>setShowWatchlist(v=>!v)} className="min-h-9 rounded-lg border border-white/15 px-3 text-xs font-semibold text-slate-200">{showWatchlist?"Hide":"Show"} watchlist · {candidates.length}</button>
      <div className="flex items-center gap-3">
        {alerts.length>0 ? <div className="flex items-center gap-1"><span role="status" title={alerts[0]} className="max-w-52 truncate text-[11px] text-amber-300">● {alerts[0]}</span><button type="button" onClick={dismissCurrentAlert} aria-label="Dismiss this alert" title="Dismiss alert" className="rounded-md border border-white/20 p-1 text-slate-300"><X size={12}/></button></div> : <span className="text-[11px] text-slate-400">No new alerts · monitoring on page</span>}
        <button type="button" onClick={async()=>{if(typeof Notification!=="undefined"){const permission=await Notification.requestPermission();setNotifyEnabled(permission==="granted");}}} className="inline-flex min-h-9 items-center gap-1 text-[11px] text-cyan-200"><Bell size={13}/>{notifyEnabled?"Browser alerts on":"Enable alerts"}</button>
      </div>
    </div>
    {showWatchlist&&<>
    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">{candidates.map(p=><button key={p.id} onClick={()=>setSelected(selected===p.id?null:p.id)} className={"w-full rounded-xl border p-3 text-left "+(selected===p.id?"border-cyan-400/70 bg-cyan-500/[.08]":"border-white/10 bg-white/[.025]")}>
      <div className="flex items-center justify-between gap-2"><strong className="text-xs font-semibold text-white sm:text-sm">{p.title}</strong><span className={"shrink-0 text-[10px] font-bold "+(p.side===1?"text-emerald-300":"text-rose-300")}>{p.side===1?"BUY":"SELL"}</span></div>
      <p className="mt-1 text-[10px] text-amber-200">{p.status}</p>
      <div className="mt-3 grid grid-cols-3 gap-2">{[{key:"Entry",value:p.entry,style:"text-amber-200"},{key:"Stop",value:p.sl,style:"text-rose-300"},{key:"Target",value:p.tp,style:"text-emerald-300"}].map(x=><div key={x.key} className="min-w-0"><p className="text-[10px] text-slate-400">{x.key}</p><p className={"text-xs font-bold tabular-nums sm:text-sm "+x.style}>{n(x.value)}</p></div>)}</div>
      {selected===p.id&&<div className="mt-3 border-t border-white/10 pt-2"><p className="text-xs leading-5 text-slate-300">{p.reason}. Invalidation : {n(p.sl)}.</p><span className="mt-2 inline-block rounded-md border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-200">Select this setup to commit manually below</span></div>}
    </button>)}</div>
    </>}
    {active && position?.status!=="active" && <div className="mt-3 rounded-xl border border-white/10 bg-white/[.035] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold">Selected: {active.title}</p><p className="text-[11px] text-amber-200">{fired(active)?"Trigger level touched (not an executed order)":"Awaiting trigger · conditional setup"}</p></div><button type="button" onClick={()=>{setCommitCandidate(active);setEntryInput(String(active.entry));}} className="min-h-10 rounded-lg bg-cyan-600 px-4 text-xs font-bold text-white">Commit position</button></div>
    </div>}
    {commitCandidate && <div role="dialog" aria-modal="true" aria-label="Confirm manual position" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-3"><div className="w-full max-w-sm rounded-2xl border border-cyan-400/20 bg-[#101a2b] p-5 text-white"><div className="flex justify-between"><h3 className="text-lg font-bold">Confirm manual position</h3><button aria-label="Cancel" onClick={()=>setCommitCandidate(null)}><X size={20}/></button></div><p className="mt-2 text-xs text-slate-300">Commit means you already entered with your broker. This does not send an order.</p><label className="mt-4 block text-xs">Actual executed price<input type="number" step="any" min="0" value={entryInput} onChange={e=>setEntryInput(e.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-white/15 bg-slate-950 px-3 text-base"/></label><button type="button" disabled={saving || !(Number(entryInput)>0) || (commitCandidate.side===1?Number(entryInput)<=commitCandidate.sl:Number(entryInput)>=commitCandidate.sl)} onClick={()=>void commitPosition()} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold disabled:opacity-40"><Check size={16}/> Start monitoring</button></div></div>}
    {!busy&&!candidates.length&&<p className="mt-3 text-xs text-slate-400">No qualified setups to watch right now.</p>}

  </section>;
}
