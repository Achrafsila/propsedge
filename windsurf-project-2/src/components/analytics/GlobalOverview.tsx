"use client";

import { motion } from "framer-motion";
import { Activity, Clock, Layers, Repeat } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { DNAInsight, SessionKey, TradingConsistencyBreakdown } from "@/lib/analytics/traderDNA";

const cardVariants = { hover: { y: -4, transition: { duration: 0.3 } } };

// Below this many trades/days, an insight's confidence is under ~0.2 (see
// computeConfidence in traderDNA.ts) — too thin a sample to show a specific
// value without it reading as more reliable than it is.
const MIN_SAMPLE_SIZE_FOR_DISPLAY = 5;

function hasEnoughData(sampleSize: number): boolean {
  return sampleSize >= MIN_SAMPLE_SIZE_FOR_DISPLAY;
}

function confidenceLabel(confidence: number): string {
  return `${Math.round(confidence * 100)}% confidence`;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  sub: string;
}) {
  return (
    <motion.div variants={cardVariants} whileHover="hover">
      <div
        className="relative rounded-xl p-6 transition-all duration-300"
        style={{
          background: glassmorphism.card.background,
          backdropFilter: glassmorphism.card.backdropBlur,
          border: "1px solid rgba(148,163,184,0.08)",
          borderRadius: borderRadius.xl,
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: `${color}1A` }}
          >
            <Icon className="w-6 h-6" style={{ color }} />
          </div>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: color }} />
        </div>
        <p
          className="text-[#94A3B8] mb-2 uppercase"
          style={{
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.medium,
            letterSpacing: typography.letterSpacing.label,
            opacity: typography.opacity.secondary,
          }}
        >
          {label}
        </p>
        <p
          style={{
            color,
            fontSize: typography.fontSize.kpi,
            fontWeight: typography.fontWeight.extraBold,
            letterSpacing: typography.letterSpacing.kpi,
            lineHeight: typography.lineHeight.kpi,
          }}
        >
          {value}
        </p>
        <p className="text-[#64748B] mt-2" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}>
          {sub}
        </p>
      </div>
    </motion.div>
  );
}

export function GlobalOverview({
  tradingFrequency,
  tradingConsistency,
  preferredSession,
  preferredInstrument,
}: {
  tradingFrequency: DNAInsight<number>;
  tradingConsistency: DNAInsight<TradingConsistencyBreakdown>;
  preferredSession: DNAInsight<SessionKey | null>;
  preferredInstrument: DNAInsight<string | null>;
}) {
  const frequencyReady = hasEnoughData(tradingFrequency.sampleSize);
  const consistencyReady = hasEnoughData(tradingConsistency.sampleSize);
  const sessionReady = hasEnoughData(preferredSession.sampleSize) && !!preferredSession.value;
  const instrumentReady = hasEnoughData(preferredInstrument.sampleSize) && !!preferredInstrument.value;

  const consistencyPct = consistencyReady
    ? Math.round((tradingConsistency.value.profitableDays / tradingConsistency.sampleSize) * 100)
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <KpiCard
        icon={Activity}
        label="Trading Frequency"
        value={frequencyReady ? `${tradingFrequency.value.toFixed(1)}/day` : "Not enough data"}
        color="#298DFF"
        sub={
          frequencyReady
            ? `${tradingFrequency.sampleSize} active days · ${confidenceLabel(tradingFrequency.confidence)}`
            : "Need more closed trades"
        }
      />
      <KpiCard
        icon={Repeat}
        label="Consistency"
        value={consistencyReady ? `${consistencyPct}%` : "Not enough data"}
        color="#8B5CF6"
        sub={
          consistencyReady
            ? `${tradingConsistency.value.profitableDays} of ${tradingConsistency.sampleSize} days · ${confidenceLabel(tradingConsistency.confidence)}`
            : "Need more closed trades"
        }
      />
      <KpiCard
        icon={Clock}
        label="Preferred Session"
        value={sessionReady ? (preferredSession.value as string) : "Not enough data"}
        color="#10B981"
        sub={
          sessionReady
            ? `${preferredSession.sampleSize} trades · ${confidenceLabel(preferredSession.confidence)}`
            : "Need more closed trades"
        }
      />
      <KpiCard
        icon={Layers}
        label="Primary Instrument"
        value={instrumentReady ? (preferredInstrument.value as string) : "Not enough data"}
        color="#D4AF37"
        sub={
          instrumentReady
            ? `${preferredInstrument.sampleSize} trades · ${confidenceLabel(preferredInstrument.confidence)}`
            : "Need more closed trades"
        }
      />
    </div>
  );
}
