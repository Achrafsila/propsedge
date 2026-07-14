"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Activity } from "lucide-react";
import { glassmorphism, borderRadius, typography, gradientText, gradientHero } from "@/design-system";
import { InstrumentKey } from "@/lib/market/types";
import { EdgePulseBrief } from "@/lib/edge-pulse/composeEdgePulse";
import { fetchEdgePulse } from "@/lib/edge-pulse/client";
import { MarketOutlookHero } from "./sections/MarketOutlookHero";
import { MarketStructureSection } from "./sections/MarketStructureSection";
import { LiquidityMapSection } from "./sections/LiquidityMapSection";
import { SupplyDemandSection } from "./sections/SupplyDemandSection";
import { InstitutionalLevelsSection } from "./sections/InstitutionalLevelsSection";
import { MarketCatalystSection } from "./sections/MarketCatalystSection";
import { MarketContextSection } from "./sections/MarketContextSection";
import { SessionPlaybookSection } from "./sections/SessionPlaybookSection";
import { MarketQualitySection } from "./sections/MarketQualitySection";
import { InstitutionalWarningsSection } from "./sections/InstitutionalWarningsSection";
import { TechnicalReasoningSection } from "./sections/TechnicalReasoningSection";

// ============================================================
// PropEdge — Edge Pulse (institutional terminal)
// ============================================================
// Pure presentation + per-instrument data wiring. Every value displayed
// comes directly from the already-composed EdgePulseBrief (composeEdgePulse.ts)
// — no recalculation, no new analysis in this file. Fetches ONE
// instrument at a time (fetchEdgePulse, in-memory-cached per instrument)
// rather than eagerly loading all 4 like the old MarketIntelligence-backed
// page — Edge Pulse's multi-timeframe payload is materially heavier.

const CARD = {
  background: glassmorphism.card.background,
  backdropFilter: glassmorphism.card.backdropBlur,
  border: "1px solid rgba(148,163,184,0.08)",
  borderRadius: borderRadius["2xl"],
};

interface EdgePulseInstrumentDef {
  label: string;
  backendKey: InstrumentKey | null;
}

// DJI's backend key is "US30" (same convention as the Gateway's DJI
// route) — labelled "DJI" per the product spec while reading the real
// "US30" payload key underneath.
const EDGE_PULSE_INSTRUMENTS: EdgePulseInstrumentDef[] = [
  { label: "EURUSD", backendKey: "EURUSD" },
  { label: "USDJPY", backendKey: null },
  { label: "XAUUSD", backendKey: "XAUUSD" },
  { label: "BTCUSD", backendKey: null },
  { label: "ETHUSD", backendKey: null },
  { label: "SP500", backendKey: null },
  { label: "DJI", backendKey: "US30" },
  { label: "NDX", backendKey: "NDX" },
];

function isBriefUsable(brief: EdgePulseBrief | null): brief is EdgePulseBrief {
  return brief !== null && brief.currentPrice !== null;
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl ${className}`} style={{ background: "rgba(148,163,184,0.06)" }} />;
}

function EdgePulseSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonBlock className="h-10 w-64" />
      <SkeletonBlock className="h-52" />
      <SkeletonBlock className="h-40" />
      <SkeletonBlock className="h-40" />
    </div>
  );
}

export function EdgePulseView() {
  const [selectedLabel, setSelectedLabel] = useState<string>(EDGE_PULSE_INSTRUMENTS[0].label);
  // undefined = not yet fetched for this label (loading), null = fetched
  // but unavailable, EdgePulseBrief = fetched and usable. Deriving
  // `loading` from this map (rather than a separate imperative setState
  // inside the effect) avoids the cascading-render anti-pattern.
  const [briefsByLabel, setBriefsByLabel] = useState<Record<string, EdgePulseBrief | null | undefined>>({});
  const [refreshing, setRefreshing] = useState(false);

  const selectedDef = EDGE_PULSE_INSTRUMENTS.find((d) => d.label === selectedLabel) ?? EDGE_PULSE_INSTRUMENTS[0];
  const briefState = briefsByLabel[selectedLabel];
  const loading = briefState === undefined;
  const brief = briefState ?? null;

  const load = useCallback(async (def: EdgePulseInstrumentDef, options?: { forceRefresh?: boolean }) => {
    if (!def.backendKey) return;
    const result = await fetchEdgePulse(def.backendKey, options);
    setBriefsByLabel((prev) => ({ ...prev, [def.label]: result }));
  }, []);

  useEffect(() => {
    if (briefsByLabel[selectedLabel] !== undefined || !selectedDef.backendKey) return; // already loaded/cached this page-load
    const backendKey = selectedDef.backendKey;
    const label = selectedDef.label;
    fetchEdgePulse(backendKey).then((result) => {
      setBriefsByLabel((prev) => ({ ...prev, [label]: result }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLabel]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(selectedDef, { forceRefresh: true });
    setRefreshing(false);
  };

  const formatUpdatedAt = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="relative -mx-6 -mt-6 px-6 pt-10 pb-6 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: gradientHero.radial }} />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1
              style={{
                fontSize: typography.fontSize.display,
                fontWeight: 800,
                letterSpacing: typography.letterSpacing.display,
                lineHeight: typography.lineHeight.display,
                background: gradientText.premium,
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              Edge Pulse
            </h1>
            <p className="text-[#94A3B8] mt-1" style={{ fontSize: typography.fontSize.base }}>
              Institutional Market Intelligence
            </p>
          </div>
          <div className="flex items-center gap-3">
            {brief && (
              <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.xs }}>
                Last Updated {formatUpdatedAt(brief.generatedAt)}
              </p>
            )}
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing || !selectedDef.backendKey}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold disabled:opacity-50"
              style={{ background: "rgba(41,141,255,0.12)", color: "#298DFF", border: "1px solid rgba(41,141,255,0.3)", fontSize: typography.fontSize.sm }}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Instrument selector ── */}
      <div className="flex flex-wrap gap-2 p-1.5 rounded-2xl" style={{ background: "rgba(148,163,184,0.04)", border: "1px solid rgba(148,163,184,0.08)" }}>
        {EDGE_PULSE_INSTRUMENTS.map((def) => {
          const isSelected = def.label === selectedLabel;
          const disabled = !def.backendKey;
          return (
            <button
              key={def.label}
              type="button"
              disabled={disabled}
              onClick={() => setSelectedLabel(def.label)}
              className="px-4 py-2 rounded-xl font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-35"
              style={{
                fontSize: typography.fontSize.sm,
                background: isSelected ? "rgba(41,141,255,0.18)" : "transparent",
                color: isSelected ? "#298DFF" : "#94A3B8",
                border: isSelected ? "1px solid rgba(41,141,255,0.4)" : "1px solid transparent",
              }}
            >
              {def.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <EdgePulseSkeleton />
      ) : !isBriefUsable(brief) ? (
        <div className="rounded-2xl p-10 text-center" style={CARD}>
          <Activity className="w-8 h-8 mx-auto mb-3 text-[#64748B]" />
          <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.base }}>
            Edge Pulse is currently unavailable for this instrument.
          </p>
        </div>
      ) : (
        <motion.div key={selectedLabel} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
          <MarketOutlookHero
            symbol={brief.symbol}
            currentPrice={brief.currentPrice}
            overallBias={brief.overallBias}
            outlookNarrative={brief.outlookNarrative}
            executionPosture={brief.executionPosture}
          />
          <MarketStructureSection structure={brief.structure} />
          <LiquidityMapSection liquidity={brief.liquidity} />
          <SupplyDemandSection supplyDemandByTimeframe={brief.supplyDemandByTimeframe} />
          <InstitutionalLevelsSection institutionalLevels={brief.institutionalLevels} />
          <MarketCatalystSection catalyst={brief.catalyst} />
          <MarketContextSection marketContext={brief.marketContext} />
          <SessionPlaybookSection sessionPlaybook={brief.sessionPlaybook} />
          <MarketQualitySection marketQuality={brief.marketQuality} />
          <InstitutionalWarningsSection warnings={brief.warnings} />
          <TechnicalReasoningSection technicalReasoning={brief.technicalReasoning} />
        </motion.div>
      )}
    </div>
  );
}
