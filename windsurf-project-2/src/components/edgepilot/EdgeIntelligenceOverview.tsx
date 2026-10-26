"use client";
import { BrainCircuit, Fingerprint, ShieldCheck, Target, Sparkles, ArrowRight, AlertTriangle } from "lucide-react";
import type { AccountBriefing, AccountRiskState, AICoachOutput } from "@/lib/analytics/aiCoach";
import type { TraderIdentity } from "@/lib/analytics/traderIdentity";
import type { TraderHabits } from "@/lib/analytics/traderHabits";
import type { DataConfidence } from "@/lib/analytics/dataConfidence";
import type { TraderEdge } from "@/lib/analytics/traderEdge";
import type { TraderBlindSpots } from "@/lib/analytics/traderBlindSpots";
import { EdgePilotAvatar } from "@/components/edgepilot/EdgePilotAvatar";
import type { Decision } from "@/lib/analytics/decisionEngine";

const money = (n:number) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n);
const card = "rounded-2xl border border-white/10 bg-[#0D1420] p-5";
export function EdgeIntelligenceOverview({briefing,decision,risk,coach,confidence,identity,habits,edge,blindSpots,accountOptions,selectedAccountKey,onSelectAccount}:{
 briefing:AccountBriefing|null; decision:Decision|null; risk:AccountRiskState|null; coach:AICoachOutput;
 confidence:DataConfidence; identity:TraderIdentity; habits:TraderHabits; edge:TraderEdge; blindSpots:TraderBlindSpots;
 accountOptions:{key:string;name:string;kind:string}[];selectedAccountKey:string;onSelectAccount:(key:string)=>void;
}) {
 const reliable = confidence.totalTrades>=20 && confidence.activeDays>=5;
 const buffers = [risk?.dailyBuffer,risk?.maxBuffer].filter((v):v is number=>v!=null);
 const tightest = buffers.length ? Math.min(...buffers) : null;
 const prioritised = [...coach.propRuleAlerts, ...coach.accountAlerts, ...coach.behaviouralInsights, ...coach.payoutReadiness]
   .filter(item => item.severity === "critical" || item.severity === "warning");
 const guidance = prioritised.slice(0, 2);
 const evidence = coach.behaviouralInsights.find(item => item.evidence)?.evidence;
 const riskRationale = coach.recommendedRisk.rationale;
 return <div className="space-y-4 pb-8">
  <header className="relative isolate overflow-hidden rounded-2xl border border-[#298DFF]/20 bg-gradient-to-r from-[#102A48] via-[#0D1C32] to-[#080F1C] p-5 sm:p-6">
   <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_45%,rgba(41,141,255,0.22),transparent_60%)]"/>
   <div className="relative grid items-center gap-4 md:grid-cols-[160px_minmax(0,1fr)_auto]">
    <div className="flex justify-center md:justify-start"><EdgePilotAvatar state={decision==="STOP"?"critical":decision==="TRADE_REDUCED"?"recovery":"confident"} size={152} priority /></div>
    <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#72B5FF]">Personal trading intelligence</p><h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white">Prop <span className="text-[#6BAFFF]">Intelligence</span></h1><p className="mt-1 text-sm text-[#94A3B8]">Your risk, behaviour and next action — in one place.</p></div>
   <div className="rounded-xl border border-[#298DFF]/30 bg-[#298DFF]/10 px-4 py-3 text-right"><p className="text-xs text-[#94A3B8]">Data confidence</p><p className="text-2xl font-bold text-[#8BC2FF]">{confidence.score}%</p><p className="text-xs text-[#94A3B8]">{confidence.totalTrades} trades · {confidence.activeDays} days</p></div>
   </div>
  </header>
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0D1420] px-4 py-3">
   <div><p className="text-xs font-bold text-white">Account context</p><p className="text-xs text-[#94A3B8]">Session planning and risk adapt to the selected account</p></div>
   <select aria-label="Select trading account" value={selectedAccountKey} onChange={e=>onSelectAccount(e.target.value)} className="min-w-52 rounded-lg border border-[#298DFF]/30 bg-[#14253A] px-3 py-2 text-sm text-white">
    {accountOptions.length===0?<option value="">No active accounts</option>:accountOptions.map(a=><option key={a.key} value={a.key}>{a.name} · {a.kind}</option>)}
   </select>
  </div>
  <section className={card}>
   <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-[#72B5FF]"/><h2 className="text-lg font-bold text-white">Daily Decision Brief</h2></div><span className="rounded-full border border-[#298DFF]/30 bg-[#298DFF]/10 px-3 py-1 text-sm font-bold text-[#8BC2FF]">{decision?.replaceAll("_"," ") ?? "NO ACCOUNT"}</span></div>
   <p className="mt-1 text-xs text-[#94A3B8]">{briefing ? briefing.account.name+" · "+briefing.modeLabel : "No active account available"}</p>
   <div className="mt-4 grid gap-3 sm:grid-cols-3">
    <div className="rounded-xl bg-white/[0.04] p-3"><p className="text-xs text-[#94A3B8]">Estimated tightest buffer</p><p className="mt-1 text-xl font-bold text-white">{tightest===null?"Unavailable":money(tightest)}</p></div>
    <div className="rounded-xl bg-white/[0.04] p-3"><p className="text-xs text-[#94A3B8]">Suggested risk / trade</p><p className="mt-1 text-xl font-bold text-white">{coach.recommendedRisk.amount===null?"—":money(coach.recommendedRisk.amount)}</p></div>
    <div className="rounded-xl bg-white/[0.04] p-3"><p className="text-xs text-[#94A3B8]">Account health</p><p className="mt-1 text-xl font-bold text-white">{briefing?.healthLabel??"Unknown"}</p></div>
   </div>
   <div className="mt-4 border-l-2 border-[#298DFF] pl-4"><p className="text-xs font-bold uppercase tracking-wider text-[#8BC2FF]">Next best action</p><p className="mt-1 text-sm leading-relaxed text-[#DFE8F5]">{briefing?coach.nextBestAction:"Add an account and a trading plan to generate a contextual assessment."}</p></div>
   <p className="mt-3 text-xs text-[#64748B]">Calculated from recorded trades, not live equity or open positions. Confirm daily, trailing and other prop firm rules independently.</p>
  </section>
  <section className="rounded-2xl border border-[#298DFF]/25 bg-gradient-to-br from-[#11243A] to-[#0B1422] p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Fingerprint className="h-5 w-5 text-[#78BAFF]"/><h2 className="text-lg font-bold text-white">Your Trader DNA</h2></div><span className="rounded-full border border-[#298DFF]/30 px-3 py-1 text-xs font-semibold text-[#9DCFFF]">{reliable?"Emerging profile":"Early signal · provisional"}</span></div>
    <p className="mt-2 text-sm text-[#AEBED2]">Your trading identity, preferred markets, sessions and actual behavioural patterns.</p>
    <div className="mt-4 rounded-xl border border-[#298DFF]/20 bg-[#17304D]/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#8FC6FF]">Trading archetype</p>
      <h3 className="mt-1 text-2xl font-extrabold text-white">{identity.tradingStyle==="Not enough data"?"Profile forming":identity.tradingStyle}</h3>
      <p className="mt-1 text-xs leading-relaxed text-[#AEBED2]">{reliable?identity.tradingStyleExplanation:"Provisional classification based on "+confidence.totalTrades+" trades across "+confidence.activeDays+" days. An archetype is not yet validated."}</p>
    </div>
    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[{label:"Average holding time",value:habits.averageHoldingTime,detail:habits.averageHoldingTimeExplanation},
        {label:"Session profile",value:identity.sessionProfile,detail:"Where your recorded trading activity clusters"},
        {label:"Market specialization",value:identity.marketSpecialization,detail:"Current instrument concentration"},
        {label:"Execution pace",value:habits.executionPace,detail:habits.executionPaceExplanation}].map(item=><div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3"><p className="text-xs text-[#94A3B8]">{item.label}</p><p className="mt-2 text-lg font-bold leading-tight text-white">{item.value}</p><p className="mt-2 text-xs leading-relaxed text-[#8E9FB5]">{item.detail}</p></div>)}
    </div>
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-white/10 bg-[#101B2B] p-4"><p className="text-sm font-bold text-white">Your sessions</p><p className="mt-1 text-xs text-[#94A3B8]">Activity share — not profitability</p><div className="mt-3 space-y-2">{identity.sessionDistribution.length ? identity.sessionDistribution.map((session,i)=><div key={i} className="flex justify-between gap-2 text-xs text-[#CBD5E1]"><span>{session.session} · {session.percentage}%</span></div>):<p className="text-xs text-[#94A3B8]">No session data recorded.</p>}</div></div>
      <div className="rounded-xl border border-white/10 bg-[#101B2B] p-4"><p className="text-sm font-bold text-white">Performance by session</p><p className="mt-1 text-xs text-[#94A3B8]">Based on trade expectancy</p>{reliable&&edge.bestSession.sampleSize>0?<><p className="mt-3 text-xl font-bold text-emerald-300">{edge.bestSession.value}</p><p className="mt-2 text-sm text-[#CBD5E1]">{edge.bestSession.metricLabel}</p><p className="mt-2 text-xs text-[#94A3B8]">{edge.bestSession.narrative}</p></>:<p className="mt-3 text-sm leading-relaxed text-[#9BAEC6]">Not enough independent trading history to identify a reliable most-profitable session. Activity and profitability are different measures.</p>}</div>
    </div>
  </section>
  <div className="grid gap-4 lg:grid-cols-2">
   <section className={card}><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#72B5FF]"/><h2 className="font-bold text-white">Risk & Discipline</h2></div><div className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-2"><span className="text-[#94A3B8]">Daily loss buffer</span><strong className="text-white">{risk?.dailyBuffer==null?"Unavailable":money(risk.dailyBuffer)}</strong></div><div className="flex justify-between gap-2"><span className="text-[#94A3B8]">Max loss buffer</span><strong className="text-white">{risk?.maxBuffer==null?"Unavailable":money(risk.maxBuffer)}</strong></div><div className="flex justify-between gap-2"><span className="text-[#94A3B8]">Behavioural evidence</span><strong className="text-white">{reliable?"Reviewable":"Insufficient"}</strong></div></div></section>
  </div>
  {reliable&&<section className={card}><div className="flex items-center gap-2"><Target className="h-5 w-5 text-[#72B5FF]"/><h2 className="font-bold text-white">Performance Intelligence</h2></div><div className="mt-4 grid gap-4 md:grid-cols-2"><div><p className="text-xs text-[#94A3B8]">Potential edge</p><p className="mt-1 font-semibold text-white">{edge.bestSetup.value}</p></div><div><p className="text-xs text-[#94A3B8]">Evidence-based weakness</p><p className="mt-1 font-semibold text-white">{blindSpots.biggestLeak.value}</p></div></div></section>}
  <section className="rounded-2xl border border-[#298DFF]/25 bg-gradient-to-br from-[#101F33] to-[#0C1522] p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-[#83BFFF]"/><h2 className="text-lg font-bold text-white">Your Intelligence Brief</h2></div>
      <span className="rounded-full border border-[#298DFF]/30 bg-[#298DFF]/10 px-3 py-1 text-xs font-medium text-[#A1CFFF]">Data-driven coaching</span>
    </div>
    <p className="mt-1 text-xs text-[#94A3B8]">What deserves your attention, why it matters, and what to do next.</p>
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-white/10 bg-[#101927] p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-[#79B9FF]">Coach assessment</p>
        <p className="mt-2 text-base font-semibold leading-relaxed text-white">{briefing ? coach.mainPriority : "Start with your first trading account"}</p>
        <p className="mt-2 text-sm leading-relaxed text-[#B2C0D3]">{briefing ? coach.summary : "Add a trading account and record trades to unlock account-specific recommendations."}</p>
        {briefing && <div className="mt-4 border-t border-white/10 pt-3"><p className="text-xs font-semibold text-[#94A3B8]">Why this risk level?</p><p className="mt-1 text-sm leading-relaxed text-[#CBD5E1]">{riskRationale}</p></div>}
      </div>
      <div className="rounded-xl border border-white/10 bg-[#101927] p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-[#79B9FF]">Your action plan</p>
        <div className="mt-3 space-y-4">
          <div className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#298DFF]/20 text-xs font-bold text-[#8BC2FF]">1</span><div><p className="text-sm font-semibold text-white">Protect the account</p><p className="mt-1 text-sm leading-relaxed text-[#B2C0D3]">{briefing ? coach.nextBestAction : "Configure your account's risk limits before trading."}</p></div></div>
          <div className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#298DFF]/20 text-xs font-bold text-[#8BC2FF]">2</span><div><p className="text-sm font-semibold text-white">{reliable ? "Review your execution patterns" : "Build independent trading observations"}</p><p className="mt-1 text-sm leading-relaxed text-[#B2C0D3]">{reliable ? "Verify whether your best setup repeats across different trading days before increasing risk." : "Record each trade with its session, setup and result. A small profitable sample is not evidence of a repeatable advantage."}</p></div></div>
        </div>
      </div>
    </div>
    {guidance.length>0 && <div className="mt-4 grid gap-3 md:grid-cols-2">{guidance.map((item,index)=><div key={index} className="rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-4"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-400"/><p className="text-sm font-semibold text-white">{item.title}</p></div><p className="mt-2 text-xs leading-relaxed text-[#B2C0D3]">{item.message}</p>{item.evidence && <p className="mt-2 text-xs text-[#94A3B8]">Evidence: {item.evidence}</p>}{item.action && <p className="mt-2 flex gap-2 text-xs font-medium leading-relaxed text-[#B7D9FF]"><ArrowRight className="h-4 w-4 shrink-0"/>{item.action}</p>}</div>)}</div>}
    {!reliable && <p className="mt-4 text-xs leading-relaxed text-[#94A3B8]">{evidence || "Behavioural conclusions remain provisional until enough independent trading history is available."}</p>}
    <p className="mt-4 border-t border-white/10 pt-3 text-xs text-[#71839A]">Recommendations are produced by existing deterministic engines, not a live AI conversation. Confirm real-time positions and prop firm rules independently.</p>
  </section>
 </div>;
}
