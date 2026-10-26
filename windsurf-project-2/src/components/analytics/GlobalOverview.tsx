"use client";

import { motion } from "framer-motion";
import { Activity, Clock, DollarSign, Layers, Repeat, Scale } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import {
  DNAInsight,
  ExpectancyResult,
  getProgressiveDataLabel,
  ProfitFactorResult,
  PropFirmConsistency,
  SessionKey,
} from "@/lib/analytics/traderDNA";
import { CountUpNumber } from "@/components/analytics/visualizations/CountUpNumber";

const cardVariants = { hover: { y: -4, transition: { duration: 0.3 } } };

function KpiCard({
  icon: Icon,
  label,
  value,
  numericValue,
  format,
  color,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  numericValue?: number | null;
  format?: (v: number) => string;
  color: string;
  sub: string;
}) {
  return (
    <motion.div variants={cardVariants} whileHover="hover">
      <div
        className="relative h-full min-w-0 rounded-xl p-4 sm:p-5 transition-all duration-300"
        style={{
          background: glassmorphism.card.background,
          backdropFilter: glassmorphism.card.backdropBlur,
          border: "1px solid rgba(148,163,184,0.08)",
          borderRadius: borderRadius.xl,
        }}
      >
        <div className="flex items-start justify-between mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${color}1A` }}
          >
            <Icon className="w-5 h-5" style={{ color }} />
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
            fontSize: "clamp(1.35rem, 2.1vw, 2.05rem)",
            fontWeight: typography.fontWeight.extraBold,
            letterSpacing: typography.letterSpacing.kpi,
            lineHeight: typography.lineHeight.kpi,
          }}
        >
          {numericValue != null && format ? <CountUpNumber value={numericValue} format={format} /> : value}
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
  // Trader DNA never blocks a KPI for low sample size — every card below
  // always shows its current, mathematically valid value. progressiveLabel
  // only controls the wording wrapped around that value (see
  // getProgressiveDataLabel in traderDNA.ts).
  const progressiveLabel = getProgressiveDataLabel(expectancy.totalTrades);
  const hasNoTrades = progressiveLabel === "No trades yet";
  const progressivePrefix = !hasNoTrades && progressiveLabel !== "Normal" ? `${progressiveLabel} · ` : "";

  const consistencyPct =
    propFirmConsistency.percentage !== null ? Math.round(propFirmConsistency.percentage) : null;

  const expectancyValue =
    expectancy.expectancy !== null
      ? `${expectancy.expectancy >= 0 ? "+" : "-"}$${Math.abs(expectancy.expectancy).toFixed(2)} / trade`
      : "No trades yet";

  const profitFactorValue =
    profitFactor.totalTrades === 0 ? "No trades yet" : profitFactor.profitFactor !== null ? profitFactor.profitFactor.toFixed(2) : "∞";
  const profitFactorSub =
    profitFactor.totalTrades === 0
      ? ""
      : profitFactor.profitFactor !== null
        ? `Gross Profit is ${profitFactor.profitFactor.toFixed(2)}× larger than Gross Loss.`
        : "No losing trades yet.";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3">
      <KpiCard
        icon={Activity}
        label="Trading Frequency"
        value={hasNoTrades ? "No trades yet" : `${tradingFrequency.value.toFixed(1)}/day`}
        numericValue={hasNoTrades ? null : tradingFrequency.value}
        format={(v) => `${v.toFixed(1)}/day`}
        color="#298DFF"
        sub={
          hasNoTrades
            ? ""
            : `${progressivePrefix}${tradingFrequency.sampleSize} active trading day${tradingFrequency.sampleSize === 1 ? "" : "s"}`
        }
      />
      <KpiCard
        icon={Repeat}
        label="Profit Consistency"
        value={consistencyPct !== null ? `${consistencyPct}%` : "N/A"}
        numericValue={consistencyPct}
        format={(v) => `${Math.round(v)}%`}
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
        value={hasNoTrades ? "No trades yet" : (preferredSession.value as string)}
        color="#10B981"
        sub={hasNoTrades ? "" : `${progressivePrefix}${sessionTradeCount} of ${preferredSession.sampleSize} trades`}
      />
      <KpiCard
        icon={Layers}
        label="Most Traded Instrument"
        value={hasNoTrades ? "No trades yet" : (preferredInstrument.value as string)}
        color="#D4AF37"
        sub={
          hasNoTrades ? "" : `${progressivePrefix}${instrumentTradeCount} of ${preferredInstrument.sampleSize} trades`
        }
      />
      <KpiCard
        icon={DollarSign}
        label="Expectancy"
        value={expectancyValue}
        numericValue={expectancy.expectancy}
        format={(v) => `${v >= 0 ? "+" : "-"}$${Math.abs(v).toFixed(2)} / trade`}
        color="#F97316"
        sub={expectancy.expectancy !== null ? "Average profit generated per executed trade." : ""}
      />
      <KpiCard
        icon={Scale}
        label="Profit Factor"
        value={profitFactorValue}
        numericValue={profitFactor.totalTrades > 0 ? profitFactor.profitFactor : null}
        format={(v) => v.toFixed(2)}
        color="#06B6D4"
        sub={profitFactorSub}
      />
    </div>
  );
}
