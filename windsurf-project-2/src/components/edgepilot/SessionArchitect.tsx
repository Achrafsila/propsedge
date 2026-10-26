"use client";
import { useState } from "react";
import { Shield, Crosshair, RotateCcw } from "lucide-react";
import type { AccountRiskState } from "@/lib/analytics/aiCoach";

type Outcome = {risk:number; result:"win"|"loss"};
const money=(n:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n);
export function SessionArchitect({risk,kind}:{risk:AccountRiskState|null;kind:"challenge"|"funded"}) {
 const [divisor,setDivisor]=useState(5);
 const [fundedPercent,setFundedPercent]=useState(10);
 const [allocation,setAllocation]=useState<"concentrated"|"distributed">("distributed");
 const [rr,setRr]=useState(3);
 const [history,setHistory]=useState<Outcome[]>([]);
 const [riskPercent,setRiskPercent]=useState(100);
 const [feedbackOpen,setFeedbackOpen]=useState(false);
 const [phase,setPhase]=useState<"prepare"|"simulate"|"review">("prepare");
 const lossLimit=2;
 const buffer=risk?.maxBuffer??null;
 const daily=risk?.dailyBuffer??null;
 const valid=buffer!=null && daily!=null && buffer>0 && daily>0;
 const theoretical=buffer==null?0:kind==="challenge"?buffer/divisor:buffer*fundedPercent/100;
 const budget=valid?Math.min(theoretical,daily!,buffer!):0;
 const used=history.filter(h=>h.result==="loss").reduce((total,h)=>total+h.risk,0);
 const left=Math.max(0,budget-used);
 const losses=history.filter(h=>h.result==="loss").length;
 const pnl=history.reduce((total,h)=>total+(h.result==="win"?h.risk*rr:-h.risk),0);
 const stopped=history.length>=3||losses>=lossLimit||left<0.01;
 const maxNext=allocation==="concentrated"?left:Math.min(left,budget/3);
 const next=Math.min(left,maxNext*riskPercent/100);
 function reset(){setHistory([]);setRiskPercent(100);setFeedbackOpen(false);setPhase("prepare");}
 function add(result:"win"|"loss"){
  if(stopped||next<=0)return;
  const updated=[...history,{risk:next,result}];
  setHistory(updated);setRiskPercent(100);setFeedbackOpen(true);
  const lossCount=updated.filter(t=>t.result==="loss").length;
  const usedLoss=updated.filter(t=>t.result==="loss").reduce((sum,t)=>sum+t.risk,0);
  if(updated.length>=3||lossCount>=lossLimit||budget-usedLoss<0.01){setPhase("review");}
 }
 const button="rounded-lg border border-[#298DFF]/30 px-3 py-2 text-xs font-semibold text-[#B4D9FF] transition hover:bg-[#298DFF]/20";
 return <section className="rounded-2xl border border-[#298DFF]/25 bg-gradient-to-br from-[#101E32] to-[#0B1321] p-5 sm:p-6">
  <div className="flex flex-wrap justify-between gap-3"><div className="flex items-center gap-2"><Crosshair className="h-5 w-5 text-[#79BBFF]"/><div><h2 className="text-lg font-bold text-white">Session Architect</h2><p className="text-xs text-[#94A3B8]">Prepare · Simulate · Debrief</p></div></div><span className="rounded-full bg-[#298DFF]/10 px-3 py-1 text-xs font-bold text-[#9CCDFF]">{kind==="challenge"?"Challenge Attack":"Funded Protection"}</span></div>
  <div className="mt-4 flex gap-2">{["prepare","simulate","review"].map((s,i)=><div key={s} className={`flex-1 rounded-md px-2 py-2 text-center text-xs capitalize ${phase===s?"bg-[#298DFF]/25 text-[#BADDFF]":"bg-white/5 text-[#71829B]"}`}>{i+1}. {s}</div>)}</div>
  {!valid?<p className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/5 p-4 text-sm text-amber-200">A reliable session budget cannot be calculated: remaining daily and maximum loss buffers are both required. Verify the account rules first.</p>:phase==="prepare"?<div className="mt-5 space-y-4">
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-white/5 p-3"><p className="text-xs text-[#94A3B8]">Max DD buffer</p><p className="mt-1 font-bold text-white">{money(buffer!)}</p></div><div className="rounded-xl bg-white/5 p-3"><p className="text-xs text-[#94A3B8]">Daily buffer</p><p className="mt-1 font-bold text-white">{money(daily!)}</p></div><div className="rounded-xl border border-[#298DFF]/30 bg-[#298DFF]/10 p-3"><p className="text-xs text-[#9ECFFF]">Session budget</p><p className="mt-1 text-xl font-bold text-white">{money(budget)}</p></div></div>
    <div><p className="mb-2 text-xs font-semibold text-[#B5C6DA]">Strategy budget</p>{kind==="challenge"?<div className="flex gap-2">{[4,5].map(n=><button key={n} className={button+(divisor===n?" bg-[#298DFF]/20":"")} onClick={()=>setDivisor(n)}>DD ÷ {n}</button>)}</div>:<div className="flex items-center gap-3"><input aria-label="Funded percentage of max DD" type="range" min="2" max="20" step="1" value={fundedPercent} onChange={e=>setFundedPercent(Number(e.target.value))} className="flex-1 accent-[#298DFF]"/><span className="text-sm font-bold text-white">{fundedPercent}% of DD</span></div>}</div>
    <div><p className="mb-2 text-xs font-semibold text-[#B5C6DA]">Allocation</p><div className="flex flex-wrap gap-2"><button className={button+(allocation==="concentrated"?" bg-[#298DFF]/20":"")} onClick={()=>setAllocation("concentrated")}>A+ · One trade</button><button className={button+(allocation==="distributed"?" bg-[#298DFF]/20":"")} onClick={()=>setAllocation("distributed")}>Distributed · Up to 3</button></div></div>
    <div><p className="mb-2 text-xs font-semibold text-[#B5C6DA]">Reward target</p><div className="flex gap-2">{[2,3].map(n=><button key={n} className={button+(rr===n?" bg-[#298DFF]/20":"")} onClick={()=>setRr(n)}>1:{n}</button>)}</div></div>
    <p className="text-xs text-[#9EADC2]">Session rules: 3 trades maximum, stop after {lossLimit} losses or budget exhaustion. The full session allocation on one A+ setup carries high concentration risk.</p>
    <button disabled={!valid||budget<=0} onClick={()=>setPhase("simulate")} className="rounded-xl bg-[#298DFF] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">Launch simulation</button>
   </div>:phase==="simulate"?<div className="mt-5 space-y-4">
    <div className="grid grid-cols-3 gap-2">{[{k:"Trades",v:history.length+"/3"},{k:"Losses",v:losses+"/"+lossLimit},{k:"Loss room left",v:money(left)}].map(x=><div key={x.k} className="rounded-lg bg-white/5 p-3"><p className="text-xs text-[#94A3B8]">{x.k}</p><p className="mt-1 text-lg font-bold text-white">{x.v}</p></div>)}</div>
    <div className="flex gap-2">{[0,1,2].map(i=><div key={i} className="flex-1 rounded-lg bg-white/5 p-3 text-center text-xs text-[#CBD5E1]">{history[i]?history[i].result.toUpperCase():"TRADE "+(i+1)}</div>)}</div>
    {history.length>0&&feedbackOpen&&!stopped&&<div role="status" className="rounded-xl border border-[#298DFF]/30 bg-[#14304C] p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-[#9DCEFF]">EdgePilot · Trade {history.length} reviewed</p>
      <p className="mt-2 text-sm font-semibold text-white">{history[history.length-1].result==="win"?"Profit recorded — protect your discipline":"Loss recorded — reassess before continuing"}</p>
      <p className="mt-1 text-sm leading-relaxed text-[#BFD0E3]">{history[history.length-1].result==="win"?"The win does not increase your session risk allowance. Your next trade is optional; avoid forcing a setup.":`You have ${money(left)} of session loss room remaining. A second loss ends the session regardless of the remaining budget.`}</p>
      <button type="button" className="mt-3 rounded-lg bg-[#298DFF] px-4 py-2 text-xs font-bold text-white" onClick={()=>setFeedbackOpen(false)}>Assess next trade →</button>
      <button type="button" className="ml-2 rounded-lg border border-white/20 px-3 py-2 text-xs text-white" onClick={()=>setPhase("review")}>End and debrief</button>
    </div>}
    {stopped?<p className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">Session closed: {losses>=lossLimit?"two losses":history.length>=3?"three trades":"loss budget exhausted"}.</p>:!feedbackOpen&&<div className="rounded-xl bg-[#14263D] p-4"><p className="text-xs text-[#94A3B8]">Next hypothetical trade risk</p><p className="mt-1 text-2xl font-bold text-white">{money(next)}</p><p className="mb-3 text-xs text-[#9CADC3]">Potential gross reward at RR 1:{rr}: {money(next*rr)}</p><div className="mb-4 flex items-center gap-3"><label htmlFor="next-risk" className="text-xs text-[#9CADC3]">Allocate {riskPercent}% of available per-trade cap</label><input id="next-risk" type="range" min="10" max="100" step="10" value={riskPercent} onChange={e=>setRiskPercent(Number(e.target.value))} className="min-w-20 flex-1 accent-[#298DFF]"/></div><div className="flex gap-2"><button className="rounded-lg bg-emerald-600/25 px-4 py-2 text-sm font-semibold text-emerald-200" onClick={()=>add("win")}>Simulate win</button><button className="rounded-lg bg-red-600/25 px-4 py-2 text-sm font-semibold text-red-200" onClick={()=>add("loss")}>Simulate loss</button></div></div>}
    <div className="flex flex-wrap gap-2"><button className={button} onClick={()=>setPhase("review")}>Session debrief</button><button className={button} onClick={reset}><RotateCcw className="mr-1 inline h-3 w-3"/> Reset</button></div>
   </div>:<div className="mt-5 space-y-3"><p className="text-xs text-[#A5CFFF]">SESSION DEBRIEF</p><p className={`text-3xl font-bold ${pnl>=0?"text-emerald-300":"text-red-300"}`}>{pnl>=0?"+":""}{money(pnl)}</p><p className="text-sm text-[#CAD6E6]">{history.length} trades · {losses} losses · {money(left)} session loss room remaining.</p><div className="rounded-xl border border-[#298DFF]/25 bg-[#152941] p-4"><p className="text-xs font-bold uppercase tracking-wide text-[#9CCDFF]">Your session outcome</p><p className="mt-2 text-sm leading-relaxed text-[#D4E3F4]">{history.length===0?"No trades simulated yet.":pnl>0?"Positive simulated result. Do not increase your planned risk simply because the session was profitable.":pnl<0?"Negative simulated result. Preserve the remaining loss allowance and review entry quality before another session.":"Flat session. Evaluate decision quality rather than forcing additional trades."}</p></div><p className="text-sm text-[#94A3B8]">{losses>=lossLimit?"Your two-loss stop rule ended the session.":stopped?"Your session rules have closed further entries.":"You finished early, leaving risk capacity unused."} Risk concentration changes outcomes but does not increase win probability.</p><button className={button} onClick={reset}>Build another session</button></div>}
  <div className="mt-4 flex items-start gap-2 border-t border-white/10 pt-3"><Shield className="mt-0.5 h-4 w-4 shrink-0 text-[#6DA9E5]"/><p className="text-xs leading-relaxed text-[#8094B0]">Illustrative simulator only. Only realized simulated losses reduce the session loss budget; wins do not increase it; trading costs, open positions, live equity and trailing drawdown are not modeled. Never treat the calculation as an authorization to trade.</p></div>
 </section>;
}
