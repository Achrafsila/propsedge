"use client";

import { motion } from "framer-motion";
import { Activity, Clock, DollarSign, Layers, Repeat, Scale } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { DNAInsight, ExpectancyResult, ProfitFactorResult, PropFirmConsistency, SessionKey } from "@/lib/analytics/traderDNA";

const cardVariants = { hover: { y: -4, transition: { duration: 0.3 } } };

// Below this many trades/days, an insight is drawn from too thin a sample
// to show a specific value without it reading as more reliable than it is.
const MIN_SAMPLE_SIZE_FOR_DISPLAY = 5;

function hasEnoughData(sampleSize: number): boolean {
  return sampleSize >= MIN_SAMPLE_SIZE_FOR_DISPLAY;
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
  propFirmConsistency,
  preferredSession,
  sessionTradeCount,
  preferredInstrument,
  instrumentTradeCount,
  expectancy,
  profitFactor,
}: {
  tradingFrequency: DNAInsight<number>;
  propFirmConsistency: PropFirmConsistency;
  preferredSession: DNAInsight<SessionKey | null>;
  sessionTradeCount: number;
  preferredInstrument: DNAInsight<string | null>;
  instrumentTradeCount: number;
  expectancy: ExpectancyResult;
  profitFactor: ProfitFactorResult;
}) {
  const frequencyReady = hasEnoughData(tradingFrequency.sampleSize);
  const sessionReady = hasEnoughData(preferredSession.sampleSize) && !!preferredSession.value;
  const instrumentReady = hasEnoughData(preferredInstrument.sampleSize) && !!preferredInstrument.value;

  const consistencyPct =
    propFirmConsistency.percentage !== null ? Math.round(propFirmConsistency.percentage) : null;

  const expectancyValue =
    expectancy.expectancy !== null
      ? `${expectancy.expectancy >= 0 ? "+" : "-"}$${Math.abs(expectancy.expectancy).toFixed(2)} / trade`
      : "Not enough data";

  const profitFactorValue = profitFactor.profitFactor !== null ? profitFactor.profitFactor.toFixed(2) : "∞";
  const profitFactorSub =
    profitFactor.profitFactor !== null
      ? `Gross Profit is ${profitFactor.profitFactor.toFixed(2)}× larger than Gross Loss.`
      : "No losing trades yet.";

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <KpiCard
        icon={Activity}
        label="Trading Frequency"
        value={frequencyReady ? `${tradingFrequency.value.toFixed(1)}/day` : "Not enough data"}
        color="#298DFF"
        sub={frequencyReady ? `${tradingFrequency.sampleSize} active trading days` : "Need more closed trades"}
      />
      <KpiCard
        icon={Repeat}
        label="Profit Consistency"
        value={consistencyPct !== null ? `${consistencyPct}%` : "N/A"}
        color="#8B5CF6"
        sub={
          consistencyPct !== null
            ? `Largest day contributed ${consistencyPct}% of total profits`
            : "Need profitable trades"
        }
      />
      <KpiCard
        icon={Clock}
        label="Most Traded Session"
        value={sessionReady ? (preferredSession.value as string) : "Not enough data"}
        color="#10B981"
        sub={sessionReady ? `${sessionTradeCount} of ${preferredSession.sampleSize} trades` : "Need more closed trades"}
      />
      <KpiCard
        icon={Layers}
        label="Most Traded Instrument"
        value={instrumentReady ? (preferredInstrument.value as string) : "Not enough data"}
        color="#D4AF37"
        sub={
          instrumentReady
            ? `${instrumentTradeCount} of ${preferredInstrument.sampleSize} trades`
            : "Need more closed trades"
        }
      />
      <KpiCard
        icon={DollarSign}
        label="Expectancy"
        value={expectancyValue}
        color="#F97316"
        sub="Average profit generated per executed trade."
      />
      <KpiCard
        icon={Scale}
        label="Profit Factor"
        value={profitFactorValue}
        color="#06B6D4"
        sub={profitFactorSub}
      />
    </div>
  );
}
