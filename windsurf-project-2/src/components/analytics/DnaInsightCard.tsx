"use client";
import type { DNAQuote } from "@/lib/analytics/traderDnaQuotes";

const visuals: Record<string, { image: string; label: string; tint: string }> = {
  "weekday": { image: "trading-rhythm", label: "Trading Rhythm", tint: "cyan" },
  "frequency": { image: "trading-rhythm", label: "Trading Rhythm", tint: "cyan" },
  "daily-frequency": { image: "trading-rhythm", label: "Trading Rhythm", tint: "cyan" },
  "loss-day": { image: "risk-guardian", label: "Risk Guardian", tint: "violet" },
  "loss-control": { image: "risk-guardian", label: "Risk Guardian", tint: "violet" },
  "risk-reminder": { image: "risk-guardian", label: "Risk Guardian", tint: "violet" },
  "profit-concentration": { image: "risk-guardian", label: "Risk Guardian", tint: "violet" },
  "payoff": { image: "profit-loss", label: "Profit & Loss DNA", tint: "pink" },
  "reward-risk": { image: "profit-loss", label: "Profit & Loss DNA", tint: "pink" },
  "evolution": { image: "trading-chart", label: "Trading Evolution", tint: "cyan" },
};
export const hasDnaInsightVisual = (id: string) => Boolean(visuals[id]);

export function DnaInsightCard({ quote }: { quote: DNAQuote }) {
  const visual = visuals[quote.id];
  if (!visual) return null;
  const accent = visual.tint === "pink" ? "text-pink-200" : visual.tint === "violet" ? "text-violet-200" : "text-cyan-200";
  return (
    <article className="relative isolate flex min-h-[350px] flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#091626] p-5 shadow-[0_15px_45px_rgba(0,0,0,.22)] transition-colors hover:border-white/20 sm:p-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(82,85,186,.12),transparent_62%)]" />
      <div className={`relative text-[10px] font-bold uppercase tracking-[.2em] ${accent}`}>{visual.label}</div>
      <div className="relative mx-auto flex h-44 w-full items-center justify-center">
        <img src={`/trader-dna/${visual.image}.webp`} alt={`${visual.label} illustration`} loading="lazy" className="h-full w-full object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,.3)]" />
      </div>
      <div className="relative mt-auto rounded-2xl border border-white/10 bg-[#101d31]/95 p-4">
        <h2 className={`text-lg font-extrabold ${accent}`}>{quote.title}</h2>
        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-100">“{quote.quote}”</p>
        <p className="mt-3 border-t border-white/10 pt-3 text-[11px] leading-relaxed text-slate-400">{quote.evidence}</p>
      </div>
    </article>
  );
}
