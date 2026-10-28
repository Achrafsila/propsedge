"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, DollarSign, ShieldAlert, Users, ChevronDown, TrendingUp, Target, Trophy, Crown, Medal, Sparkles } from "lucide-react";
import { useTeams } from "@/lib/teams/useTeams";
import { createClient } from "@/lib/supabase/client";
import { useTeamShares } from "@/lib/teams/useTeamShares";
import { useSharedAccountSummaries } from "@/lib/teams/useSharedAccountSummaries";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
const card = "min-w-0 rounded-xl border border-slate-400/[0.08] bg-[#101a2d]/90 backdrop-blur-xl p-3 sm:p-5";

function TeamPerformance({ teamId }: { teamId: string }) {
  const { shares, error: shareError } = useTeamShares(teamId);
  const { accounts, error: accountError } = useSharedAccountSummaries(shares);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    setMemberNames({});
    createClient().rpc("get_team_member_profiles", { p_team_id: teamId })
      .then(({data,error}) => {
        if (!active) return;
        if (error) { console.warn("Unable to resolve team member display names"); return; }
        const names: Record<string, string> = {};
        for (const member of (data ?? []) as {user_id:string;display_name:string}[]) {
          names[member.user_id] = member.display_name?.trim() || "Trader";
        }
        setMemberNames(names);
      });
    return () => { active = false; };
  }, [teamId]);
  const traderName = (id:string) => memberNames[id] || "Team trader";
  const visibleAccounts = accounts;
  const stats = useMemo(() => {
    const unique = Array.from(new Map(visibleAccounts.map(a => [`${a.type}:${a.id}:${a.ownerId}`, a])).values());
    const trades = unique.flatMap(a => a.trades);
    const payouts = unique.flatMap(a => a.payouts);
    const pnl = trades.reduce((sum, t) => sum + t.pnl, 0);
    const received = payouts.filter(p => p.status === "paid").reduce((sum, p) => sum + p.received, 0);
    const wins = trades.filter(t => t.pnl > 0).length;
    const byTrader = new Map<string, { ownerId: string; capital: number; pnl: number; payouts: number; accounts: number; trades: number; wins: number; costs: number; costsComplete: boolean; funded: number; paidFunded: number }>();
    for (const account of unique) {
      const entry = byTrader.get(account.ownerId) ?? { ownerId: account.ownerId, capital: 0, pnl: 0, payouts: 0, accounts: 0, trades: 0, wins: 0, costs: 0, costsComplete: true, funded: 0, paidFunded: 0 };
      entry.capital += account.size;
      entry.accounts++;
      const billable = (account.type === "challenge" && !account.parentChallengeId) || (account.type === "funded" && account.fundingPath !== "evaluation");
      if (billable && account.purchaseCost === null) entry.costsComplete = false;
      if (account.type === "funded" && account.fundingPath === "evaluation" && !unique.some(c => c.type === "challenge" && c.ownerId === account.ownerId && ((!c.parentChallengeId && c.id === account.sourceChallengeId) || (!c.parentChallengeId && unique.some(step => step.parentChallengeId === c.id && step.id === account.sourceChallengeId))))) entry.costsComplete = false;
      if (billable) entry.costs += account.purchaseCost ?? 0;
      if (account.type === "funded") {
        entry.funded++;
        if (account.payouts.some(p => p.status === "paid")) entry.paidFunded++;
      }
      entry.pnl += account.trades.reduce((sum, t) => sum + t.pnl, 0);
      entry.trades += account.trades.length;
      entry.wins += account.trades.filter(t => t.pnl > 0).length;
      entry.payouts += account.payouts.filter(p => p.status === "paid").reduce((sum, p) => sum + p.received, 0);
      byTrader.set(account.ownerId, entry);
    }
    return { unique, trades, pnl, received, wins, capital: unique.reduce((sum, a) => sum + a.size, 0), traders: [...byTrader.values()] };
  }, [visibleAccounts]);
  const [ranking, setRanking] = useState<"pnl" | "roi" | "payouts" | "accounts">("pnl");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [propRanking, setPropRanking] = useState<"roi" | "payouts">("roi");
  // Mirror Personal ROI rules: root challenges once; non-evaluation funded
  // costs separately. Only explicitly shared records are considered.
  const roots = stats.unique.filter(a => a.type === "challenge" && !a.parentChallengeId);
  const challengeRows = stats.unique.filter(a => a.type === "challenge");
  const fundedRows = stats.unique.filter(a => a.type === "funded");
  const billable = [...roots, ...fundedRows.filter(a => a.fundingPath !== "evaluation")];
  const evaluationFundedWithMissingSource = fundedRows.filter(a => a.fundingPath === "evaluation" && !challengeRows.some(c =>
    c.ownerId === a.ownerId && ((!c.parentChallengeId && c.id === a.sourceChallengeId) || (!c.parentChallengeId && stats.unique.some(step => step.parentChallengeId === c.id && step.id === a.sourceChallengeId)) || (c.parentChallengeId && c.parentChallengeId === a.sourceChallengeId))
  ));
  const costsComplete = billable.every(a => a.purchaseCost !== null) && evaluationFundedWithMissingSource.length === 0;
  const costs = billable.reduce((sum,a) => sum + (a.purchaseCost ?? 0), 0);
  const effective = roots.map(root => {
    const child = challengeRows.find(a => a.parentChallengeId === root.id && a.ownerId === root.ownerId);
    return { ...root, status: child?.status ?? root.status, convertedToFunded: child?.convertedToFunded ?? root.convertedToFunded };
  });
  const completed = effective.filter(a => ["failed","passed","refunded"].includes(a.status) || a.convertedToFunded);
  const passed = effective.filter(a => a.convertedToFunded || a.status === "passed");
  const conversions = effective.filter(a => a.convertedToFunded);
  const paidFunded = fundedRows.filter(a => a.payouts.some(p => p.status === "paid"));
  const funnel = { purchased: roots.length, completed: completed.length, passed: passed.length, funded: fundedRows.length, paid: paidFunded.length };
  const totalPayouts = stats.received;
  const farmingRoi = billable.length > 0 && costsComplete && costs > 0 ? (totalPayouts - costs) / costs * 100 : null;
  const netProfit = billable.length > 0 && costsComplete ? totalPayouts - costs : null;
  const conversionEval = completed.length ? conversions.length / completed.length * 100 : null;
  // This is an observed first-payout rate, NOT payout eligibility (which
  // needs rules and qualifying-day calculations).
  const conversionFunded = fundedRows.length ? paidFunded.length / fundedRows.length * 100 : null;
  const costPerFunded = roots.length > 0 && roots.every(a => a.purchaseCost !== null) && conversions.length
    ? roots.reduce((sum,a) => sum + (a.purchaseCost ?? 0), 0) / conversions.length : null;
  const firmRows = useMemo(() => {
    const groups = new Map<string, { firm: string; accounts: number; pnl: number; payouts: number; costs: number; costsComplete: boolean }>();
    for (const a of stats.unique) {
      const firm = a.propFirm || "Unknown firm";
      const row = groups.get(firm) ?? { firm, accounts: 0, pnl: 0, payouts: 0, costs: 0, costsComplete: true };
      row.accounts++; row.pnl += a.trades.reduce((v,t)=>v+t.pnl,0);
      row.payouts += a.payouts.filter(p=>p.status === "paid").reduce((v,p)=>v+p.received,0);
      const billable = (a.type === "challenge" && !a.parentChallengeId) || (a.type === "funded" && a.fundingPath !== "evaluation");
      if (billable && a.purchaseCost === null) row.costsComplete = false;
      if (a.type === "funded" && a.fundingPath === "evaluation" && !stats.unique.some(c => c.type === "challenge" && c.ownerId === a.ownerId && ((!c.parentChallengeId && c.id === a.sourceChallengeId) || (!c.parentChallengeId && stats.unique.some(step => step.parentChallengeId === c.id && step.id === a.sourceChallengeId))))) row.costsComplete = false;
      if (billable) row.costs += a.purchaseCost ?? 0;
      groups.set(firm,row);
    }
    return [...groups.values()].sort((a,b) => propRanking === "roi"
      ? ((b.costsComplete && b.costs > 0 ? (b.payouts - b.costs) / b.costs : -Infinity) - (a.costsComplete && a.costs > 0 ? (a.payouts - a.costs) / a.costs : -Infinity))
      : b.payouts - a.payouts);
  }, [stats.unique, propRanking]);
  const leaders = [...stats.traders].sort((a, b) => {
    const score = (t: typeof a) => ranking === "roi"
      ? (t.costsComplete && t.costs > 0 ? (t.payouts - t.costs) / t.costs : -Infinity)
      : t[ranking];
    return score(b) - score(a) || a.ownerId.localeCompare(b.ownerId);
  });
  const topPnl = [...stats.traders].filter(t=>t.trades>0 && t.pnl>0).sort((a,b)=>b.pnl-a.pnl)[0];
  // Funded achievement: count accounts that passed an evaluation, not purchases
  // of instant/direct funded accounts. No winner until there is a conversion.
  const fundedAchievements = stats.traders.map(t=>({
    ...t,
    fundedConversions: stats.unique.filter(a=>a.ownerId===t.ownerId && a.type==="funded" && a.fundingPath==="evaluation").length,
  }));
  const topFunder = fundedAchievements.filter(t=>t.fundedConversions>0).sort((a,b)=>b.fundedConversions-a.fundedConversions || b.pnl-a.pnl)[0];
  const topPayout = [...stats.traders].filter(t=>t.payouts>0).sort((a,b)=>b.payouts-a.payouts)[0];
  const topWinRate = [...stats.traders].filter(t=>t.trades>=5)
    .sort((a,b)=>(b.wins/b.trades)-(a.wins/a.trades)||b.trades-a.trades)[0];
  // Consistency is evaluated at the ACCOUNT level, not by pooling distinct
  // prop-firm rules. Compare how much of each firm's allowance is consumed.
  // Show provisional results rather than silently hiding genuine recorded
  // consistency scores. Compliance and sample size are displayed separately.
  const consistencyResults = stats.unique.flatMap(account => {
    const parent=stats.unique.find(a=>a.type==="challenge" && a.id===account.sourceChallengeId && a.ownerId===account.ownerId);
    const root=stats.unique.find(a=>a.type==="challenge" && a.id===parent?.parentChallengeId && a.ownerId===account.ownerId);
    const inherited=account.type==="funded" ? (parent?.consistencyLimit ?? root?.consistencyLimit ?? null) : null;
    const limit=account.consistencyLimit ?? inherited;
    if(limit==null || !(limit>0 && limit<100))return [];
    const daily=new Map<string,number>();
    for(const trade of account.trades){
      // Close-date calendar aggregation: multiple trades on one day count as ONE day.
      const day=trade.date.slice(0,10);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(trade.pnl))continue;
      daily.set(day,(daily.get(day)??0)+trade.pnl);
    }
    const total=account.trades.reduce((sum,t)=>sum+t.pnl,0);
    if(account.trades.length===0 || daily.size===0 || total<=0)return [];
    const best=Math.max(0,...daily.values());
    // Exactly one profitable trading day = 100% consistency by definition.
    const concentration=daily.size===1?100:100*best/total;
    // A compliant account uses <= 100% of its allowed concentration.
    const utilization=concentration/limit;
    if(!Number.isFinite(utilization) || concentration<=0)return [];
    return [{ownerId:account.ownerId,accountName:account.name,limit,concentration,utilization,tradeCount:account.trades.length,days:daily.size,compliant:utilization<=1}];
  });
  const consistentTraders = [...stats.traders].flatMap(t=>{
    const own=consistencyResults.filter(r=>r.ownerId===t.ownerId);
    // One trading day is 100% concentration and cannot win a consistency award.
    // A winner must have multiple distinct closed-trade days and a compliant ratio.
    const eligible=own.filter(r=>r.days>=2 && r.compliant && r.concentration<100);
    if(!eligible.length)return [];
    // A lower actual best-day concentration is better; show account limit separately.
    const best=[...eligible].sort((a,b)=>a.concentration-b.concentration||b.days-a.days||b.tradeCount-a.tradeCount)[0];
    return [{...best,ownerId:t.ownerId}];
  });
  const topConsistent=[...consistentTraders].sort((a,b)=>a.concentration-b.concentration||b.days-a.days||b.tradeCount-a.tradeCount)[0];
  const accolades = [
    {title:"P&L Champion", kicker:"TOP TRADER",name:topPnl?traderName(topPnl.ownerId):"No results yet",metric:topPnl?money(topPnl.pnl):"—",note:"Highest realized trading P&L",icon:Trophy,accent:"text-amber-300",border:"border-amber-400/25"},
    {title:"Funding Legend",kicker:"TOP ACCOUNT FUNDER",name:topFunder?traderName(topFunder.ownerId):"The funding throne is still empty 👑",metric:topFunder?`${topFunder.fundedConversions} funded`:"🚀",note:topFunder?"Most evaluations successfully converted into funded accounts":"First trader to pass a challenge claims the crown!",icon:Crown,accent:"text-violet-300",border:"border-violet-400/25"},
    {title:"Payout Hunter",kicker:"CASHOUT LEADER",name:topPayout?traderName(topPayout.ownerId):"No payouts yet 💸",metric:topPayout?money(topPayout.payouts):"—",note:topPayout?"Most cash actually received":"The first paid payout unlocks this award!",icon:DollarSign,accent:"text-emerald-300",border:"border-emerald-400/25"},
    {title:"Sharp Shooter",kicker:"WIN RATE CHAMPION",name:topWinRate?traderName(topWinRate.ownerId):"The target is waiting 🎯",metric:topWinRate?`${(topWinRate.wins/topWinRate.trades*100).toFixed(0)}% wins`:"🎯",note:topWinRate?"Best win rate · minimum 5 trades":"Five closed trades unlock the aim award!",icon:Target,accent:"text-sky-300",border:"border-sky-400/25"},
    {title:"Steady Hands",kicker:"MOST CONSISTENT",name:topConsistent?traderName(topConsistent.ownerId):"No measurable consistency yet 🧘",metric:topConsistent?`${Math.min(100,topConsistent.concentration).toFixed(1)}% / ${topConsistent.limit}%`:"—",note:topConsistent?`${topConsistent.compliant?"✅ Within limit":"⚠ Above limit"} · ${topConsistent.accountName} · ${topConsistent.days} trading day${topConsistent.days===1?"":"s"} / ${topConsistent.tradeCount} trades`:"Requires 2+ trading days, positive net P&L and consistency within the account limit",icon:Medal,accent:"text-teal-300",border:"border-teal-400/25"},
  ];
  const invested = costsComplete ? costs : null;
  const winRate = stats.trades.length ? stats.wins / stats.trades.length * 100 : null;
  const challengeCapital = challengeRows.filter(a => !a.parentChallengeId).reduce((sum, a) => sum + a.size, 0);
  const fundedCapital = fundedRows.reduce((sum, a) => sum + a.size, 0);
  const topMetric = [
    { label: "Challenge Shared Capital", value: money(challengeCapital), note: roots.length === 0 ? "Every trading empire starts with its first challenge. 🚀" : `${roots.length} shared challenges`, emptyTitle: roots.length === 0 ? "The mission hasn't started yet." : null, icon: Target, tone: "text-blue-400" },
    { label: "Funded Shared Capital", value: money(fundedCapital), note: fundedRows.length === 0 ? "The capital is waiting for its future champions. 🏆" : `${fundedRows.length} funded accounts`, emptyTitle: fundedRows.length === 0 ? "No funded capital… yet!" : null, icon: Trophy, tone: "text-emerald-400" },
    { label: "Trading P&L", value: money(stats.pnl), note: `${stats.trades.length} recorded trades`, icon: TrendingUp, tone: stats.pnl >= 0 ? "text-emerald-400" : "text-rose-400" },
    { label: "Payouts received", value: money(totalPayouts), note: `${paidFunded.length} funded accounts paid`, icon: DollarSign, tone: "text-emerald-400" },
    { label: "Win rate", value: winRate === null ? "—" : `${winRate.toFixed(1)}%`, note: "Closed recorded trades", icon: Target, tone: "text-violet-400" },
  ];
  return <div className="min-w-0 space-y-5 sm:space-y-7">
    {(shareError || accountError) && <div role="alert" className="rounded-xl border border-red-500/30 p-4 text-red-300">{shareError || accountError}</div>}

    {/* 01 — State of the team. High signal, minimal vertical footprint. */}
    <section className="relative overflow-hidden rounded-2xl border border-blue-400/15 bg-gradient-to-br from-[#142540] via-[#0d182b] to-[#0b1323] p-4 sm:p-6">
      <div className="pointer-events-none absolute -right-16 -top-24 h-60 w-60 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-300">01 / Collective position</p><h2 className="mt-2 text-xl font-bold sm:text-2xl">Your team at a glance</h2><p className="mt-1 text-sm text-slate-400">{stats.unique.length} shared accounts · {stats.traders.length} contributing traders · {fundedRows.length} funded</p></div>
        <Link href="/teams" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-blue-400/25 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-200 hover:bg-blue-500/20">Manage accounts <ArrowUpRight size={15}/></Link>
      </div>
      <div className="relative mt-5 grid grid-cols-2 gap-2 lg:grid-cols-5">
        {topMetric.map(metric => <div key={metric.label} className="min-w-0 rounded-xl border border-white/[0.07] bg-black/20 p-3 sm:p-4"><div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400"><metric.icon size={15} className={metric.tone}/>{metric.label}</div><p className={`mt-2 break-words text-xl font-extrabold tabular-nums sm:text-2xl ${metric.tone}`}>{metric.value}</p>{"emptyTitle" in metric && metric.emptyTitle && <p className="mt-2 text-xs font-semibold text-slate-200">{metric.emptyTitle}</p>}<p className="mt-1 text-[11px] text-slate-500">{metric.note}</p></div>)}
      </div>
    </section>

    {/* Team talent — distinct leaderboards use real shared trades and payouts. */}
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300">02 / Team Hall of Fame</p>
          <h2 className="mt-1 text-lg font-bold sm:text-xl">Meet the trading leaders <Sparkles className="inline h-4 w-4 text-amber-300"/></h2>
          <p className="mt-1 text-xs text-slate-400">Performance earned, never invented · based on shared account activity</p></div>
        <span className="text-[11px] text-slate-500">All-time · Shared portfolio</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
        {accolades.map(a=><div key={a.title} className={`min-w-0 rounded-xl border ${a.border} bg-white/[0.035] p-3 sm:p-4`}>
          <div className="flex items-center gap-2"><a.icon className={`h-5 w-5 shrink-0 ${a.accent}`}/><p className={`truncate text-[9px] font-extrabold tracking-wider ${a.accent}`}>{a.kicker}</p></div>
          <h3 className="mt-3 text-xs font-semibold text-slate-300 sm:text-sm">{a.title}</h3>
          <p className="mt-1 truncate text-sm font-bold text-white sm:text-base" title={a.name}>{a.name}</p>
          <p className={`mt-2 break-words text-xl font-extrabold tabular-nums sm:text-2xl ${a.accent}`}>{a.metric}</p>
          <p className="mt-1 text-[10px] leading-snug text-slate-500">{a.note}</p>
        </div>)}
      </div>
      <div className="mt-4 flex items-center justify-between gap-2"><h3 className="text-sm font-bold">Trader P&L leaderboard</h3><span className="text-[10px] text-slate-500">Net trade results · all shared accounts</span></div>
      {stats.traders.length ? <div className="mt-2 space-y-1.5">{[...stats.traders].sort((a,b)=>b.pnl-a.pnl).map((t,i)=>
        <div key={t.ownerId} className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
          <span className={`text-sm font-black ${i===0?"text-amber-300":"text-slate-500"}`}>{i===0?"★":i+1}</span>
          <div className="min-w-0"><p className="truncate text-sm font-semibold text-white" title={traderName(t.ownerId)}>{traderName(t.ownerId)}</p><p className="text-[10px] text-slate-500">{t.accounts} accounts · {t.trades} trades</p></div>
          <p className={`text-sm font-bold tabular-nums sm:text-base ${t.pnl>=0?"text-emerald-300":"text-rose-300"}`}>{t.pnl>0?"+":""}{money(t.pnl)}</p>
        </div>)}</div>:<p className="mt-3 text-xs text-slate-400">Share trading accounts to unlock the rankings.</p>}
    </section>

    {/* 02 — Account lifecycle: replace redundant funnel, pipeline and rate cards. */}
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-300">02 / Account journey</p><h2 className="mt-1 text-lg font-bold">From evaluation to payout</h2></div><span className="text-xs text-slate-500">Observed shared accounts</span></div>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {[{label:"Evaluations",value:funnel.purchased},{label:"Completed",value:funnel.completed},{label:"Converted",value:conversions.length},{label:"Funded",value:funnel.funded},{label:"Paid",value:funnel.paid}].map((step,i)=><div key={step.label} className="relative min-w-0 rounded-xl border border-white/[0.07] bg-white/[0.03] px-2 py-3 text-center sm:px-3"><p className="text-xl font-bold tabular-nums text-white sm:text-2xl">{step.value}</p><p className="mt-1 text-[10px] font-semibold text-slate-400 sm:text-xs">{step.label}</p>{i<4 && <span className="absolute -right-2 top-1/2 z-10 hidden text-blue-400 sm:block">→</span>}</div>)}
      </div>
      <p className="mt-3 text-xs text-slate-500">Instant funded accounts are included in Funded, but not counted as evaluation conversions.</p>
    </section>

    {/* 03 — Economics, with meaningful N/A rather than misleading zeros. */}
    <section className={card}>
      <div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-300">03 / Realized economics</p><h2 className="mt-1 text-lg font-bold">What the team has earned</h2></div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          {label:"Acquisition costs",value:invested === null ? "N/A" : money(invested),tone:"text-amber-300"},
          {label:"Paid payouts",value:money(totalPayouts),tone:"text-emerald-400"},
          {label:"Net farming profit",value:netProfit === null ? "N/A" : money(netProfit),tone:netProfit !== null && netProfit < 0 ? "text-rose-400" : "text-slate-100"},
          {label:"Farming ROI",value:farmingRoi === null ? "N/A" : `${farmingRoi.toFixed(1)}%`,tone:farmingRoi !== null && farmingRoi < 0 ? "text-rose-400" : "text-blue-400"},
        ].map(k=><div key={k.label} className="min-w-0 rounded-xl bg-white/[0.04] p-3"><p className="text-[11px] text-slate-400">{k.label}</p><p className={`mt-2 break-words text-xl font-bold tabular-nums ${k.tone}`}>{k.value}</p></div>)}
      </div>
      {!costsComplete && <p className="mt-3 flex items-start gap-2 text-xs text-amber-300"><ShieldAlert size={15} className="mt-0.5 shrink-0"/> Some purchase costs or source evaluations are not shared. ROI and net farming profit are unavailable until the data is complete.</p>}
      {costsComplete && netProfit !== null && netProfit < 0 && <p className="mt-3 text-xs text-slate-400">Current payouts have not yet covered recorded account acquisition costs.</p>}
    </section>

    {/* 04 — Operational view, before optional leaderboards. */}
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-300">04 / Shared portfolio</p><h2 className="mt-1 text-lg font-bold">Accounts to follow</h2></div><Link href="/teams" className="text-xs font-semibold text-blue-300 hover:text-blue-200">View account KPIs <ArrowUpRight size={14} className="inline"/></Link></div>
      {stats.unique.length ? <div className="mt-4 space-y-2">{stats.unique.slice(0,6).map(a=>{const pnl=a.trades.reduce((sum,t)=>sum+t.pnl,0);return <div key={`${a.ownerId}:${a.type}:${a.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3"><div className="min-w-0"><p className="break-words text-sm font-semibold">{a.name}</p><p className="mt-1 text-xs text-slate-500">{a.propFirm} · {a.type === "funded" ? "Funded" : "Evaluation"} · {a.status}</p></div><div className="flex gap-5 text-right"><div><p className="text-[10px] text-slate-500">Size</p><p className="text-sm font-bold tabular-nums">{money(a.size)}</p></div><div><p className="text-[10px] text-slate-500">P&L</p><p className={`text-sm font-bold tabular-nums ${pnl>=0?"text-emerald-400":"text-rose-400"}`}>{money(pnl)}</p></div></div></div>})}{stats.unique.length>6 && <p className="text-xs text-slate-500">+{stats.unique.length-6} more shared accounts in Team Management</p>}</div> : <div className="mt-4 rounded-xl border border-dashed border-white/15 p-5 text-center"><p className="text-sm text-slate-400">No shared accounts yet.</p><Link href="/teams" className="mt-2 inline-flex text-sm font-semibold text-blue-300">Share your first account <ArrowUpRight size={15}/></Link></div>}
    </section>

    {/* Advanced comparisons stay accessible, not in the main reading path. */}
    <section className={card}>
      <button type="button" aria-expanded={detailsOpen} onClick={()=>setDetailsOpen(v=>!v)} className="flex min-h-11 w-full items-center justify-between gap-3 text-left"><span><span className="block text-sm font-bold">Advanced performance comparisons</span><span className="mt-1 block text-xs text-slate-500">Trader and prop firm rankings · conversion statistics</span></span><ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform ${detailsOpen?"rotate-180":""}`}/></button>
      {detailsOpen && <div className="mt-5 space-y-5 border-t border-white/10 pt-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{[{label:"Eval → Funded",value:conversionEval===null?"N/A":`${conversionEval.toFixed(1)}%`},{label:"Funded → Paid",value:conversionFunded===null?"N/A":`${conversionFunded.toFixed(1)}%`},{label:"Cost per funded",value:costPerFunded===null?"N/A":money(costPerFunded)}].map(k=><div key={k.label} className="rounded-lg bg-white/5 p-3"><p className="text-xs text-slate-400">{k.label}</p><p className="mt-1 text-lg font-bold">{k.value}</p></div>)}</div>
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Trader comparison</h3><select aria-label="Leaderboard ranking" value={ranking} onChange={e=>setRanking(e.target.value as typeof ranking)} className="rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-sm"><option value="pnl">Trading P&L</option><option value="roi">Farming ROI</option><option value="payouts">Payouts</option><option value="accounts">Accounts</option></select></div>
        <div className="space-y-2">{leaders.map((t,i)=><div key={t.ownerId} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.04] p-3 text-sm"><span className="min-w-0 truncate text-slate-300">#{i+1} · {traderName(t.ownerId)}</span><span className="shrink-0 font-semibold tabular-nums">{ranking==="roi"?(t.costsComplete&&t.costs>0?`${((t.payouts-t.costs)/t.costs*100).toFixed(1)}%`:"N/A"):ranking==="payouts"?money(t.payouts):ranking==="pnl"?money(t.pnl):`${t.accounts} accounts`}</span></div>)}</div>
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Prop firm comparison</h3><select aria-label="Prop firm ranking" value={propRanking} onChange={e=>setPropRanking(e.target.value as typeof propRanking)} className="rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-sm"><option value="roi">Farming ROI</option><option value="payouts">Payouts</option></select></div>
        <div className="space-y-2">{firmRows.map(f=><div key={f.firm} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.04] p-3 text-sm"><span className="min-w-0 truncate text-slate-300">{f.firm} · {f.accounts} accounts</span><span className="shrink-0 font-semibold tabular-nums">{propRanking==="roi"?(f.costsComplete&&f.costs>0?`${((f.payouts-f.costs)/f.costs*100).toFixed(1)}%`:"N/A"):money(f.payouts)}</span></div>)}</div>
      </div>}
    </section>
    <p className="text-xs text-slate-500">Only explicitly shared accounts are included. Private accounts remain private. Risk limits and payout eligibility are not inferred from incomplete trading data.</p>
  </div>;
}

export default function TeamDashboard() {
  const { teams, loading, error } = useTeams();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const active = teams.find(t => t.id === selectedId) ?? teams[0];
  return <div className="mx-auto min-w-0 max-w-7xl space-y-5 sm:space-y-7"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-400"><Users size={16}/> TEAM WORKSPACE</p><h1 className="text-3xl font-bold tracking-tight">Team Dashboard</h1><p className="mt-2 text-slate-400">Collective prop firm farming · shared accounts and performance</p></div><div className="flex flex-wrap items-center gap-3"><Link href="/teams" className="rounded-xl border border-white/15 px-4 py-3 text-sm hover:bg-white/5">Manage team</Link>{teams.length > 1 && <select aria-label="Choose team" value={active?.id ?? ""} onChange={e => setSelectedId(e.target.value)} className="rounded-xl border border-white/15 bg-slate-900 p-3 text-sm">{teams.map(t => <option value={t.id} key={t.id}>{t.name}</option>)}</select>}</div></div>

    {loading ? <div className={card}>Loading teams...</div> : error ? <div className={card} role="alert">{error}</div> : active ? <><p className="text-sm text-slate-400">Team <span className="font-semibold text-slate-100">{active.name}</span> · Shared data only</p><TeamPerformance key={active.id} teamId={active.id}/></> : <div className={card}><h2 className="text-lg font-semibold">No team yet</h2><p className="mt-2 text-slate-400">Create your team to start tracking collective farming performance.</p><Link href="/teams" className="mt-4 inline-flex items-center gap-2 text-blue-400">Create a team <ArrowUpRight size={16}/></Link></div>}
  </div>;
}
