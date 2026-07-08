"use client";

import { motion } from "framer-motion";
import { Clock3 } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { TraderIdentity } from "@/lib/analytics/traderIdentity";
import { AnimatedBar } from "@/components/analytics/visualizations/AnimatedBar";

const SESSION_COLOR = "#298DFF";

// Presentation-only color per session — cosmetic, same category as any
// other status-color lookup in the app. Falls back to SESSION_COLOR for any
// session name not in the map (e.g. a future session type).
const SESSION_COLORS: Record<string, string> = {
  "New York": "#298DFF",
  London: "#8B5CF6",
  Asian: "#F59E0B",
  "No Session": "#64748B",
};

// Full ranked session breakdown from identity.sessionDistribution — the same
// real data traderIdentity.ts already computes for the Session Profile
// classification, just given its own visual space as horizontal bars.
export function SessionPerformanceCard({ identity }: { identity: TraderIdentity }) {
  const distribution = identity.sessionDistribution;

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
          style={{ background: `${SESSION_COLOR}1A` }}
        >
          <Clock3 className="w-5 h-5" style={{ color: SESSION_COLOR }} />
        </div>
        <h3 className="text-[#F8FAFC] font-bold" style={{ fontSize: typography.fontSize.section }}>
          Session Performance
        </h3>
      </div>

      <p
        className="text-[#94A3B8] mb-5"
        style={{ fontSize: typography.fontSize.sm, opacity: typography.opacity.tertiary }}
      >
        Where your trading activity concentrates across the day.
      </p>

      {distribution.length === 0 ? (
        <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.sm }}>
          Not enough trade history yet to break down session activity.
        </p>
      ) : (
        <div className="space-y-4">
          {distribution.map((entry, i) => (
            <AnimatedBar
              key={entry.session}
              label={entry.session}
              percentage={entry.percentage}
              color={SESSION_COLORS[entry.session] ?? SESSION_COLOR}
              delay={i * 0.08}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
