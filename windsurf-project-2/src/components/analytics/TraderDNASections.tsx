"use client";

import { motion } from "framer-motion";
import { Fingerprint, Compass, Sparkles, EyeOff, ShieldCheck, Sprout } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import {
  DNAInsight,
  SessionKey,
  TradeDirection,
  TradingConsistencyBreakdown,
} from "@/lib/analytics/traderDNA";

const COMING_SOON = "Coming soon";

// Same floor as GlobalOverview.tsx: below this many trades/days an insight's
// confidence is under ~0.2 (see computeConfidence in traderDNA.ts) — too
// thin a sample to show as a specific value.
const MIN_SAMPLE_SIZE_FOR_DISPLAY = 5;

function isReady(sampleSize: number): boolean {
  return sampleSize >= MIN_SAMPLE_SIZE_FOR_DISPLAY;
}

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
// Six placeholder sections that sketch out the full Trader DNA experience.
// "Trading Identity" and "Your Habits" surface real values from the engine
// (src/lib/analytics/traderDNA.ts) wherever the sample is large enough —
// everything else is intentionally "Coming soon" until those specific
// formulas (edge detection, blind-spot flags, discipline, evolution) exist.
export function TraderDNASections({
  preferredSession,
  preferredInstrument,
  preferredDirection,
  tradingFrequency,
  tradingConsistency,
  tradingAge,
}: {
  preferredSession: DNAInsight<SessionKey | null>;
  preferredInstrument: DNAInsight<string | null>;
  preferredDirection: DNAInsight<TradeDirection | null>;
  tradingFrequency: DNAInsight<number>;
  tradingConsistency: DNAInsight<TradingConsistencyBreakdown>;
  tradingAge: DNAInsight<number>;
}) {
  const consistencyValue = isReady(tradingConsistency.sampleSize)
    ? `${Math.round((tradingConsistency.value.profitableDays / tradingConsistency.sampleSize) * 100)}%`
    : COMING_SOON;

  const directionLabel: Record<TradeDirection, string> = { long: "Long", short: "Short" };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <SectionCard
        icon={Fingerprint}
        color="#298DFF"
        title="Trading Identity"
        description="The core shape of how you trade — the instrument, session, and direction you gravitate to."
        rows={[
          {
            label: "Primary Instrument",
            value:
              isReady(preferredInstrument.sampleSize) && preferredInstrument.value
                ? preferredInstrument.value
                : COMING_SOON,
          },
          {
            label: "Preferred Session",
            value:
              isReady(preferredSession.sampleSize) && preferredSession.value
                ? preferredSession.value
                : COMING_SOON,
          },
          {
            label: "Preferred Direction",
            value:
              isReady(preferredDirection.sampleSize) && preferredDirection.value
                ? directionLabel[preferredDirection.value]
                : COMING_SOON,
          },
        ]}
      />

      <SectionCard
        icon={Compass}
        color="#8B5CF6"
        title="Your Habits"
        description="Behavioural patterns in when and how often you trade."
        rows={[
          {
            label: "Trading Frequency",
            value: isReady(tradingFrequency.sampleSize) ? `${tradingFrequency.value.toFixed(1)}/day` : COMING_SOON,
          },
          { label: "Consistency", value: consistencyValue },
          {
            label: "Trading Age",
            value: isReady(tradingAge.sampleSize) ? `${tradingAge.value} days` : COMING_SOON,
          },
        ]}
      />

      <SectionCard
        icon={Sparkles}
        color="#10B981"
        title="Your Edge"
        description="Where your process consistently works — the setups and conditions you tend to win in."
        rows={[
          { label: "Best Setup", value: COMING_SOON },
          { label: "Strongest Session", value: COMING_SOON },
          { label: "Highest Win-Rate Instrument", value: COMING_SOON },
        ]}
      />

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
