"use client";

import { ListChecks } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { AccountBriefing, BriefingMode } from "@/lib/analytics/aiCoach";
import { fmt$ } from "./formatters";

const MODE_COLOR: Record<BriefingMode, string> = {
  aggressive_attack: "#A855F7",
  growth: "#10B981",
  normal: "#298DFF",
  protection: "#F59E0B",
  recovery: "#F97316",
  payout_protection: "#14B8A6",
  near_breach: "#EF4444",
  no_trading: "#EF4444",
};

// "Near Breach"/"No Trading" modes always read as "No Trading Today" for the
// risk figure — once the guardrail is this tight, a specific dollar number
// is beside the point; the recommendation is simply to stop. The underlying
// engine still computes a real (near-zero) amount for auditability, this is
// purely how the number is presented.
function recommendedRiskLabel(briefing: AccountBriefing): string {
  if (briefing.mode === "near_breach" || briefing.mode === "no_trading") return "No Trading Today";
  return briefing.recommendedRisk.amount !== null ? fmt$(briefing.recommendedRisk.amount) : "—";
}

function RuleCard({ briefing }: { briefing: AccountBriefing }) {
  const color = MODE_COLOR[briefing.mode];
  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: glassmorphism.card.background,
        backdropFilter: glassmorphism.card.backdropBlur,
        border: `1px solid ${color}30`,
        borderRadius: borderRadius.xl,
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-4">
        <p className="text-[#F8FAFC] font-semibold text-sm truncate">{briefing.account.name}</p>
        <span
          className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide flex-shrink-0"
          style={{ background: `${color}1A`, color, border: `1px solid ${color}40` }}
        >
          {briefing.modeLabel}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[#64748B] uppercase mb-0.5" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
            Recommended Risk
          </p>
          <p className="font-bold text-sm" style={{ color }}>
            {recommendedRiskLabel(briefing)}
          </p>
        </div>
        <div>
          <p className="text-[#64748B] uppercase mb-0.5" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
            Maximum Trades
          </p>
          <p className="text-[#F8FAFC] font-bold text-sm">{briefing.maxTrades ?? "—"}</p>
        </div>
        <div>
          <p className="text-[#64748B] uppercase mb-0.5" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
            Stop After
          </p>
          <p className="text-[#F8FAFC] font-bold text-sm">
            {briefing.stopAfterLosses !== null ? `${briefing.stopAfterLosses} loss${briefing.stopAfterLosses === 1 ? "" : "es"}` : "—"}
          </p>
        </div>
        {briefing.remainingTarget !== null && (
          <div>
            <p className="text-[#64748B] uppercase mb-0.5" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
              Remaining Target
            </p>
            <p className="text-[#F8FAFC] font-bold text-sm">{fmt$(Math.max(0, briefing.remainingTarget))}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function TodaysRulesStep({ briefings }: { briefings: AccountBriefing[] }) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-center gap-2 mb-2">
        <ListChecks className="w-5 h-5 text-[#298DFF]" />
        <h2 className="text-[#F8FAFC] font-bold" style={{ fontSize: typography.fontSize["2xl"] }}>
          Today&apos;s Rules
        </h2>
      </div>
      <p className="text-[#94A3B8] text-center mb-6" style={{ fontSize: typography.fontSize.sm }}>
        A separate recommendation for every active account — never one generic rule.
      </p>
      {briefings.length === 0 ? (
        <p className="text-[#64748B] text-center text-sm">No active accounts to brief today.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {briefings.map((b) => (
            <RuleCard key={`${b.account.type}-${b.account.id}`} briefing={b} />
          ))}
        </div>
      )}
    </div>
  );
}
