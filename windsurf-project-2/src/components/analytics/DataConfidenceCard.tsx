"use client";

import { motion } from "framer-motion";
import { Award, BadgeCheck, Radar, Sprout, TrendingUp } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { DataConfidence, DataConfidenceLevel } from "@/lib/analytics/dataConfidence";

const LEVEL_VISUALS: Record<DataConfidenceLevel, { icon: React.ElementType; color: string }> = {
  getting_started: { icon: Sprout, color: "#64748B" },
  early_signals: { icon: Radar, color: "#298DFF" },
  developing_profile: { icon: TrendingUp, color: "#8B5CF6" },
  reliable_profile: { icon: BadgeCheck, color: "#10B981" },
  established_dna: { icon: Award, color: "#D4AF37" },
};

// Purely informational — renders whatever src/lib/analytics/dataConfidence.ts
// computes. It never gates, hides, or disables any other Trader DNA card or
// KPI; a trader with zero trades still sees this banner alongside every
// other section, just with a "Getting Started" read instead of a block.
export function DataConfidenceCard({ confidence }: { confidence: DataConfidence }) {
  const { icon: Icon, color } = LEVEL_VISUALS[confidence.level];

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div
        className="rounded-xl p-5"
        style={{
          background: glassmorphism.card.background,
          backdropFilter: glassmorphism.card.backdropBlur,
          border: "1px solid rgba(148,163,184,0.08)",
          borderRadius: borderRadius.xl,
        }}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}1A` }}
            >
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              <p
                className="uppercase"
                style={{
                  color: "#94A3B8",
                  fontSize: typography.fontSize.xs,
                  fontWeight: typography.fontWeight.medium,
                  letterSpacing: typography.letterSpacing.label,
                  opacity: typography.opacity.secondary,
                }}
              >
                Profile Maturity
              </p>
              <p className="font-bold" style={{ color, fontSize: typography.fontSize.lg }}>
                {confidence.label}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-right">
            <div>
              <p className="font-extrabold" style={{ color, fontSize: typography.fontSize.xl }}>
                {confidence.score}%
              </p>
              <p
                className="uppercase"
                style={{
                  color: "#64748B",
                  fontSize: typography.fontSize.xs,
                  opacity: typography.opacity.muted,
                  letterSpacing: typography.letterSpacing.label,
                }}
              >
                Confidence
              </p>
            </div>
            <div>
              <p className="text-[#F8FAFC] font-semibold" style={{ fontSize: typography.fontSize.sm }}>
                {confidence.totalTrades}
              </p>
              <p
                className="uppercase"
                style={{
                  color: "#64748B",
                  fontSize: typography.fontSize.xs,
                  opacity: typography.opacity.muted,
                  letterSpacing: typography.letterSpacing.label,
                }}
              >
                Trades
              </p>
            </div>
            <div>
              <p className="text-[#F8FAFC] font-semibold" style={{ fontSize: typography.fontSize.sm }}>
                {confidence.activeDays}
              </p>
              <p
                className="uppercase"
                style={{
                  color: "#64748B",
                  fontSize: typography.fontSize.xs,
                  opacity: typography.opacity.muted,
                  letterSpacing: typography.letterSpacing.label,
                }}
              >
                Active Days
              </p>
            </div>
          </div>
        </div>

        <p
          className="mt-3"
          style={{ color: "#94A3B8", fontSize: typography.fontSize.sm, opacity: typography.opacity.tertiary }}
        >
          {confidence.message}
        </p>
      </div>
    </motion.div>
  );
}
