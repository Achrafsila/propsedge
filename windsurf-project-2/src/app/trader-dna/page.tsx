"use client";
import { useMemo, useState } from "react";
import { Sparkles, Layers3 } from "lucide-react";
import { useAccounts } from "@/context/AccountsContext";
import { useTradingMode } from "@/context/TradingModeContext";
import { usePersonalAccounts } from "@/context/PersonalAccountsContext";
import { getTradesForTradingMode } from "@/lib/tradingMode";
import { getAccountOptionLabel } from "@/lib/accountLabels";
import { traderDnaQuotes } from "@/lib/analytics/traderDnaQuotes";
import { DnaCompactCard, groupDnaQuotes } from "@/components/analytics/DnaCompactCard";

export default function TraderDNAPage(){
 const {challenges,fundedAccounts,trades,challengesLoading,fundedAccountsLoading,tradesLoading}=useAccounts();
 const {personalAccounts,personalAccountsLoading}=usePersonalAccounts();
 const {tradingMode}=useTradingMode();
 const [selected,setSelected]=useState("all");
 const accounts=useMemo(()=>tradingMode==="personal-capital"?personalAccounts.map(a=>({id:a.id,type:"personal",label:a.accountName})): [
  ...challenges.map(a=>({id:a.id,type:"challenge",label:getAccountOptionLabel(a,"challenge")})),
  ...fundedAccounts.map(a=>({id:a.id,type:"funded",label:getAccountOptionLabel(a,"funded")}))],[tradingMode,personalAccounts,challenges,fundedAccounts]);
 const modeTrades=useMemo(()=>getTradesForTradingMode(trades,tradingMode),[trades,tradingMode]);
 const active=accounts.some(a=>a.type+":"+a.id===selected)?selected:"all";
 const filtered=useMemo(()=>active==="all"?modeTrades:modeTrades.filter(t=>t.accountType+":"+t.accountId===active),[modeTrades,active]);
 const quotes=useMemo(()=>traderDnaQuotes(filtered),[filtered]);
 const loading=challengesLoading||fundedAccountsLoading||tradesLoading||personalAccountsLoading;
 return <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
  <div className="flex flex-wrap items-end justify-between gap-4">
   <div><div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-cyan-300"><Sparkles size={15}/> Trading personality</div><h1 className="text-3xl font-bold tracking-tight text-white">Trader DNA</h1><p className="mt-2 text-sm text-slate-400">Little truths about your trading. No lectures, just your own history talking. ✨</p></div>
   <div className="min-w-[220px]"><label htmlFor="dna-account" className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Trading account</label><select id="dna-account" value={active} onChange={e=>setSelected(e.target.value)} className="w-full rounded-xl border border-white/15 bg-[#111d32] px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"><option value="all">All accounts · combined</option>{accounts.map(a=><option key={a.type+":"+a.id} value={a.type+":"+a.id}>{a.label} · {a.type==="challenge"?"Challenge":a.type==="funded"?"Funded":"Personal"}</option>)}</select></div>
  </div>
  <div className="flex flex-wrap gap-2 text-xs text-slate-300"><span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">{filtered.length} recorded trades</span><span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">{quotes.length} available quotes</span><span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">{active==="all"?"All accounts":accounts.find(a=>a.type+":"+a.id===active)?.label}</span></div>
  {loading?<div className="rounded-2xl border border-white/10 bg-[#101c30] p-8 text-sm text-slate-400">Loading your trading history…</div>:quotes.length?<div className="grid items-start gap-3 lg:grid-cols-2">{groupDnaQuotes(quotes).map(group=><DnaCompactCard key={group.key} group={group}/>)}</div>:<div className="rounded-2xl border border-white/10 bg-[#101c30] p-8 text-center"><Layers3 className="mx-auto mb-3 text-cyan-300" size={28}/><p className="font-semibold text-white">Still getting to know your trading style 👀</p><p className="mt-2 text-sm text-slate-400">Add at least five closed trades to start unlocking your quotes.</p></div>}
  <p className="text-xs text-slate-500">Every quote is based on recorded trade data. Comparisons are historical observations, not trading signals. Session analysis requires verified entry times and broker timezone.</p>
 </main>;
}
