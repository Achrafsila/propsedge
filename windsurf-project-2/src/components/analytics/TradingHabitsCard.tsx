"use client";

import { motion } from "framer-motion";
import { Compass } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { TraderHabits } from "@/lib/analytics/traderHabits";

const HABITS_COLOR = "#8B5CF6";

function formatTradingSince(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

interface HabitRow {
  label: string;
  value: string;
}

// Renders whatever src/lib/analytics/traderHabits.ts computes — no
// thresholds, formatting, or fallback copy decided here. This card is real
// (not a placeholder): it has no "Coming soon" state, only a metadata
// footer describing the sample the habits were built from.
export function TradingHabitsCard({ habits }: { habits: TraderHabits }) {
  const rows: HabitRow[] = [
    { label: "Trading Frequency", value: habits.tradingFrequency },
    { label: "Average Holding Time", value: habits.averageHoldingTime },
    { label: "Trading Window", value: habits.tradingWindow },
    { label: "Most Active Day", value: habits.mostActiveDay },
    { label: "Average Entry Time", value: habits.averageEntryTime },
    { label: "Average Exit Time", value: habits.averageExitTime },
  ];

  const { sampleSize, tradingDays, firstTrade } = habits.metadata;

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
          style={{ background: `${HABITS_COLOR}1A` }}
        >
          <Compass className="w-5 h-5" style={{ color: HABITS_COLOR }} />
        </div>
        <h3 className="text-[#F8FAFC] font-bold" style={{ fontSize: typography.fontSize.section }}>
          Your Habits
        </h3>
      </div>

      <p
        className="text-[#94A3B8] mb-5"
        style={{ fontSize: typography.fontSize.sm, opacity: typography.opacity.tertiary }}
      >
        How you naturally trade every day — frequency, timing, and routine.
      </p>

      <div className="space-y-3 mb-5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4">
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
