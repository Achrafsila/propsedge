"use client";

import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { RiskInsight, TraderDiscipline } from "@/lib/analytics/traderDiscipline";

const RISK_COLOR = "#D4AF37";

function InsightRow({ row }: { row: RiskInsight }) {
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
        <p className="mt-1 text-right" style={{ fontSize: typography.fontSize.xs, color: RISK_COLOR }}>
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
// thresholds, classification, or fallback copy decided here. Trader DNA
// V4: this card answers exactly one question — "Am I managing risk
// correctly?" — with three rows (Risk Consistency, Position Size After
// Loss, and the Loss Discipline Score composite) instead of the full
// position-sizing and loss-psychology breakdown. Average Position Size,
// Position Size After Wins, Lot Size Sweet Spot, and every individual
// Loss Psychology insight are still computed by the engine for the AI
// Coach; they just aren't rendered here.
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
        <InsightRow row={discipline.positionSizeAfterLosses} />
        <InsightRow row={discipline.lossDisciplineScore} />
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
