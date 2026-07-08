"use client";

import { motion } from "framer-motion";
import { Bot, ShieldCheck, ShieldAlert, Gavel, Wallet, Brain, CheckCircle2, Info, AlertTriangle } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { AICoachOutput, CoachItem, CoachSeverity, CoachRiskLevel } from "@/lib/analytics/aiCoach";

// Renders whatever src/lib/analytics/aiCoach.ts computes — no thresholds,
// classification, or fallback copy decided here, only how each already-
// decided severity/value renders (colors, icons). Same convention as every
// other Trader DNA card (e.g. TradingDisciplineCard.tsx).

const SEVERITY_COLOR: Record<CoachSeverity, string> = {
  positive: "#10B981",
  neutral: "#298DFF",
  warning: "#F59E0B",
  critical: "#EF4444",
};

const SEVERITY_ICON: Record<CoachSeverity, React.ElementType> = {
  positive: CheckCircle2,
  neutral: Info,
  warning: AlertTriangle,
  critical: ShieldAlert,
};

const RISK_LEVEL_COLOR: Record<CoachRiskLevel, string> = {
  low: "#10B981",
  moderate: "#298DFF",
  high: "#F59E0B",
  critical: "#EF4444",
};

const RISK_LEVEL_LABEL: Record<CoachRiskLevel, string> = {
  low: "Low Risk",
  moderate: "Moderate Risk",
  high: "High Risk",
  critical: "Critical Risk",
};

function CoachItemRow({ item }: { item: CoachItem }) {
  const color = SEVERITY_COLOR[item.severity];
  const Icon = SEVERITY_ICON[item.severity];

  return (
    <div className="rounded-lg p-3.5" style={{ background: "rgba(148,163,184,0.04)", border: `1px solid ${color}25` }}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-start gap-2 min-w-0">
          <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color }} />
          <h4 className="text-[#F8FAFC] font-semibold text-sm">{item.title}</h4>
        </div>
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide flex-shrink-0"
          style={{ background: `${color}1A`, color, border: `1px solid ${color}40` }}
        >
          {item.severity}
        </span>
      </div>
      <p className="text-[#CBD5E1] text-sm mb-1.5">{item.message}</p>
      {item.evidence && (
        <p className="text-[#64748B] mb-1.5" style={{ fontSize: typography.fontSize.xs }}>
          {item.evidence}
        </p>
      )}
      {item.action && (
        <p className="font-medium" style={{ fontSize: typography.fontSize.xs, color }}>
          → {item.action}
        </p>
      )}
    </div>
  );
}

function CoachSection({
  title,
  icon: Icon,
  items,
  emptyLabel,
}: {
  title: string;
  icon: React.ElementType;
  items: CoachItem[];
  emptyLabel: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-[#298DFF]" />
        <h3 className="text-[#F8FAFC] font-semibold text-sm">{title}</h3>
        {items.length > 0 && <span className="text-[#64748B] text-xs">({items.length})</span>}
      </div>
      {items.length === 0 ? (
        <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.xs }}>
          {emptyLabel}
        </p>
      ) : (
        <div className="space-y-2.5">
          {items.map((item, i) => (
            <CoachItemRow key={`${item.title}-${i}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AICoachPanel({ coach }: { coach: AICoachOutput }) {
  const riskColor = RISK_LEVEL_COLOR[coach.riskLevel];

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
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${riskColor}1A` }}>
            <Bot className="w-5 h-5" style={{ color: riskColor }} />
          </div>
          <div>
            <h3 className="text-[#F8FAFC] font-bold" style={{ fontSize: typography.fontSize.section }}>
              AI Coach
            </h3>
            <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}>
              Deterministic risk &amp; prop-firm rule guidance
            </p>
          </div>
        </div>
        <span
          className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide flex-shrink-0"
          style={{ background: `${riskColor}1A`, color: riskColor, border: `1px solid ${riskColor}40` }}
        >
          {RISK_LEVEL_LABEL[coach.riskLevel]}
        </span>
      </div>

      {/* Main Priority + Next Best Action */}
      <div className="mt-5 mb-5 rounded-xl p-4" style={{ background: `${riskColor}0D`, border: `1px solid ${riskColor}30` }}>
        <p className="uppercase font-bold tracking-wide mb-1" style={{ fontSize: "0.625rem", color: riskColor }}>
          Main Priority
        </p>
        <p className="text-[#F8FAFC] font-semibold mb-3">{coach.mainPriority}</p>
        <p className="uppercase font-bold tracking-wide mb-1 text-[#94A3B8]" style={{ fontSize: "0.625rem" }}>
          Next Best Action
        </p>
        <p className="text-[#CBD5E1]" style={{ fontSize: typography.fontSize.sm }}>
          {coach.nextBestAction}
        </p>
      </div>

      {/* Recommended Risk */}
      <div
        className="mb-6 flex items-center gap-4 rounded-xl p-4"
        style={{ background: "rgba(148,163,184,0.04)", border: "1px solid rgba(148,163,184,0.08)" }}
      >
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(41,141,255,0.1)" }}>
          <ShieldCheck className="w-5 h-5 text-[#298DFF]" />
        </div>
        <div className="min-w-0">
          <p className="text-[#94A3B8] uppercase tracking-wide mb-0.5" style={{ fontSize: typography.fontSize.xs }}>
            Recommended Risk / Trade
          </p>
          <p className="text-[#F8FAFC] font-extrabold tabular-nums" style={{ fontSize: typography.fontSize.xl }}>
            {coach.recommendedRisk.amount !== null
              ? `$${coach.recommendedRisk.amount.toLocaleString("en-US")}${coach.recommendedRisk.currency ? ` ${coach.recommendedRisk.currency}` : ""}`
              : "—"}
          </p>
          <p className="text-[#64748B] mt-0.5" style={{ fontSize: typography.fontSize.xs }}>
            {coach.recommendedRisk.rationale}
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CoachSection title="Active Account Risk" icon={ShieldAlert} items={coach.accountAlerts} emptyLabel="No active accounts to monitor." />
        <CoachSection title="Prop Rule Alerts" icon={Gavel} items={coach.propRuleAlerts} emptyLabel="No active prop-firm rule alerts." />
        <CoachSection title="Payout Readiness" icon={Wallet} items={coach.payoutReadiness} emptyLabel="No funded accounts to evaluate." />
        <CoachSection title="Behavioural Notes" icon={Brain} items={coach.behaviouralInsights} emptyLabel="No behavioural flags right now." />
      </div>

      {/* Summary */}
      <div className="mt-6 pt-4" style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }}>
        <h4 className="text-[#F8FAFC] font-semibold mb-1.5" style={{ fontSize: typography.fontSize.sm }}>
          Summary
        </h4>
        <p
          className="text-[#94A3B8]"
          style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary, lineHeight: typography.lineHeight.relaxed }}
        >
          {coach.summary}
        </p>
      </div>
    </motion.div>
  );
}
