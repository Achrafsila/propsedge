"use client";

import { motion } from "framer-motion";
import { Brain, ShieldCheck } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { RiskInsight, TraderDiscipline } from "@/lib/analytics/traderDiscipline";

const RISK_COLOR = "#D4AF37";
const LOSS_PSYCHOLOGY_COLOR = "#EF4444";

function InsightRow({ row, color = RISK_COLOR }: { row: RiskInsight; color?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.sm }}>
          {row.label}
        </span>
        <span className="text-[#F8FAFC] font-semibold text-right" style={{ fontSize: typography.fontSize.sm }}>
          {row.value}
        </span>
      </div>
      {row.metricLabel && (
        <p className="mt-1 text-right" style={{ fontSize: typography.fontSize.xs, color }}>
          {row.metricLabel}
        </p>
      )}
      {row.narrative && (
        <p
          className="text-[#94A3B8] mt-1"
          style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}
        >
          {row.narrative}
        </p>
      )}
    </div>
  );
}

// Renders whatever src/lib/analytics/traderDiscipline.ts computes — no
// thresholds, classification, or fallback copy decided here. This card is
// real (not a placeholder): each insight gets its value, its metric, and
// the engine's own deterministic narrative, and the executive summary is
// the engine's narrative too, not something assembled in this component.
export function TradingDisciplineCard({ discipline }: { discipline: TraderDiscipline }) {
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

      <div className="space-y-4 mb-5">
        <InsightRow row={discipline.riskConsistency} />

        {discipline.averagePositionSize.length > 0 && (
          <div>
            <span className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.sm }}>
              Average Position Size
            </span>
            <div className="mt-1.5 space-y-1">
              {discipline.averagePositionSize.map((entry) => (
                <div key={entry.symbol} className="flex items-center justify-between gap-4">
                  <span className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.xs }}>
                    {entry.symbol}
                  </span>
                  <span className="text-[#F8FAFC] font-semibold" style={{ fontSize: typography.fontSize.xs }}>
                    {entry.averageLot}
                  </span>
                </div>
              ))}
            </div>
            <p
              className="text-[#94A3B8] mt-1.5"
              style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}
            >
              {discipline.averagePositionSizeNarrative}
            </p>
          </div>
        )}

        <InsightRow row={discipline.positionSizeAfterWins} />
        <InsightRow row={discipline.positionSizeAfterLosses} />

        {discipline.lotSizeSweetSpot.length > 0 && (
          <div>
            <span className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.sm }}>
              Lot Size Sweet Spot
            </span>
            <div className="mt-1.5 space-y-2">
              {discipline.lotSizeSweetSpot.map((entry) => (
                <div key={entry.symbol}>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.xs }}>
                      {entry.symbol}
                    </span>
                    <span className="text-[#F8FAFC] font-semibold" style={{ fontSize: typography.fontSize.xs }}>
                      {entry.lot}
                    </span>
                  </div>
                  <p className="mt-0.5 text-right" style={{ fontSize: typography.fontSize.xs, color: RISK_COLOR }}>
                    {entry.metricLabel}
                  </p>
                  <p
                    className="text-[#94A3B8] mt-0.5"
                    style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}
                  >
                    {entry.narrative}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
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

      <div className="pt-4 mt-4" style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }}>
        <div className="flex items-center gap-2 mb-1">
          <Brain className="w-4 h-4" style={{ color: LOSS_PSYCHOLOGY_COLOR }} />
          <h4 className="text-[#F8FAFC] font-bold" style={{ fontSize: typography.fontSize.sm }}>
            Loss Psychology
          </h4>
        </div>
        <p
          className="text-[#94A3B8] mb-4"
          style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}
        >
          How you behave immediately after losing or winning.
        </p>

        <div className="space-y-4 mb-4">
          <InsightRow row={discipline.performanceAfterLoss} color={LOSS_PSYCHOLOGY_COLOR} />
          <InsightRow row={discipline.performanceAfterWin} color={LOSS_PSYCHOLOGY_COLOR} />
          <InsightRow row={discipline.revengeTradingRisk} color={LOSS_PSYCHOLOGY_COLOR} />
          <InsightRow row={discipline.recoveryRate} color={LOSS_PSYCHOLOGY_COLOR} />
          <InsightRow row={discipline.revengeTradingScore} color={LOSS_PSYCHOLOGY_COLOR} />
        </div>

        <h4 className="text-[#F8FAFC] font-semibold mb-1.5" style={{ fontSize: typography.fontSize.sm }}>
          Behavioural Summary
        </h4>
        <p
          className="text-[#94A3B8]"
          style={{
            fontSize: typography.fontSize.xs,
            opacity: typography.opacity.tertiary,
            lineHeight: typography.lineHeight.relaxed,
          }}
        >
          {discipline.lossPsychologySummary}
        </p>
      </div>
    </motion.div>
  );
}
