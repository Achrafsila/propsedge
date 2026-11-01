"use client";
import type { DNAQuote } from "@/lib/analytics/traderDnaQuotes";
export function DnaMarketCard({quote}:{quote:DNAQuote}){
 return <article className="relative isolate flex min-h-[350px] flex-col overflow-hidden rounded-[24px] border border-slate-500/25 bg-[#091626] p-5 shadow-[0_15px_45px_rgba(0,0,0,.22)] sm:p-6">
  <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_24%,rgba(115,145,175,.10),transparent_60%)]"/>
  <div className="relative flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-[.2em] text-slate-300">Market affinity</span>{quote.market&&<span className="rounded-full border border-slate-400/20 bg-white/5 px-2 py-1 text-[10px] text-slate-200">{quote.market}</span>}</div>
  <div className="relative mx-auto my-2 flex h-44 w-full items-center justify-center"><img src="/trader-dna/market-compass.svg" alt="Minimalist titanium market compass" className="h-full w-full object-contain" loading="lazy"/></div>
  <div className="relative mt-auto rounded-2xl border border-white/10 bg-[#101d31]/95 p-4"><h2 className="text-lg font-extrabold text-slate-100">{quote.title}</h2><p className="mt-2 text-sm font-medium leading-relaxed text-slate-100">“{quote.quote}”</p><p className="mt-3 border-t border-white/10 pt-3 text-[11px] leading-relaxed text-slate-400">{quote.evidence}</p></div>
 </article>;
}
