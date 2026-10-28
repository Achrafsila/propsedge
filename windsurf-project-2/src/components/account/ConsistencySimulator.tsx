"use client";
import {useState} from "react";
type Daily = Record<string,{pnl:number;trades:number}>;
const fmt=(n:number)=>Number.isFinite(n)?new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(n):"—";
export function ConsistencySimulator({daily,limit,target}:{daily:Daily;limit:number|null;target:number|null}){
 const [manualLimit,setManualLimit]=useState("");
 const effectiveLimit=limit??Number(manualLimit);
 return <div className="space-y-2">
   {limit===null && <section className="rounded-2xl border border-cyan-400/20 bg-[#0d1728] p-3 sm:p-4">
     <label className="block max-w-xs text-xs text-slate-300">Consistency limit (%)
       <input type="number" inputMode="decimal" min="1" max="99" step="0.1" value={manualLimit} onChange={e=>setManualLimit(e.target.value)} placeholder="e.g. 25" className="mt-1 min-h-11 w-full rounded-lg border border-white/20 bg-slate-950 px-3 text-base text-white"/>
     </label>
     <p className="mt-2 text-xs text-slate-400">Manual simulation value; your account rules are not changed.</p>
   </section>}
   {effectiveLimit>0 && effectiveLimit<100 ? <ConsistencyCalculator daily={daily} limit={effectiveLimit} target={target}/> : <p className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-400">Enter a limit between 1 and 99% to see the simulation.</p>}
 </div>;
}
function ConsistencyCalculator({daily,limit,target}:{daily:Daily;limit:number;target:number|null}){
 const today=new Date();const key=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
 const todayPnl=daily[key]?.pnl??0;
 const other=Object.entries(daily).filter(([date])=>date!==key);
 const priorNet=other.reduce((s,[,r])=>s+r.pnl,0);
 const priorBest=Math.max(0,...other.map(([,r])=>r.pnl));
 const total=priorNet+todayPnl;
 const best=Math.max(0,priorBest,todayPnl);
 const ratio=total>0?best/total*100:null;
 const fraction=limit/100;
 // Day cannot exceed limit of cumulative profit; if today is the best,
 // x <= limit * (priorNet+x), hence x <= limit*priorNet/(1-limit).
 const cap=priorNet>0&&fraction<1?fraction*priorNet/(1-fraction):null;
 const remaining=cap===null?null:Math.max(0,cap-todayPnl);
 const [plan,setPlan]=useState("100");
 const plannedGain=Math.max(0,Number(plan)||0);
 const futureToday=todayPnl+plannedGain;
 const futureTotal=priorNet+futureToday;
 const futureBest=Math.max(priorBest,futureToday,0);
 const futureRatio=futureTotal>0?100*futureBest/futureTotal:null;
 const required=target===null?null:Math.max(0,target-total);
 const toSatisfyPriorBest=priorBest>0?Math.max(0,priorBest/fraction-total):0;
 const allowed=futureRatio!==null&&futureRatio<=limit+1e-8;
 const recommended=remaining===null?null:Math.floor(remaining*0.8*100)/100;
 return <section className="rounded-2xl border border-cyan-400/20 bg-[#0d1728] p-3 sm:p-4">
  <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-base font-bold text-white">Consistency Planner</h2><p className="text-xs text-slate-400">Best day / net profit · current trading cycle</p></div><span className="rounded-full border border-cyan-400/25 px-3 py-1 text-xs font-bold text-cyan-200">Limit {limit}%</span></div>
  <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
   {[{label:"Best day",value:fmt(best)},{label:"Net cycle P&L",value:fmt(total)},{label:"Current consistency",value:ratio===null?"Not measurable":ratio.toFixed(1)+"%"},{label:"Target remaining",value:required===null?"Not configured":fmt(required)}].map(x=><div key={x.label} className="rounded-lg bg-white/[.04] p-2.5"><p className="text-[11px] text-slate-400">{x.label}</p><p className="mt-1 text-sm font-bold text-white">{x.value}</p></div>)}
  </div>
  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
    <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[.035] p-3"><p className="text-xs text-slate-400">Recommended additional profit today · 80% of ceiling</p><p className="mt-1 text-lg font-bold text-emerald-300">{recommended===null?"Not safely calculable":fmt(recommended)}</p></div>
    <div className="rounded-xl border border-amber-500/15 bg-amber-500/[.035] p-3"><p className="text-xs text-slate-400">Maximum additional profit today to stay within consistency</p><p className="mt-1 text-lg font-bold text-amber-200">{remaining===null?"Not safely calculable":fmt(remaining)}</p></div>
  </div>
  <div className="mt-3 flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-xs text-slate-300">Simulate additional profit today ($)<input type="number" min="0" step="1" value={plan} onChange={e=>setPlan(e.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-white/15 bg-slate-950 px-3 text-base text-white"/></label><div className="min-w-36 rounded-lg border border-white/10 p-2.5"><p className="text-[10px] text-slate-400">Projected consistency</p><p className={"text-lg font-bold "+(allowed?"text-emerald-300":"text-amber-300")}>{futureRatio===null?"—":futureRatio.toFixed(1)+"%"}</p></div></div>
  <p className="mt-2 text-xs leading-relaxed text-slate-300">{futureRatio===null?"A positive net cycle profit is required before the ratio is meaningful.":allowed?"Simulation stays within the selected consistency limit.":"Simulation exceeds the consistency limit; spread profits across more trading days."}</p>
  {toSatisfyPriorBest>0&&<p className="mt-1 text-xs text-amber-200">The previous best day requires {fmt(toSatisfyPriorBest)} more net profit across the cycle to restore consistency.</p>}
  {required!==null&&remaining!==null&&required>remaining&&<p className="mt-1 text-xs text-cyan-200">The remaining target cannot be reached today without exceeding the calculated ceiling; additional trading days may be necessary.</p>}
  <p className="mt-2 text-[10px] leading-relaxed text-slate-500">Simulation based on recorded closed trades and the common best-day / net-profit rule. Confirm your prop firm's exact rule, cutoff timezone and treatment of losses, fees and payouts. Not a broker order or guaranteed eligibility assessment.</p>
 </section>;
}
