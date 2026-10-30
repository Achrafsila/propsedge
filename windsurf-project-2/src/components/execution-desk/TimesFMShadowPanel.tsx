"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { recordForecast } from "./TimesFMAccuracyTracker";

type ShadowForecast = {
  mode: "shadow";
  model: string;
  symbol: string;
  timeframe: string;
  provider: string;
  lastClosedCandleAt: string;
  lastClose: number;
  predictions: number[];
  lowerBand: number[];
  upperBand: number[];
  affectsTrading: false;
  marketStructure?: "Bullish" | "Bearish" | "Mixed" | "Unknown";
  atr?: number | null;
};

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function TimesFMShadowPanel() {
  const [data, setData] = useState<ShadowForecast | null>(null);
  const [tf,setTf] = useState("15m");
  const requested = useRef(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function refresh(timeframe = tf) {
    const request = ++requested.current;
    setLoading(true);
    setError("");
    setData(null);
    try {
      const response = await fetch("/api/execution-desk/timesfm?tf="+encodeURIComponent(timeframe), { cache: "no-store" });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message = result && typeof result === "object" && "error" in result ? String(result.error) : "Unavailable";
        throw new Error(message);
      }
      const f = result as ShadowForecast;
      if (!Array.isArray(f.predictions) || f.predictions.length !== 12 ||
          !Array.isArray(f.lowerBand) || f.lowerBand.length !== 12 ||
          !Array.isArray(f.upperBand) || f.upperBand.length !== 12 ||
          !Number.isFinite(f.lastClose)) throw new Error("Forecast format not recognized");
      if(request !== requested.current) return;
      if(timeframe==="5m") recordForecast(f);
      window.dispatchEvent(new CustomEvent("propsedge-timesfm-forecast",{detail:{tf:timeframe,lastClose:f.lastClose,predictions:f.predictions,baseTime:f.lastClosedCandleAt}}));
      setData(f);
    } catch (e) {
      if(request===requested.current)setError(e instanceof Error ? e.message : "Forecast unavailable");
    } finally {
      if(request===requested.current)setLoading(false);
    }
  }

  useEffect(()=>{
    const onTf=(event:Event)=>{const next=(event as CustomEvent<string>).detail; if(!["5m","15m","30m","1h","4h"].includes(next))return;setTf(next);};
    window.addEventListener("propsedge-timeframe",onTf);
    return()=>window.removeEventListener("propsedge-timeframe",onTf);
  },[]);
  useEffect(()=>{void refresh(tf);/* Recompute whenever Execution Desk timeframe changes. */},[tf]);
  const minutes:Record<string,number>={"5m":5,"15m":15,"30m":30,"1h":60,"4h":240};
  const barMinutes=minutes[tf]??5;
  const forecasts = data ? [3, 6, 12].map(h => {
    const target = data.predictions[h - 1];
    const diff = target - data.lastClose;
    return { h, target, diff, percent: diff / data.lastClose * 100 };
  }) : [];
  const finalDiff = data ? data.predictions[11] - data.lastClose : 0;
  const volatility = data?.atr && data.atr > 0 ? finalDiff / data.atr : null;
  const bias = data ? (volatility !== null
    ? volatility > 0.25 ? "Bullish" : volatility < -0.25 ? "Bearish" : "Neutral"
    : Math.abs(finalDiff / data.lastClose) < 0.0005 ? "Neutral" : finalDiff > 0 ? "Bullish" : "Bearish") : "Unknown";
  const structure = data?.marketStructure ?? "Unknown";
  const alignment = structure === "Unknown" || structure === "Mixed" || bias === "Neutral" ? "Inconclusive" : structure === bias ? "Aligned" : "Divergent";
  const interpretation = alignment === "Divergent"
    ? `TimesFM anticipe un mouvement ${bias === "Bullish" ? "haussier" : "baissier"} à court terme, contre une structure EMA ${structure === "Bullish" ? "haussière" : "baissière"}. Un retracement est possible, mais aucun retournement n'est confirmé.`
    : alignment === "Aligned"
    ? "La direction projetée et les EMA sont concordantes. Ce constat ne confirme pas une entrée ni sa probabilité de réussite."
    : "La projection est faible ou la structure EMA est mixte. Aucun consensus directionnel exploitable.";
  const values = data ? [data.lastClose, ...data.predictions, ...data.lowerBand, ...data.upperBand] : [];
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const scaleY = (v: number) => 110 - (v - min) / (max - min || 1) * 90;
  const x = (i: number) => 14 + i * 26;
  const line = data ? [data.lastClose, ...data.predictions].map((v, i) => `${i ? "L" : "M"} ${x(i)} ${scaleY(v).toFixed(1)}`).join(" ") : "";
  const upper = data ? [data.lastClose, ...data.upperBand].map((v,i) => `${i ? "L" : "M"} ${x(i)} ${scaleY(v).toFixed(1)}`).join(" ") : "";
  const lower = data ? [data.lastClose, ...data.lowerBand].map((v,i) => `${i ? "L" : "M"} ${x(i)} ${scaleY(v).toFixed(1)}`).join(" ") : "";

  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-300/15 bg-[#0c1325]/85 p-4 text-slate-100" aria-label="TimesFM shadow forecast">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold"><Activity size={16} className="text-cyan-300"/> TimesFM 2.5 · AI Forecast <span className="rounded-full border border-cyan-300/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">Shadow mode</span></div>
          <p className="mt-1 text-xs text-slate-400">XAU/USD · {tf.toUpperCase()} · 12 bougies ({12*barMinutes} min) · Analyse uniquement</p>
        </div>
        <button type="button" disabled={loading} onClick={refresh} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/20 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""}/>{loading ? "Calcul en cours…" : "Calculer la prévision"}
        </button>
      </div>
      {error && <p role="status" className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-xs text-amber-200">{error === "TimesFM cloud service not configured" ? "Service TimesFM non configuré : une URL HTTPS et une clé serveur sont nécessaires." : error}</p>}
      {data && (
        <>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { label: "Forecast bias", value: bias, detail: volatility === null ? "ATR unavailable" : `${volatility >= 0 ? "+" : ""}${volatility.toFixed(2)} ATR` },
            { label: "EMA structure", value: structure, detail: "EMA 20 / 50 / 200 · {tf.toUpperCase()}" },
            { label: "Market alignment", value: alignment, detail: "Shadow · non-trading" }
          ].map(item => <div key={item.label} className="rounded-xl border border-white/10 bg-white/[.04] p-3">
            <p className="text-[11px] text-slate-400">{item.label}</p>
            <p className="mt-1 text-base font-semibold">{item.value}</p>
            <p className="text-[10px] text-slate-500">{item.detail}</p>
          </div>)}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {forecasts.map(f => <div key={f.h} className="rounded-xl border border-white/10 bg-white/[.03] p-3">
            <p className="text-[11px] text-slate-400">{f.h * 5} min · {f.h} bars</p>
            <p className="mt-1 text-sm font-semibold tabular-nums">{fmt(f.target)}</p>
            <p className={`text-xs tabular-nums ${f.diff > 0 ? "text-emerald-300" : f.diff < 0 ? "text-rose-300" : "text-slate-300"}`}>{f.diff >= 0 ? "+" : ""}{f.percent.toFixed(3)}%</p>
          </div>)}
        </div>
        <div className="mt-3 rounded-xl border border-cyan-400/15 bg-cyan-400/[.04] p-3">
          <p className="text-xs font-semibold text-cyan-200">AI Market Interpretation · règles transparentes</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">{interpretation}</p>
          <p className="mt-1 text-[10px] text-slate-500">Biais calculé à partir de la projection TimesFM et de l'ATR, sans appel Groq ni score de confiance probabiliste.</p>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="min-w-0 rounded-xl border border-white/10 bg-[#080e1b] p-2">
            <svg viewBox="0 0 340 130" className="h-36 w-full" role="img" aria-label="Forecast path and indicative quantile bounds">
              {[20,65,110].map(y=><line key={y} x1="7" x2="333" y1={y} y2={y} stroke="#334155" strokeDasharray="3 5"/>)}
              <path d={upper} stroke="#22d3ee" strokeWidth="1.4" strokeDasharray="4 4" fill="none" opacity=".5"/>
              <path d={lower} stroke="#22d3ee" strokeWidth="1.4" strokeDasharray="4 4" fill="none" opacity=".5"/>
              <path d={line} stroke="#67e8f9" strokeWidth="2.5" fill="none"/>
              <circle cx={x(0)} cy={scaleY(data.lastClose)} r="3" fill="#e2e8f0"/>
            </svg>
            <p className="px-2 pb-1 text-[10px] text-slate-400">Courbe centrale et quantiles indicatifs · pas une probabilité de gain</p>
          </div>
          <div className="space-y-2 text-xs">
            <div className="rounded-lg bg-white/[.04] p-3"><p className="text-slate-400">Dernière clôture</p><p className="mt-1 text-lg font-semibold tabular-nums">{fmt(data.lastClose)}</p></div>
            <div className="rounded-lg bg-white/[.04] p-3"><p className="text-slate-400">Prévision fin d'horizon</p><p className="mt-1 text-lg font-semibold tabular-nums">{fmt(data.predictions[11])}</p></div>
            <p className="text-[11px] text-slate-400">Dernière bougie : {new Date(data.lastClosedCandleAt).toLocaleString()} · {data.provider}</p>
          </div>
        </div>
        </>
      )}
      {!data && !error && <p className="mt-3 text-xs text-slate-500">Clique sur « Calculer la prévision » pour lancer une analyse ponctuelle. Aucun ordre ni score n'est modifié.</p>}
    </section>
  );
}
