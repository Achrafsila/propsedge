"use client";

import { useState } from "react";
import { Activity, RefreshCw } from "lucide-react";

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
};

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function TimesFMShadowPanel() {
  const [data, setData] = useState<ShadowForecast | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    setError("");
    setData(null);
    try {
      const response = await fetch("/api/execution-desk/timesfm?tf=5m", { cache: "no-store" });
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
      setData(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Forecast unavailable");
    } finally {
      setLoading(false);
    }
  }

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
          <p className="mt-1 text-xs text-slate-400">XAU/USD · M5 · 12 prochaines bougies clôturées (60 min) · Analyse uniquement</p>
        </div>
        <button type="button" disabled={loading} onClick={refresh} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/20 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""}/>{loading ? "Calcul en cours…" : "Calculer la prévision"}
        </button>
      </div>
      {error && <p role="status" className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-xs text-amber-200">{error === "TimesFM cloud service not configured" ? "Service TimesFM non configuré : une URL HTTPS et une clé serveur sont nécessaires." : error}</p>}
      {data && (
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
      )}
      {!data && !error && <p className="mt-3 text-xs text-slate-500">Clique sur « Calculer la prévision » pour lancer une analyse ponctuelle. Aucun ordre ni score n'est modifié.</p>}
    </section>
  );
}
