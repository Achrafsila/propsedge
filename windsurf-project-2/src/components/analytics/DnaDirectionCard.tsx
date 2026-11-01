"use client";
import type { DNAQuote } from "@/lib/analytics/traderDnaQuotes";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export function DnaDirectionCard({quote}:{quote:DNAQuote}){
 const bull=quote.title==="Bull energy";
 const accent=bull?"#57ef91":"#ff665b";
 return <article className="relative isolate flex min-h-[350px] flex-col overflow-hidden rounded-[24px] border border-white/15 bg-[#071425] p-5 shadow-[0_15px_45px_rgba(0,0,0,.22)] sm:p-6">
  <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-70" style={{background:`radial-gradient(ellipse at 50% 20%, ${bull?"rgba(32,225,106,.22)":"rgba(255,77,104,.22)"} 0%, transparent 58%)`}}/>
  <div className="relative flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[.2em]" style={{color:accent}}>Trading instinct</span><span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300">BUY vs SELL</span></div>
  <div className="relative mx-auto my-2 flex h-44 w-full items-center justify-center">
   <img src={bull?"/trader-dna/bull-energy.webp":"/trader-dna/bear-energy.webp"} alt={bull?"Electric neon bull":"Electric neon bear"} className="relative h-full w-full object-contain drop-shadow-[0_0_18px_rgba(41,255,130,.3)]" loading="lazy"/>
  </div>
  <div className="relative mt-auto rounded-2xl border border-white/15 bg-[#0e1d32]/95 p-4">
   <div className="mb-2 flex items-center justify-between gap-2"><h2 className="text-lg font-extrabold" style={{color:accent}}>{quote.title}</h2>{bull?<ArrowUpRight style={{color:accent}} size={25}/>:<ArrowDownRight style={{color:accent}} size={25}/>}</div>
   <p className="text-sm font-medium leading-relaxed text-white">“{quote.quote}”</p>
   <p className="mt-3 border-t border-white/10 pt-3 text-[11px] leading-relaxed text-slate-400">{quote.evidence}</p>
  </div>
 </article>;
}
