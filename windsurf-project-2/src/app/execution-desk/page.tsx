"use client";

import { useEffect, useRef } from "react";
import { Crosshair, ShieldCheck } from "lucide-react";
import BoussoleEntries from "@/components/execution-desk/BoussoleEntries";

// The original TradingView widget is deliberately retained. Its public embed
// API cannot accept custom price-line commands from the surrounding Next app.
function OriginalTradingView() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    node.innerHTML = "";
    const wrapper = document.createElement("div");
    wrapper.className = "tradingview-widget-container h-full w-full";
    const chart = document.createElement("div");
    chart.className = "tradingview-widget-container__widget h-full w-full";
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.textContent = JSON.stringify({
      autosize: true, symbol: "OANDA:XAUUSD", interval: "5",
      timezone: "Etc/UTC", theme: "dark", style: "1", locale: "en",
      backgroundColor: "#080e1b", gridColor: "rgba(148,163,184,0.05)",
      hide_top_toolbar: false, hide_legend: false, allow_symbol_change: false,
      save_image: false, studies: ["STD;EMA", "STD;EMA"],
      support_host: "https://www.tradingview.com",
    });
    wrapper.append(chart, script);
    node.appendChild(wrapper);
    return () => { node.innerHTML = ""; };
  }, []);
  return <div ref={host} className="h-[450px] w-full sm:h-[620px] xl:h-[780px]" aria-label="TradingView original XAUUSD chart"/>;
}

export default function ExecutionDeskPage() {
  return (
    <main className="min-h-screen bg-[#070c18] px-3 py-5 text-slate-100 sm:px-5 xl:px-8">
      <div className="mx-auto max-w-[1760px] space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.24em] text-cyan-400"><Crosshair size={14}/> Trading workspace</div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Execution <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">Desk</span></h1>
            <p className="mt-1 text-xs text-slate-400">Un graphique · Une lecture claire · Des scénarios conditionnels.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-3 py-2 text-xs text-slate-300"><ShieldCheck size={15} className="text-cyan-300"/> Analyse uniquement · aucune exécution automatique</div>
        </header>
        <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,1.65fr)_minmax(330px,1fr)]">
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1325]/85 shadow-[0_12px_55px_rgba(0,0,0,.16)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
              <span className="text-sm font-semibold">XAU/USD · TradingView</span>
              <span className="text-[11px] text-slate-400">Graphique original · OANDA:XAUUSD</span>
            </div>
            <OriginalTradingView />
          </section>
          <div className="min-w-0 space-y-3"><BoussoleEntries /></div>
        </div>

      </div>
    </main>
  );
}
