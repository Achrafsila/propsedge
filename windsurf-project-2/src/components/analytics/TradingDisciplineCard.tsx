"use client";

import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { RiskInsight, TraderDiscipline } from "@/lib/analytics/traderDiscipline";
import { AnimatedBar } from "@/components/analytics/visualizations/AnimatedBar";

const RISK_COLOR = "#D4AF37";
const NEUTRAL_COLOR = "#64748B";

// Presentation-only lookups — the engine already decided every classification
// below; these only decide how full a bar reads and what color it gets for
// display. Covers every real bucket confirmed by reading traderDiscipline.ts.
const RISK_CONSISTENCY_FILL: Record<string, number> = {
  "Highly Consistent": 100,
  Consistent: 70,
  Variable: 35,
  "Highly Variable": 10,
};
const RISK_CONSISTENCY_COLOR: Record<string, string> = {
  "Highly Consistent": "#10B981",
  Consistent: "#298DFF",
  Variable: "#F59E0B",
  "Highly Variable": "#EF4444",
};
const POSITION_SIZE_COLOR: Record<string, string> = {
  Stable: "#10B981",
  "Increasing Risk": "#EF4444",
  "Reducing Risk": "#298DFF",
};

function lossDisciplineColor(score: number): string {
  if (score >= 85) return "#10B981";
  if (score >= 70) return "#298DFF";
  if (score >= 50) return "#F59E0B";
  return "#EF4444";
}

// lossDisciplineScore.metricLabel is always exactly "NN/100" (a real 0-100
// composite the engine already computes) when there's enough data — parsed
// directly rather than guessed from the categorical value.
function parseOutOf100(metricLabel: string): number | null {
  const match = metricLabel.match(/^(\d+)\/100$/);
  return match ? Number(match[1]) : null;
}

// positionSizeAfterLosses.metricLabel is always exactly "+NN%"/"-NN%" (the
// real lot-size change between before/after a loss) when there's enough
// data — parsed directly, not guessed.
function parseSignedPercent(metricLabel: string): number | null {
  const match = metricLabel.match(/^([+-]?\d+)%$/);
  return match ? Number(match[1]) : null;
}

interface RiskBarConfig {
  row: RiskInsight;
  fill: number;
  color: string;
  bigValue: string;
}

function buildRiskConsistencyBar(row: RiskInsight): RiskBarConfig {
  return {
    row,
    fill: RISK_CONSISTENCY_FILL[row.value] ?? 0,
    color: RISK_CONSISTENCY_COLOR[row.value] ?? NEUTRAL_COLOR,
    bigValue: row.value,
  };
}

function buildPositionSizeBar(row: RiskInsight): RiskBarConfig {
  const pct = parseSignedPercent(row.metricLabel);
  return {
    row,
    // 0% change reads as fully stable; larger swings (either direction)
    // read as less stable — a deterministic display formula on the real
    // signed percentage, not a new metric.
    fill: pct !== null ? Math.max(0, Math.min(100, 100 - Math.abs(pct))) : 0,
    color: POSITION_SIZE_COLOR[row.value] ?? NEUTRAL_COLOR,
    bigValue: row.value,
  };
}

function buildLossDisciplineBar(row: RiskInsight): RiskBarConfig {
  const score = parseOutOf100(row.metricLabel);
  return {
    row,
    fill: score ?? 0,
    color: score !== null ? lossDisciplineColor(score) : NEUTRAL_COLOR,
    bigValue: score !== null ? `${score}/100` : row.value,
  };
}

function RiskBarRow({ config }: { config: RiskBarConfig }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.sm }}>
          {config.row.label}
        </span>
        <span
          className="font-extrabold tabular-nums"
          style={{ fontSize: typography.fontSize.xl, color: config.color }}
        >
          {config.bigValue}
        </span>
      </div>
      <AnimatedBar label="" percentage={config.fill} color={config.color} showHeader={false} />
      {config.row.metricLabel && (
        <p className="mt-1.5" style={{ fontSize: typography.fontSize.xs, color: RISK_COLOR }}>
          {config.row.metricLabel}
        </p>
      )}
      {config.row.narrative && (
        <p
          className="text-[#94A3B8] mt-1"
          style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}
        >
          {config.row.narrative}
        </p>
      )}
    </div>
  );
}

// Renders whatever src/lib/analytics/traderDiscipline.ts computes — no
// thresholds, classification, or fallback copy decided here (only how full/
// what color each already-decided value renders as — see the lookup tables
// above). Trader DNA V4: this card answers exactly one question — "Am I
// managing risk correctly?" — with three rows (Risk Consistency, Position
// Size After Loss, and the Loss Discipline Score composite) instead of the
// full position-sizing and loss-psychology breakdown.
export function TradingDisciplineCard({ discipline }: { discipline: TraderDiscipline }) {
  const bars: RiskBarConfig[] = [
    buildRiskConsistencyBar(discipline.riskConsistency),
    buildPositionSizeBar(discipline.positionSizeAfterLosses),
    buildLossDisciplineBar(discipline.lossDisciplineScore),
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
          style={{ background: `${RISK_COLOR}1A` }}
        >
          <ShieldCheck className="w-5 h-5" style={{ color: RISK_COLOR }} />
        </div>
        <h3 className="text-[#F8FAFC] font-bold" style={{ fontSize: typography.fontSize.section }}>
          Risk Management
        </h3>
      </div>

      <p
        className="text-[#94A3B8] mb-5"
        style={{ fontSize: typography.fontSize.sm, opacity: typography.opacity.tertiary }}
      >
        How you actually manage your trading risk — position sizing behavior, not profitability.
      </p>

      <div className="space-y-5 mb-5">
        {bars.map((config) => (
          <RiskBarRow key={config.row.label} config={config} />
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
          {discipline.executiveSummary}
        </p>
      </div>
    </motion.div>
  );
}
