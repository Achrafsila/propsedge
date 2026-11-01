"use client";
import type { DNAQuote } from "@/lib/analytics/traderDnaQuotes";

export type DNAGroup = { key: string; quotes: DNAQuote[] };
const visuals: Record<string,{name:string;image:string;accent:string}> = {
 market:{name:"Market Affinity",image:"market-compass.svg",accent:"text-slate-200"},
 direction:{name:"Trading Instinct",image:"bull-energy.webp",accent:"text-emerald-300"},
 rhythm:{name:"Trading Rhythm",image:"trading-rhythm.webp",accent:"text-cyan-200"},
 risk:{name:"Risk Guardian",image:"risk-guardian.webp",accent:"text-violet-200"},
 pnl:{name:"Profit & Loss DNA",image:"profit-loss.webp",accent:"text-pink-200"},
 evolution:{name:"Trading Evolution",image:"trading-chart.webp",accent:"text-cyan-200"},
 sizing:{name:"Position Sizing",image:"trading-chart.webp",accent:"text-cyan-200"},
 other:{name:"Trading Insights",image:"trading-chart.webp",accent:"text-slate-200"}
};
const category:Record<string,string> = {
 market:"market",direction:"direction",weekday:"rhythm",frequency:"rhythm","daily-frequency":"rhythm",
 "loss-day":"risk","loss-control":"risk","risk-reminder":"risk",
 "profit-concentration":"pnl",payoff:"pnl","reward-risk":"pnl",
 evolution:"evolution",lots:"sizing"
};
export function groupDnaQuotes(quotes:DNAQuote[]):DNAGroup[]{
 const groups = new Map<string,DNAQuote[]>();
 for(const q of quotes){const key=category[q.id]||"other";groups.set(key,[...(groups.get(key)||[]),q]);}
 return [...groups].map(([key,items])=>({key,quotes:items}));
}
export function DnaCompactCard({group}:{group:DNAGroup}){
 const v=visuals[group.key]||visuals.other;
 const first=group.quotes[0];
 const image=group.key==="direction"&&first.title!=="Bull energy"?"bear-energy.webp":v.image;
 return <article className="relative overflow-hidden rounded-[20px] border border-white/10 bg-[#0c1a2d] px-4 py-4 shadow-[0_10px_30px_rgba(0,0,0,.12)] transition-colors hover:border-white/20 sm:px-5">
  <div className="mb-3 flex items-center justify-between gap-3">
   <span className={`text-[10px] font-bold uppercase tracking-[.16em] ${v.accent}`}>{v.name}</span>
   {group.key==="market"&&first.market&&<span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300">{first.market}</span>}
   {group.quotes.length>1&&<span className="text-[10px] text-slate-500">{group.quotes.length} insights</span>}
  </div>
  <div className="flex items-start gap-3 sm:gap-4">
   <div className="flex h-24 w-24 shrink-0 items-start justify-center sm:h-28 sm:w-28">
    <img src={`/trader-dna/${image}`} alt={v.name} loading="lazy" className="h-full w-full object-contain object-top"/>
   </div>
   <div className="min-w-0 flex-1 divide-y divide-white/10">
    {group.quotes.map((q,i)=><section key={q.id} className={i?"pt-3 mt-3":""}>
     <h2 className={`text-sm font-bold leading-snug ${v.accent}`}>{q.title}</h2>
     <p className="mt-1.5 text-[13px] leading-relaxed text-slate-200">“{q.quote}”</p>
     <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{q.evidence}</p>
    </section>)}
   </div>
  </div>
 </article>;
}
