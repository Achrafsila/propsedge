"use client";

import { motion } from "framer-motion";
import { Sprout } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { EvolutionInsight, TraderEvolution } from "@/lib/analytics/traderEvolution";

const EVOLUTION_COLOR = "#3B82F6";

function formatTradingSince(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Renders whatever src/lib/analytics/traderEvolution.ts computes — no
// thresholds, comparisons, or fallback copy decided here. This card is
// real (not a placeholder): it has no "Coming soon" state, only a metadata
// footer describing the overall sample the evolution read was built from.
export function TradingEvolutionCard({ evolution }: { evolution: TraderEvolution }) {
  const rows: EvolutionInsight[] = [
    evolution.activityTrend,
    evolution.holdingTimeTrend,
    evolution.sessionFocusTrend,
    evolution.instrumentFocusTrend,
  ];

  const { sampleSize, tradingDays, firstTrade } = evolution.metadata;

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
            <p
              className="text-[#64748B] mt-1 text-right"
              style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.muted }}
            >
              {row.reasons}
            </p>
          </div>
        ))}
      </div>

      <div
        className="pt-4"
        style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }}
      >
        <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.muted }}>
          Based on {sampleSize} trade{sampleSize === 1 ? "" : "s"} · {tradingDays} trading day{tradingDays === 1 ? "" : "s"}
        </p>
        <p className="text-[#64748B] mt-1" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.muted }}>
          Trading since {formatTradingSince(firstTrade)}
        </p>
      </div>
    </motion.div>
  );
}
