"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, ChevronDown, Activity } from "lucide-react";
import { glassmorphism, borderRadius, typography, gradientText, gradientHero } from "@/design-system";
import { MarketIntelligence, InstrumentKey, InstrumentMarketData } from "@/lib/market/types";
import { MarketPulse, MarketPulseEvidence } from "@/lib/market/marketPulse";
import { buildMarketInterpretation, buildConditionsToWatch } from "./edgePulseCopy";

// ============================================================
// PropEdge — Edge Pulse (premium market analysis terminal)
// ============================================================
// Pure presentation. Every value displayed comes directly from the
// already-computed MarketPulse the backend attaches to each
// InstrumentMarketData — no recalculation, no new analysis. Reuses the
// existing glassmorphism/typography/gradient design tokens (the same ones
// CockpitHero/DetailedAnalysis already use) rather than introducing new
// visual language. Never exposes providers, fallbacks, data quality, raw
// JSON, or technical engine/source names — those are internal plumbing,
// not part of the trader-facing product.

const CARD = {
  background: glassmorphism.card.background,
  backdropFilter: glassmorphism.card.backdropBlur,
  border: "1px solid rgba(148,163,184,0.08)",
  borderRadius: borderRadius["2xl"],
};

interface EdgePulseInstrumentDef {
  label: string;
  // The backend's InstrumentMarketData key this pill resolves to, or null
  // when the backend does not (yet) serve this instrument at all. Null
  // pills are always disabled — Edge Pulse never fabricates data for an
  // instrument the backend hasn't wired up.
  backendKey: InstrumentKey | null;
}

// DJI's backend key is "US30" (chosen when the Gateway's DJI route was
// integrated) — Edge Pulse labels the pill "DJI" per the product spec
// while still reading from the real "US30" payload key underneath.
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

const REGIME_COLOR: Record<string, string> = {
  bullish_trend: "#10B981",
  bearish_trend: "#EF4444",
  range: "#298DFF",
  transition: "#F59E0B",
  unknown: "#64748B",
};
const PHASE_COLOR: Record<string, string> = {
  expansion: "#10B981",
  pullback: "#F59E0B",
  compression: "#298DFF",
  rotation: "#298DFF",
  unknown: "#64748B",
};
const BIAS_COLOR: Record<string, string> = { bullish: "#10B981", bearish: "#EF4444", neutral: "#298DFF", unknown: "#64748B" };
const CONVICTION_COLOR: Record<string, string> = { high: "#10B981", medium: "#F59E0B", low: "#EF4444", unknown: "#64748B" };
const VOLATILITY_COLOR: Record<string, string> = { low: "#10B981", normal: "#298DFF", high: "#F59E0B", extreme: "#EF4444", unknown: "#64748B" };
const ENVIRONMENT_COLOR: Record<string, string> = { favorable: "#10B981", selective: "#F59E0B", poor: "#EF4444", unknown: "#64748B" };

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function formatLevelPrice(price: number): string {
  return price.toLocaleString(undefined, { maximumFractionDigits: 5 });
}
function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function resolveInstrumentData(intel: MarketIntelligence | null, def: EdgePulseInstrumentDef): InstrumentMarketData | null {
  if (!intel || !def.backendKey) return null;
  return intel.instruments[def.backendKey];
}

function isInstrumentUsable(data: InstrumentMarketData | null): boolean {
  return !!data && data.status !== "unavailable" && !!data.marketPulse && data.marketPulse.status !== "unavailable";
}

// ── Small presentational primitives ───────────────────────────────────────

function HeroStatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl p-5" style={{ ...CARD, boxShadow: `0 0 24px ${color}14` }}>
      <p className="text-[#64748B] uppercase mb-2" style={{ fontSize: typography.fontSize.xs, letterSpacing: typography.letterSpacing.label }}>
        {label}
      </p>
      <p className="font-extrabold" style={{ fontSize: typography.fontSize["2xl"], color }}>
        {value}
      </p>
    </div>
  );
}

function KeyLevelCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "rgba(148,163,184,0.04)", border: "1px solid rgba(148,163,184,0.08)" }}>
      <p className="text-[#64748B] uppercase mb-1.5" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
        {label}
      </p>
      <p className="text-[#F8FAFC] font-semibold tabular-nums" style={{ fontSize: typography.fontSize.lg }}>
        {value}
      </p>
    </div>
  );
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl ${className}`} style={{ background: "rgba(148,163,184,0.06)" }} />;
}

function EdgePulseSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonBlock className="h-10 w-64" />
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-24" />
        ))}
      </div>
      <SkeletonBlock className="h-32" />
      <SkeletonBlock className="h-40" />
    </div>
  );
}

function EvidenceDisclosure({ evidence }: { evidence: MarketPulseEvidence[] }) {
  const [expanded, setExpanded] = useState(false);
  const preview = evidence.slice(0, 4);
  const rest = evidence.slice(4);

  return (
    <div className="space-y-2.5">
      {preview.map((e, i) => (
        <p key={i} className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.normal }}>
          {e.message}
        </p>
      ))}
      {rest.length > 0 && (
        <div>
          {expanded && (
            <div className="space-y-2.5 mb-3">
              {rest.map((e, i) => (
                <p key={i} className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.normal }}>
                  {e.message}
                </p>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 font-semibold"
            style={{ color: "#298DFF", fontSize: typography.fontSize.xs }}
          >
            <ChevronDown className="w-3.5 h-3.5 transition-transform" style={{ transform: expanded ? "rotate(180deg)" : "none" }} />
            {expanded ? "Hide Full Analysis" : "View Full Analysis"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main view ──────────────────────────────────────────────────────────────

export function EdgePulseView({
  intel,
  loading,
  refreshing,
  onRefresh,
}: {
  intel: MarketIntelligence | null;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [selectedLabel, setSelectedLabel] = useState<string>(EDGE_PULSE_INSTRUMENTS[0].label);
  const selectedDef = EDGE_PULSE_INSTRUMENTS.find((d) => d.label === selectedLabel) ?? EDGE_PULSE_INSTRUMENTS[0];
  const data = resolveInstrumentData(intel, selectedDef);
  const pulse: MarketPulse | null = data?.marketPulse ?? null;

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
              Deterministic Market Intelligence
            </p>
          </div>
          <div className="flex items-center gap-3">
            {intel && (
              <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.xs }}>
                Last Updated {formatUpdatedAt(intel.fetchedAt)}
              </p>
            )}
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold disabled:opacity-50"
              style={{ background: "rgba(41,141,255,0.12)", color: "#298DFF", border: "1px solid rgba(41,141,255,0.3)", fontSize: typography.fontSize.sm }}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <EdgePulseSkeleton />
      ) : (
        <>
          {/* ── Section 1: Instrument Selector ── */}
          <div className="flex flex-wrap gap-2 p-1.5 rounded-2xl" style={{ background: "rgba(148,163,184,0.04)", border: "1px solid rgba(148,163,184,0.08)" }}>
            {EDGE_PULSE_INSTRUMENTS.map((def) => {
              const defData = resolveInstrumentData(intel, def);
              const usable = isInstrumentUsable(defData);
              const disabled = !def.backendKey || !usable;
              const isSelected = def.label === selectedLabel;
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

          {!isInstrumentUsable(data) ? (
            <div className="rounded-2xl p-10 text-center" style={CARD}>
              <Activity className="w-8 h-8 mx-auto mb-3 text-[#64748B]" />
              <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.base }}>
                Edge Pulse is currently unavailable for this instrument.
              </p>
            </div>
          ) : (
            pulse &&
            data && (
              <motion.div key={selectedLabel} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
                {pulse.status === "partial" && (
                  <div className="rounded-xl p-4" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
                    <p className="text-[#F59E0B] font-medium" style={{ fontSize: typography.fontSize.sm }}>
                      Some market information is temporarily unavailable. Edge Pulse is using the latest confirmed data.
                    </p>
                  </div>
                )}

                {/* ── Section 2: Market Snapshot ── */}
                <div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                    <HeroStatCard label="Market Regime" value={titleCase(pulse.regime.regime)} color={REGIME_COLOR[pulse.regime.regime]} />
                    <HeroStatCard label="Market Phase" value={titleCase(pulse.phase.phase)} color={PHASE_COLOR[pulse.phase.phase]} />
                    <HeroStatCard label="Structural Bias" value={titleCase(pulse.bias)} color={BIAS_COLOR[pulse.bias]} />
                    <HeroStatCard label="Conviction" value={titleCase(pulse.conviction.conviction)} color={CONVICTION_COLOR[pulse.conviction.conviction]} />
                    <HeroStatCard label="Volatility" value={titleCase(pulse.volatility.volatility)} color={VOLATILITY_COLOR[pulse.volatility.volatility]} />
                    <HeroStatCard label="Environment" value={titleCase(pulse.environment.environment)} color={ENVIRONMENT_COLOR[pulse.environment.environment]} />
                  </div>
                  <div className="rounded-2xl p-6" style={CARD}>
                    <p className="text-[#64748B] uppercase mb-2" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
                      Summary
                    </p>
                    <p className="text-[#F8FAFC]" style={{ fontSize: typography.fontSize.base, lineHeight: typography.lineHeight.relaxed }}>
                      {pulse.summary}
                    </p>
                  </div>
                </div>

                {/* ── Section 3: Market Interpretation ── */}
                <div className="rounded-2xl p-6" style={CARD}>
                  <p className="text-[#64748B] uppercase mb-2" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
                    Market Interpretation
                  </p>
                  <p className="text-[#CBD5E1]" style={{ fontSize: typography.fontSize.base, lineHeight: typography.lineHeight.relaxed }}>
                    {buildMarketInterpretation(pulse)}
                  </p>
                </div>

                {/* ── Section 4: Key Levels ── */}
                <div className="rounded-2xl p-6" style={CARD}>
                  <p className="text-[#64748B] uppercase mb-4" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
                    Key Levels
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    <KeyLevelCard
                      label="Nearest Level"
                      value={pulse.nearestLevel ? `${pulse.nearestLevel.label} @ ${formatLevelPrice(pulse.nearestLevel.price)}` : "—"}
                    />
                    <KeyLevelCard label="Daily Open" value={data.keyLevels?.dailyOpen != null ? formatLevelPrice(data.keyLevels.dailyOpen) : "—"} />
                    <KeyLevelCard label="Weekly Open" value={data.keyLevels?.weeklyOpen != null ? formatLevelPrice(data.keyLevels.weeklyOpen) : "—"} />
                    <KeyLevelCard
                      label="Previous Day High"
                      value={data.keyLevels?.previousDayHigh != null ? formatLevelPrice(data.keyLevels.previousDayHigh) : "—"}
                    />
                    <KeyLevelCard
                      label="Previous Day Low"
                      value={data.keyLevels?.previousDayLow != null ? formatLevelPrice(data.keyLevels.previousDayLow) : "—"}
                    />
                    <KeyLevelCard
                      label="Previous Week High"
                      value={data.keyLevels?.previousWeekHigh != null ? formatLevelPrice(data.keyLevels.previousWeekHigh) : "—"}
                    />
                    <KeyLevelCard
                      label="Previous Week Low"
                      value={data.keyLevels?.previousWeekLow != null ? formatLevelPrice(data.keyLevels.previousWeekLow) : "—"}
                    />
                  </div>
                </div>

                {/* ── Section 5: Conditions To Watch ── */}
                <div className="rounded-2xl p-6" style={CARD}>
                  <p className="text-[#64748B] uppercase mb-3" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
                    Conditions To Watch
                  </p>
                  {(() => {
                    const conditions = buildConditionsToWatch(pulse, data.currentPrice, data.keyLevels);
                    return conditions.length === 0 ? (
                      <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.sm }}>
                        No notable conditions to monitor right now.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {conditions.map((c, i) => (
                          <li key={i} className="text-[#CBD5E1] flex items-start gap-2" style={{ fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.normal }}>
                            <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ background: "#298DFF" }} />
                            {c}
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                </div>

                {/* ── Section 6: Why Edge Pulse says this ── */}
                <div className="rounded-2xl p-6" style={CARD}>
                  <p className="text-[#64748B] uppercase mb-3" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
                    Why Edge Pulse Says This
                  </p>
                  <EvidenceDisclosure evidence={pulse.evidence} />
                </div>
              </motion.div>
            )
          )}
        </>
      )}
    </div>
  );
}
