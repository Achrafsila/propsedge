"use client";

import { HeartPulse } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { AccountBriefing, AccountRiskState } from "@/lib/analytics/aiCoach";
import { fmt$ } from "./formatters";

const HEALTH_EMOJI: Record<AccountBriefing["healthTier"], string> = {
  healthy: "🟢",
  watch: "🟠",
  critical: "🔴",
};

const HEALTH_COLOR: Record<AccountBriefing["healthTier"], string> = {
  healthy: "#10B981",
  watch: "#F59E0B",
  critical: "#EF4444",
};

function HealthCard({ briefing, riskState }: { briefing: AccountBriefing; riskState: AccountRiskState | undefined }) {
  const color = HEALTH_COLOR[briefing.healthTier];
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
          className="px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0"
          style={{ background: `${color}1A`, color, border: `1px solid ${color}40` }}
        >
          {HEALTH_EMOJI[briefing.healthTier]} {briefing.healthLabel}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[#64748B] uppercase mb-0.5" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
            Remaining Daily Buffer
          </p>
          <p className="text-[#F8FAFC] font-bold text-sm">
            {riskState?.dailyBuffer !== null && riskState?.dailyBuffer !== undefined ? fmt$(riskState.dailyBuffer) : "—"}
          </p>
        </div>
        <div>
          <p className="text-[#64748B] uppercase mb-0.5" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
            Remaining Max Buffer
          </p>
          <p className="text-[#F8FAFC] font-bold text-sm">{riskState ? fmt$(riskState.maxBuffer) : "—"}</p>
        </div>
      </div>
    </div>
  );
}

export function AccountHealthStep({
  briefings,
  riskStates,
}: {
  briefings: AccountBriefing[];
  riskStates: AccountRiskState[];
}) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-center gap-2 mb-6">
        <HeartPulse className="w-5 h-5 text-[#298DFF]" />
        <h2 className="text-[#F8FAFC] font-bold" style={{ fontSize: typography.fontSize["2xl"] }}>
          Account Health
        </h2>
      </div>
      {briefings.length === 0 ? (
        <p className="text-[#64748B] text-center text-sm">No active accounts to monitor today.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {briefings.map((b) => {
            const riskState = riskStates.find((s) => s.account.id === b.account.id && s.account.type === b.account.type);
            return <HealthCard key={`${b.account.type}-${b.account.id}`} briefing={b} riskState={riskState} />;
          })}
        </div>
      )}
    </div>
  );
}
