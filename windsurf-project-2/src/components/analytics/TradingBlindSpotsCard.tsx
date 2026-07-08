"use client";

import { motion } from "framer-motion";
import { EyeOff, TrendingDown } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { TraderBlindSpots } from "@/lib/analytics/traderBlindSpots";

const BLIND_SPOTS_COLOR = "#EF4444";

// Renders whatever src/lib/analytics/traderBlindSpots.ts computes — no
// thresholds, ranking, or fallback copy decided here. Trader DNA V4: this
// card answers exactly one question — "Where do I lose my edge?" — with a
// single flagship insight (Biggest Leak) instead of a list of per-dimension
// rankings. Worst Session/Instrument/Weekday and Performance After Trade
// Number are still computed by the engine for the AI Coach; they just
// aren't rendered here. Unlike Your Edge's bestSetup, biggestLeak has no
// `detail` field — it's a genuine single-dimension insight, not a 3-part
// combo — so this card deliberately doesn't force a matching badge row.
export function TradingBlindSpotsCard({ blindSpots }: { blindSpots: TraderBlindSpots }) {
  const { biggestLeak } = blindSpots;

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
        Where you lose your edge — contexts that quietly work against you, not a judgment on you.
      </p>

      <div
        className="rounded-xl p-5 mb-5"
        style={{ background: `${BLIND_SPOTS_COLOR}0D`, border: `1px solid ${BLIND_SPOTS_COLOR}33` }}
      >
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
          Biggest Leak
        </p>
        <p
          className="font-extrabold"
          style={{ color: "#F8FAFC", fontSize: typography.fontSize.kpi, lineHeight: typography.lineHeight.kpi }}
        >
          {biggestLeak.value}
        </p>

        {biggestLeak.metricLabel && (
          <div className="flex items-center gap-1.5 mt-3">
            <TrendingDown className="w-4 h-4" style={{ color: BLIND_SPOTS_COLOR }} />
            <span className="font-bold" style={{ color: BLIND_SPOTS_COLOR, fontSize: typography.fontSize.lg }}>
              {biggestLeak.metricLabel}
            </span>
          </div>
        )}

        {biggestLeak.narrative && (
          <p
            className="mt-3"
            style={{ color: "#94A3B8", fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}
          >
            {biggestLeak.narrative}
          </p>
        )}

        {biggestLeak.sampleSize > 0 && (
          <p className="mt-2" style={{ color: "#64748B", fontSize: typography.fontSize.xs, opacity: typography.opacity.muted }}>
            Based on {biggestLeak.sampleSize} trades
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
          {blindSpots.executiveSummary}
        </p>
      </div>
    </motion.div>
  );
}
