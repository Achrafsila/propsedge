"use client";

import { motion } from "framer-motion";
import { Compass } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { TraderHabits } from "@/lib/analytics/traderHabits";

const HABITS_COLOR = "#8B5CF6";

interface HabitBlock {
  label: string;
  value: string;
  note: string;
}

// Renders whatever src/lib/analytics/traderHabits.ts computes — no
// thresholds, formatting, or fallback copy decided here. This card is real
// (not a placeholder): each behavioral insight gets its value plus the
// engine's own deterministic explanation, and the executive summary is
// the engine's narrative, not something assembled in this component.
export function TradingHabitsCard({ habits }: { habits: TraderHabits }) {
  const blocks: HabitBlock[] = [
    {
      label: "Average Holding Time",
      value: habits.averageHoldingTime,
      note: habits.averageHoldingTimeExplanation,
    },
    {
      label: "Trading Window",
      value: habits.tradingWindow,
      note: habits.tradingWindowExplanation,
    },
    {
      label: "Execution Pace",
      value: habits.executionPace,
      note: habits.executionPaceExplanation,
    },
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
        How you naturally trade every day — execution style, timing, and routine.
      </p>

      <div className="space-y-5 mb-5">
        {blocks.map((block) => (
          <div key={block.label}>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.sm }}>
                {block.label}
              </span>
              <span
                className="text-[#F8FAFC] font-semibold text-right"
                style={{ fontSize: typography.fontSize.sm }}
              >
                {block.value}
              </span>
            </div>
            <p
              className="text-[#94A3B8] mt-1.5"
              style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}
            >
              {block.note}
            </p>
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
          {habits.executiveSummary}
        </p>
      </div>
    </motion.div>
  );
}
