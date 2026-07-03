"use client";

import { motion } from "framer-motion";
import { EyeOff, ShieldCheck, Sprout } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { TraderIdentity } from "@/lib/analytics/traderIdentity";
import { TraderHabits } from "@/lib/analytics/traderHabits";
import { TraderEdge } from "@/lib/analytics/traderEdge";
import { TradingIdentityCard } from "@/components/analytics/TradingIdentityCard";
import { TradingHabitsCard } from "@/components/analytics/TradingHabitsCard";
import { TradingEdgeCard } from "@/components/analytics/TradingEdgeCard";

const COMING_SOON = "Coming soon";

interface InsightRow {
  label: string;
  value: string;
}

function SectionCard({
  icon: Icon,
  color,
  title,
  description,
  rows,
}: {
  icon: React.ElementType;
  color: string;
  title: string;
  description: string;
  rows: InsightRow[];
}) {
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
          style={{ background: `${color}1A` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <h3 className="text-[#F8FAFC] font-bold" style={{ fontSize: typography.fontSize.section }}>
          {title}
        </h3>
      </div>

      <p
        className="text-[#94A3B8] mb-5"
        style={{ fontSize: typography.fontSize.sm, opacity: typography.opacity.tertiary }}
      >
        {description}
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

      <p
        className="text-[#64748B]"
        style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.muted }}
      >
        Calculation rules coming soon
      </p>
    </motion.div>
  );
}

// ── Trader DNA — final page structure ─────────────────────────────────────
// Trading Identity (src/lib/analytics/traderIdentity.ts), Your Habits
// (src/lib/analytics/traderHabits.ts), and Your Edge
// (src/lib/analytics/traderEdge.ts) are real, fully computed sections — no
// thresholds or fallback values live in this component, it only renders
// each engine's output. The remaining three sections are intentionally
// "Coming soon" until those specific formulas (blind-spot flags, discipline,
// evolution) exist.
export function TraderDNASections({
  identity,
  habits,
  edge,
}: {
  identity: TraderIdentity;
  habits: TraderHabits;
  edge: TraderEdge;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <TradingIdentityCard identity={identity} />

      <TradingHabitsCard habits={habits} />

      <TradingEdgeCard edge={edge} />

      <SectionCard
        icon={EyeOff}
        color="#EF4444"
        title="Blind Spots"
        description="Patterns that quietly work against you — overtrading, revenge trades, or sessions that hurt more than help."
        rows={[
          { label: "Overtrading Risk", value: COMING_SOON },
          { label: "Revenge-Trading Signal", value: COMING_SOON },
          { label: "Weakest Session", value: COMING_SOON },
        ]}
      />

      <SectionCard
        icon={ShieldCheck}
        color="#D4AF37"
        title="Discipline"
        description="How closely your execution matches your plan — sizing, timing, and rule adherence."
        rows={[
          { label: "Plan Adherence", value: COMING_SOON },
          { label: "Sizing Consistency", value: COMING_SOON },
          { label: "Rule Violations", value: COMING_SOON },
        ]}
      />

      <SectionCard
        icon={Sprout}
        color="#3B82F6"
        title="Evolution"
        description="How your trading behaviour is changing over time — improving, drifting, or holding steady."
        rows={[
          { label: "Trend", value: COMING_SOON },
          { label: "Recent Shift", value: COMING_SOON },
          { label: "Momentum", value: COMING_SOON },
        ]}
      />
    </div>
  );
}
