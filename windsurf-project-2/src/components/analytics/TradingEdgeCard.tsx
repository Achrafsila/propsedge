"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { TraderEdge } from "@/lib/analytics/traderEdge";

const EDGE_COLOR = "#10B981";

// Renders whatever src/lib/analytics/traderEdge.ts computes — no
// thresholds, ranking, or fallback copy decided here. Trader DNA V4: this
// card answers exactly one question — "Where do I statistically perform
// best?" — with a single flagship insight (Best Setup) instead of a list
// of per-dimension rankings. Best Session/Instrument/Weekday are still
// computed by the engine for the AI Coach; they just aren't rendered here.
export function TradingEdgeCard({ edge }: { edge: TraderEdge }) {
  const { bestSetup } = edge;

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
          style={{ background: `${EDGE_COLOR}1A` }}
        >
          <Sparkles className="w-5 h-5" style={{ color: EDGE_COLOR }} />
        </div>
        <h3 className="text-[#F8FAFC] font-bold" style={{ fontSize: typography.fontSize.section }}>
          Your Edge
        </h3>
      </div>

      <p
        className="text-[#94A3B8] mb-5"
        style={{ fontSize: typography.fontSize.sm, opacity: typography.opacity.tertiary }}
      >
        Where you statistically perform best — ranked by expectancy, not total P&amp;L.
      </p>

      <div className="mb-5">
        <p
          className="uppercase mb-2"
          style={{
            color: "#94A3B8",
            fontSize: typography.fontSize.xs,
            fontWeight: typography.fontWeight.medium,
            letterSpacing: typography.letterSpacing.label,
            opacity: typography.opacity.secondary,
          }}
        >
          Best Setup
        </p>
        <p
          className="font-extrabold"
          style={{ color: "#F8FAFC", fontSize: typography.fontSize.kpi, lineHeight: typography.lineHeight.kpi }}
        >
          {bestSetup.value}
        </p>
        {bestSetup.detail && (
          <p className="mt-1" style={{ color: "#94A3B8", fontSize: typography.fontSize.sm }}>
            {bestSetup.detail}
          </p>
        )}
        {bestSetup.metricLabel && (
          <p className="mt-2 font-semibold" style={{ color: EDGE_COLOR, fontSize: typography.fontSize.base }}>
            {bestSetup.metricLabel}
          </p>
        )}
        {bestSetup.narrative && (
          <p
            className="mt-2"
            style={{ color: "#94A3B8", fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}
          >
            {bestSetup.narrative}
          </p>
        )}
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
          {edge.executiveSummary}
        </p>
      </div>
    </motion.div>
  );
}
