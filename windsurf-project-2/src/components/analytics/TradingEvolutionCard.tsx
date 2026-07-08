"use client";

import { motion } from "framer-motion";
import { Sprout, TrendingUp, TrendingDown, Minus, HelpCircle } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { EvolutionInsight, TraderEvolution } from "@/lib/analytics/traderEvolution";

const EVOLUTION_COLOR = "#3B82F6";

// Presentation-only lookup — the engine already decided the trend direction
// string; this only decides the arrow icon + color for display. The
// "positive" word always maps to green across all three surfaced trends
// (Increasing/Improving), confirmed by reading traderEvolution.ts's exact
// classifyDirectionalTrend() call sites for expectancy/discipline/setup
// quality trends.
const TREND_VISUAL: Record<string, { icon: typeof TrendingUp; color: string }> = {
  Increasing: { icon: TrendingUp, color: "#10B981" },
  Improving: { icon: TrendingUp, color: "#10B981" },
  Decreasing: { icon: TrendingDown, color: "#EF4444" },
  Declining: { icon: TrendingDown, color: "#EF4444" },
  Stable: { icon: Minus, color: "#94A3B8" },
};
const DEFAULT_TREND_VISUAL = { icon: HelpCircle, color: "#64748B" };

function TrendRow({ row }: { row: EvolutionInsight }) {
  const visual = TREND_VISUAL[row.value] ?? DEFAULT_TREND_VISUAL;
  const Icon = visual.icon;
  // .reasons is already a fully-formatted "Recent 30d: X · Previous 30d: Y"
  // string from the engine — split for two chips, or fall back to the plain
  // "Building history…" sentence when there isn't a two-period comparison.
  const parts = row.reasons.split("·").map((p) => p.trim()).filter(Boolean);

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-2">
        <span className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.sm }}>
          {row.label}
        </span>
        <div className="flex items-center gap-1.5">
          <Icon className="w-4 h-4" style={{ color: visual.color }} />
          <span className="font-bold" style={{ fontSize: typography.fontSize.base, color: visual.color }}>
            {row.value}
          </span>
        </div>
      </div>
      {parts.length === 2 ? (
        <div className="flex flex-wrap gap-2">
          {parts.map((part) => (
            <span
              key={part}
              className="px-2.5 py-1 rounded-full"
              style={{
                fontSize: typography.fontSize.xs,
                color: "#94A3B8",
                background: "rgba(148,163,184,0.06)",
                border: "1px solid rgba(148,163,184,0.12)",
              }}
            >
              {part}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.muted }}>
          {row.reasons}
        </p>
      )}
    </div>
  );
}

// Renders whatever src/lib/analytics/traderEvolution.ts computes — no
// thresholds, comparisons, or fallback copy decided here. Trader DNA V4:
// this card answers exactly one question — "Am I improving over time?" —
// with three trend rows (Expectancy, Discipline, Setup Quality) instead of
// the full behavioral trend breakdown. Activity/Holding Time/Session/
// Instrument Focus Trends are still computed by the engine for the AI
// Coach; they just aren't rendered here. This is a last-30-days vs
// previous-30-days comparison, not a monthly time series — no sparkline is
// drawn since no such historical array exists.
export function TradingEvolutionCard({ evolution }: { evolution: TraderEvolution }) {
  const rows: EvolutionInsight[] = [evolution.expectancyTrend, evolution.disciplineTrend, evolution.setupQualityTrend];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4 }}
      className="rounded-xl p-6"
      style={{
        background: glassmorphism.card.background,
        backdropFilter: glassmorphism.card.backdropBlur,
        border: "1px solid rgba(148,163,184,0.08)",
        borderRadius: borderRadius.xl,
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${EVOLUTION_COLOR}1A` }}
        >
          <Sprout className="w-5 h-5" style={{ color: EVOLUTION_COLOR }} />
        </div>
        <h3 className="text-[#F8FAFC] font-bold" style={{ fontSize: typography.fontSize.section }}>
          Evolution
        </h3>
      </div>

      <p
        className="text-[#94A3B8] mb-5"
        style={{ fontSize: typography.fontSize.sm, opacity: typography.opacity.tertiary }}
      >
        How your trading behavior is changing — recent 30 days vs the 30 before that.
      </p>

      <div className="space-y-5 mb-5">
        {rows.map((row) => (
          <TrendRow key={row.label} row={row} />
        ))}
      </div>

      <div className="pt-4" style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }}>
        <h4 className="text-[#F8FAFC] font-semibold mb-1.5" style={{ fontSize: typography.fontSize.sm }}>
          Executive Summary
        </h4>
        <p
          className="text-[#94A3B8]"
          style={{
            fontSize: typography.fontSize.xs,
            opacity: typography.opacity.tertiary,
            lineHeight: typography.lineHeight.relaxed,
          }}
        >
          {evolution.executiveSummary}
        </p>
      </div>
    </motion.div>
  );
}
