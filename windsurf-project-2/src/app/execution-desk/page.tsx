"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import BoussoleEntries from "@/components/execution-desk/BoussoleEntries";
import { Activity, ArrowUpRight, CheckCircle2, Circle, Crosshair, Layers3, ShieldCheck, Target, TrendingUp, Zap } from "lucide-react";

type Setup = "rebound" | "breakout" | "countertrend";
type Direction = "buy" | "sell";
type Values = { entry: string; low: string; high: string; atr: string; ema20: string; ema50: string; ema200: string; rr: string };
const setups: Record<Setup, { label: string; description: string; checks: string[] }> = {
  rebound: { label: "Liquidity Rebound", description: "HTF area → liquidity sweep → M5 structure shift → confirmed reaction", checks: ["HTF zone identified", "Liquidity swept and reclaimed", "M5 MSS / displacement", "Entry trigger confirmed"] },
  breakout: { label: "Breakout & Retest", description: "M15 structure break → retest → M5 continuation confirmation", checks: ["M15 close beyond structure", "Retest of broken level", "M5 bullish/bearish confirmation", "Breakout not overextended"] },
  countertrend: { label: "Countertrend Reversal", description: "HTF liquidity sweep → failed continuation → M5 shift → retest", checks: ["HTF external liquidity swept", "Price re-entered prior range", "M5 MSS + displacement", "Risk / invalidation confirmed"] },
};
const initial: Values = { entry: "", low: "", high: "", atr: "", ema20: "", ema50: "", ema200: "", rr: "2" };
const number = (s: string) => s.trim() === "" ? NaN : Number(s.replace(",", "."));
const display = (x: number) => Number.isFinite(x) ? x.toLocaleString("en-US", { maximumFractionDigits: 3 }) : "—";
const panel = "rounded-2xl border border-white/10 bg-[#0c1325]/85 shadow-[0_12px_55px_rgba(0,0,0,0.16)] backdrop-blur-xl";
function LiveChart() {
  const chart = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!chart.current) return;
    const node = chart.current;
    node.innerHTML = "";
    const wrapper = document.createElement("div"); wrapper.className = "tradingview-widget-container w-full h-full";
    const inner = document.createElement("div"); inner.className = "tradingview-widget-container__widget w-full h-full"; wrapper.appendChild(inner);
    const script = document.createElement("script"); script.type = "text/javascript"; script.async = true;
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.textContent = JSON.stringify({ autosize: true, symbol: "OANDA:XAUUSD", interval: "5", timezone: "Etc/UTC", theme: "dark", style: "1", locale: "en", backgroundColor: "#080e1b", gridColor: "rgba(148,163,184,0.05)", hide_top_toolbar: false, hide_legend: false, allow_symbol_change: false, save_image: false, studies: ["STD;EMA","STD;EMA"], support_host: "https://www.tradingview.com" });
    wrapper.appendChild(script); node.appendChild(wrapper);
    return () => { node.innerHTML = ""; };
  }, []);
  return <div ref={chart} className="h-[400px] min-h-[400px] w-full sm:h-[550px] xl:h-[650px]" aria-label="Live TradingView Gold chart"/>;
}
export default function ExecutionDeskPage() {
  const [setup, setSetup] = useState<Setup>("rebound");
  const [direction, setDirection] = useState<Direction>("buy");
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [v, setV] = useState<Values>(initial);
  const [open, setOpen] = useState(false);
  const active = setups[setup];
  const count = active.checks.filter(k => checks[setup + k]).length;
  const parsed = useMemo(() => ({ entry: number(v.entry), low: number(v.low), high: number(v.high), atr: number(v.atr), ema20: number(v.ema20), ema50: number(v.ema50), ema200: number(v.ema200), rr: number(v.rr) }), [v]);
  const alignment = Number.isFinite(parsed.ema20) && Number.isFinite(parsed.ema50) && Number.isFinite(parsed.ema200)
    ? parsed.ema20 > parsed.ema50 && parsed.ema50 > parsed.ema200 ? "Bullish alignment"
      : parsed.ema20 < parsed.ema50 && parsed.ema50 < parsed.ema200 ? "Bearish alignment" : "Mixed alignment"
    : "Awaiting market inputs";
  // SL invalidates the actual playbook structure; ATR is only an optional protective buffer.
  const buffer = Number.isFinite(parsed.atr) && parsed.atr > 0 ? parsed.atr * .15 : 0;
  const sl = Number.isFinite(parsed.low) && Number.isFinite(parsed.high) ? direction === "buy" ? parsed.low - buffer : parsed.high + buffer : NaN;
  const risk = Math.abs(parsed.entry - sl);
  const valid = Number.isFinite(parsed.entry) && Number.isFinite(sl) && risk > 0 && (direction === "buy" ? sl < parsed.entry : sl > parsed.entry) && parsed.rr > 0;
  const tp = valid ? parsed.entry + (direction === "buy" ? 1 : -1) * risk * parsed.rr : NaN;
  const ready = valid && count === active.checks.length;
  const state = ready ? "PLAYBOOK CHECKED" : count ? "WATCHING" : "NO TRADE";
  const update = (key: keyof Values, value: string) => setV(prev => ({ ...prev, [key]: value }));
  return (
    <main className="min-h-screen bg-[#070c18] px-3 py-5 text-slate-100 sm:px-5 xl:px-8">
      <div className="mx-auto max-w-[1760px] space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.24em] text-cyan-400"><Crosshair size={13}/> Institutional execution workspace</div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Execution <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">Desk</span></h1>
            <p className="mt-1 text-sm text-slate-400">Boussole Graph & Entries × your price-action playbook · XAU/USD only</p></div>
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.04] px-4 py-3"><span className="h-2 w-2 rounded-full bg-amber-400"/><span className="text-xs font-semibold text-slate-200">ANALYSIS ONLY</span><span className="text-xs text-slate-500">No auto execution</span></div>
        </header>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[["MARKET","XAU/USD · GOLD"],["TRADING SESSION","LIVE CHART"],["HTF BIAS",alignment],["EXECUTION STATUS",state]].map(([k,val],i) => <div key={k} className={panel+" p-4"}><div className="text-[10px] font-semibold tracking-[.15em] text-slate-500">{k}</div><div className={"mt-2 text-sm font-bold sm:text-base "+(i===3 ? "text-amber-300" : "text-slate-100")}>{val}</div></div>)}
        </div>
        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.75fr)_minmax(340px,1fr)]">
          <section className={panel+" overflow-hidden"}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3"><span className="flex items-center gap-2 text-sm font-semibold"><Activity size={16} className="text-cyan-400"/> Market Chart <span className="text-xs font-normal text-slate-500">TradingView · OANDA:XAUUSD</span></span><span className="text-[10px] text-slate-500">Broker chart may differ from execution prices</span></div>
            <LiveChart/>
          </section>
          <aside className={panel+" space-y-5 p-4 sm:p-5"}>
            <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-base font-bold"><Zap className="text-cyan-400" size={19}/> Execution Coach</h2><span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold text-amber-300">{state}</span></div>
            <div className="space-y-2"><label className="text-xs font-semibold text-slate-400">PLAYBOOK SETUP</label><div className="grid grid-cols-1 gap-2 sm:grid-cols-3 2xl:grid-cols-1">
              {(Object.keys(setups) as Setup[]).map(key => <button key={key} onClick={() => setSetup(key)} className={"rounded-xl border px-3 py-3 text-left text-sm transition "+(setup===key?"border-cyan-400/40 bg-cyan-400/10 text-cyan-200":"border-white/10 bg-white/[.03] text-slate-300 hover:bg-white/[.07]")}>{setups[key].label}</button>)}
            </div><p className="text-xs leading-5 text-slate-400">{active.description}</p></div>
            <div className="flex items-center gap-2"><span className="text-xs text-slate-400">Direction candidate</span>{(["buy","sell"] as Direction[]).map(d => <button key={d} onClick={() => setDirection(d)} className={"rounded-lg px-4 py-2 text-xs font-bold "+(direction===d ? (d==="buy"?"bg-emerald-500/20 text-emerald-300":"bg-rose-500/20 text-rose-300"):"border border-white/10 text-slate-400")}>{d==="buy"?"LONG":"SHORT"}</button>)}</div>
            <div className="space-y-2"><div className="flex justify-between"><h3 className="text-sm font-semibold">Playbook validation</h3><span className="text-xs text-cyan-300">{count}/{active.checks.length}</span></div>
              {active.checks.map(label => <button key={label} onClick={() => setChecks(c => ({ ...c, [setup+label]: !c[setup+label] }))} className="flex w-full items-center gap-2 rounded-lg border border-white/5 bg-white/[.025] px-3 py-3 text-left text-xs text-slate-300">{checks[setup+label]?<CheckCircle2 size={17} className="shrink-0 text-emerald-400"/>:<Circle size={17} className="shrink-0 text-slate-600"/>}{label}</button>)}
              <p className="text-[11px] leading-relaxed text-slate-500">Confirmation is manually checked. No automated MSS, sweep, order-flow or FVG detection is claimed.</p>
            </div>
            <div className="space-y-3 rounded-xl border border-white/10 bg-[#090f20] p-4"><h3 className="flex items-center gap-2 text-sm font-semibold"><Target size={15} className="text-violet-300"/> Trade construction</h3>
              <div className="grid grid-cols-2 gap-2">{([["entry","Entry candidate"],["low","Sweep / structure low"],["high","Sweep / structure high"],["atr","ATR 14 (optional)"],["ema20","EMA 20 (optional)"],["ema50","EMA 50 (optional)"],["ema200","EMA 200 (optional)"],["rr","Target R multiple"]] as [keyof Values,string][]).map(([key,label]) => <label key={key} className="space-y-1 text-[11px] text-slate-400">{label}<input inputMode="decimal" aria-label={label} value={v[key]} onChange={e=>update(key,e.target.value)} placeholder={key==="rr"?"2":"—"} className="w-full rounded-lg border border-white/10 bg-[#111b2f] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/60"/></label>)}</div>
              <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-3">{[["ENTRY",parsed.entry,"text-white"],["STRUCTURAL SL",sl,"text-rose-300"],["R:R TP",tp,"text-emerald-300"]].map(([label,n,color])=><div key={String(label)}><div className="text-[9px] text-slate-500">{label}</div><div className={"mt-1 text-sm font-bold "+color}>{display(Number(n))}</div></div>)}</div>
              <p className="text-[11px] text-slate-500">SL = invalidation swing ± 0.15 × ATR; TP = selected R multiple. A structural price objective has to be verified manually.</p>
            </div>
            <div className={"rounded-xl border px-4 py-3 text-sm "+(ready?"border-emerald-500/30 bg-emerald-500/10 text-emerald-200":"border-amber-500/25 bg-amber-500/10 text-amber-200")}>{ready?"All manually selected conditions and price geometry pass. Human trade review still required.":"Wait for full playbook confirmation and valid SL / entry geometry. No executable signal issued."}</div>
          </aside>
        </div>
        <BoussoleEntries />
        <section className={panel+" p-4 sm:p-5"}>
          <button onClick={()=>setOpen(!open)} className="flex w-full items-center justify-between text-left"><span className="flex items-center gap-2 font-semibold"><Layers3 size={18} className="text-blue-400"/> Desk Intelligence · Methodology</span><span className="text-xs text-slate-400">{open?"Hide":"Explore"} <ArrowUpRight size={14} className="inline"/></span></button>
          {open && <div className="mt-4 grid gap-3 text-xs text-slate-300 md:grid-cols-3">{[["01 · Context","H1/H4 structure, EMA 20/50/200 trend context and session liquidity."],["02 · Confirm","HTF liquidity target, M15 reaction, M5 MSS, sweep/retest or breakout. Manual until verified feeds are connected."],["03 · Protect","Structural invalidation before sizing, next liquidity for targets, account risk permission from EdgePilot before any future execution."]].map(([t,d])=><div key={t} className="rounded-xl border border-white/10 bg-white/[.03] p-4"><strong className="text-cyan-300">{t}</strong><p className="mt-2 leading-relaxed text-slate-400">{d}</p></div>)}</div>}
        </section>
        <p className="flex gap-2 text-xs text-slate-500"><ShieldCheck size={15} className="shrink-0"/> A separate, additive trading workspace. Inputs are manual and not persisted. No live strategy signals or broker execution are connected. Chart data comes from TradingView, not the Boussole signal engine.</p>
      </div>
    </main>
  );
}
