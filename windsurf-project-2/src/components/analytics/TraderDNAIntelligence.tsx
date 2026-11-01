"use client";
import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import type { Trade } from "@/types";
import { traderDnaQuotes } from "@/lib/analytics/traderDnaQuotes";

export function TraderDNAIntelligence({trades}:{trades:Trade[]}) {
 const quotes=useMemo(()=>traderDnaQuotes(trades).slice(0,3),[trades]);
 return <section className="rounded-2xl border border-blue-400/20 bg-[#101c30] p-4 sm:p-5">
  <div className="mb-3 flex items-center gap-2"><Sparkles className="text-cyan-300" size={18}/><div><h2 className="text-sm font-semibold text-white">Little truths about your trading ✨</h2><p className="text-xs text-slate-400">A little personality, straight from your trade history</p></div></div>
  {quotes.length?<div className="grid gap-3 lg:grid-cols-3">{quotes.map(q=><article key={q.id} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-4"><div className="mb-2 text-xl">{q.emoji}</div><h3 className="text-sm font-semibold text-cyan-200">{q.title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-200">“{q.quote}”</p><p className="mt-3 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-slate-400">{q.evidence}</p></article>)}</div>:<p className="text-sm text-slate-400">Still getting to know your trading style. Keep those trades coming! 👀</p>}
  <p className="mt-3 text-[10px] text-slate-500">{trades.length} recorded trades · Historical observations, not trading signals. Sessions and holding times require reliable entry timestamps.</p>
 </section>;
}
