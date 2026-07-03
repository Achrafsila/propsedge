"use client";

import { motion } from "framer-motion";
import { EyeOff } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { BlindSpotInsight, TraderBlindSpots } from "@/lib/analytics/traderBlindSpots";

const BLIND_SPOTS_COLOR = "#EF4444";

// Renders whatever src/lib/analytics/traderBlindSpots.ts computes — no
// thresholds, ranking, or fallback copy decided here. This card is real
// (not a placeholder): each insight gets its value, its expectancy metric,
// and the engine's own deterministic narrative, and the executive summary
// is the engine's narrative too, not something assembled in this
// component.
export function TradingBlindSpotsCard({ blindSpots }: { blindSpots: TraderBlindSpots }) {
  const rows: BlindSpotInsight[] = [
    blindSpots.worstSession,
    blindSpots.worstInstrument,
    blindSpots.weakestWeekday,
    blindSpots.performanceAfterTradeNumber,
  ];

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
          style={{ background: `${BLIND_SPOTS_COLOR}1A` }}
        >
          <EyeOff className="w-5 h-5" style={{ color: BLIND_SPOTS_COLOR }} />
        </div>
        <h3 className="text-[#F8FAFC] font-bold" style={{ fontSize: typography.fontSize.section }}>
          Blind Spots
        </h3>
      </div>

      <p
        className="text-[#94A3B8] mb-5"
        style={{ fontSize: typography.fontSize.sm, opacity: typography.opacity.tertiary }}
      >
        In which situations you should be most careful — contexts that quietly work against you, not a judgment on you.
      </p>

      <div className="space-y-4 mb-5">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.sm }}>
                {row.label}
              </span>
              <span
                className="text-[#F8FAFC] font-semibold text-right"
                style={{ fontSize: typography.fontSize.sm }}
              >
                {row.value}
              </span>
            </div>
            {row.metricLabel && (
              <p
                className="mt-1 text-right"
                style={{ fontSize: typography.fontSize.xs, color: BLIND_SPOTS_COLOR }}
              >
                {row.metricLabel}
              </p>
            )}
            {row.narrative && (
              <p
                className="text-[#94A3B8] mt-1"
                style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}
              >
                {row.narrative}
              </p>
            )}
          </div>
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
          {blindSpots.executiveSummary}
        </p>
      </div>
    </motion.div>
  );
}
