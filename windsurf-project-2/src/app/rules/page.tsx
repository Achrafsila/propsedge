"use client";

import { useMemo } from "react";
import type { CSSProperties } from "react";
import { Scale, AlertTriangle, CheckCircle } from "lucide-react";
import { useAccounts } from "@/context/AccountsContext";
import { useTodayObjective } from "@/context/TodayObjectiveContext";
import { useDailyContracts } from "@/context/DailyContractsContext";
import { todayDateString, daysAgoDateString } from "@/lib/dateKey";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { getTraderIdentity } from "@/lib/analytics/traderIdentity";
import { getTraderHabits } from "@/lib/analytics/traderHabits";
import { getTraderEdge } from "@/lib/analytics/traderEdge";
import { getTraderBlindSpots } from "@/lib/analytics/traderBlindSpots";
import { getTraderDiscipline } from "@/lib/analytics/traderDiscipline";
import { getTraderEvolution } from "@/lib/analytics/traderEvolution";
import { getDataConfidence } from "@/lib/analytics/dataConfidence";
import { getAccountBriefings } from "@/lib/analytics/aiCoach";
import { computeDeviations, computeDailyAccountability, Deviation, DeviationSeverity } from "@/lib/analytics/accountabilityEngine";

// ============================================================
// PropEdge — Rules page (EdgePilot V2)
// ============================================================
// Was a fully static stub (hardcoded "0%"/"No data", no computation at
// all). Now a compliance-focused view over the same Accountability Engine
// output EdgePilot's cockpit uses — per-account Rule Compliance % plus a
// trailing 7-day violation history (each day's own committed contract
// re-audited against that day's trades), rather than just "today."

const CARD: CSSProperties = {
  background: glassmorphism.card.background,
  backdropFilter: glassmorphism.card.backdropBlur,
  border: "1px solid rgba(148,163,184,0.08)",
  borderRadius: borderRadius.xl,
};

const fmt$ = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

const SEVERITY_COLOR: Record<DeviationSeverity, string> = {
  critical: "#EF4444",
  high: "#F59E0B",
  medium: "#298DFF",
  low: "#94A3B8",
};

const RECENT_WINDOW_DAYS = 7;

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center"
      style={{ background: `${color}1A`, color, border: `1px solid ${color}40` }}
    >
      {children}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, detail }: { icon: React.ElementType; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl p-5" style={CARD}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.sm }}>{label}</p>
        <Icon className="w-4 h-4 text-[#64748B]" />
      </div>
      <p className="text-[#F8FAFC] font-extrabold" style={{ fontSize: typography.fontSize.xl }}>{value}</p>
      <p className="text-[#64748B] mt-1" style={{ fontSize: typography.fontSize.xs }}>{detail}</p>
    </div>
  );
}

interface DatedDeviation extends Deviation {
  date: string;
}

export default function Rules() {
  const { challenges, fundedAccounts, personalAccounts, trades, payouts, challengesLoading, fundedAccountsLoading, tradesLoading } =
    useAccounts();
  const { objective } = useTodayObjective();
  const { getContract, contracts, contractsLoading } = useDailyContracts();

  const isLoading = challengesLoading || fundedAccountsLoading || tradesLoading || contractsLoading;
  const today = todayDateString();
  const cutoff = daysAgoDateString(RECENT_WINDOW_DAYS);

  const identity = useMemo(() => getTraderIdentity(trades), [trades]);
  const habits = useMemo(() => getTraderHabits(trades), [trades]);
  const edge = useMemo(() => getTraderEdge(trades), [trades]);
  const blindSpots = useMemo(() => getTraderBlindSpots(trades), [trades]);
  const discipline = useMemo(() => getTraderDiscipline(trades), [trades]);
  const evolution = useMemo(() => getTraderEvolution(trades), [trades]);
  const dataConfidence = useMemo(() => getDataConfidence(trades), [trades]);

  const briefings = useMemo(
    () =>
      getAccountBriefings(
        {
          trades,
          challenges,
          fundedAccounts,
          personalAccounts,
          payouts,
          traderIdentity: identity,
          traderHabits: habits,
          traderEdge: edge,
          traderBlindSpots: blindSpots,
          traderDiscipline: discipline,
          traderEvolution: evolution,
          dataConfidence,
        },
        objective ?? undefined
      ),
    [trades, challenges, fundedAccounts, personalAccounts, payouts, identity, habits, edge, blindSpots, discipline, evolution, dataConfidence, objective]
  );

  const accountRows = useMemo(
    () =>
      briefings.map((briefing) => {
        const accountTrades = trades.filter((t) => t.accountId === briefing.account.id && t.accountType === briefing.account.type);
        const todayContract = getContract(briefing.account.type, briefing.account.id, today);
        const accountability = computeDailyAccountability(todayContract, accountTrades, briefing.mode, discipline);

        const recentContracts = contracts.filter(
          (c) => c.accountType === briefing.account.type && c.accountId === briefing.account.id && c.contractDate >= cutoff && c.contractDate <= today
        );
        const recentDeviations: DatedDeviation[] = recentContracts
          .flatMap((c) => computeDeviations(c, accountTrades, briefing.mode).map((d) => ({ ...d, date: c.contractDate })))
          .sort((a, b) => b.date.localeCompare(a.date));

        return { briefing, accountability, recentDeviations };
      }),
    [briefings, trades, getContract, contracts, today, cutoff, discipline]
  );

  const totals = useMemo(() => {
    const compliancePercents = accountRows.map((r) => r.accountability.ruleCompliancePercent);
    const avgCompliance = compliancePercents.length > 0 ? Math.round(compliancePercents.reduce((s, v) => s + v, 0) / compliancePercents.length) : 0;
    const violationsToday = accountRows.reduce((s, r) => s + r.accountability.deviations.length, 0);
    const warningsToday = accountRows.reduce((s, r) => s + r.accountability.deviations.filter((d) => d.severity === "medium" || d.severity === "low").length, 0);
    return { avgCompliance, violationsToday, warningsToday };
  }, [accountRows]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-6 h-6 border-2 border-[#298DFF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Trading Rules</h1>
        <p className="text-zinc-400 mt-1">Rule compliance, scored by EdgePilot&apos;s Accountability Engine — not self-reported.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          icon={CheckCircle}
          label="Avg. Rule Compliance"
          value={accountRows.length > 0 ? `${totals.avgCompliance}%` : "—"}
          detail={accountRows.length > 0 ? "Across all active accounts, today" : "No active accounts"}
        />
        <StatCard icon={AlertTriangle} label="Violations Today" value={String(totals.violationsToday)} detail="High/critical severity included" />
        <StatCard icon={Scale} label="Warnings Today" value={String(totals.warningsToday)} detail="Medium/low severity" />
      </div>

      {accountRows.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={CARD}>
          <p className="text-[#64748B] text-sm">No active accounts. Add a challenge, funded, or personal account to see rule compliance.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {accountRows.map(({ briefing, accountability, recentDeviations }) => (
            <div key={`${briefing.account.type}-${briefing.account.id}`} className="rounded-xl p-6" style={CARD}>
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div>
                  <p className="text-[#F8FAFC] font-semibold">{briefing.account.name}</p>
                  <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.xs }}>{briefing.modeLabel} mode</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color="#298DFF">{accountability.ruleCompliancePercent}% compliant today</Badge>
                  <Badge color={accountability.grade === "A" || accountability.grade === "B" ? "#10B981" : accountability.grade === "F" ? "#EF4444" : "#F59E0B"}>
                    Grade {accountability.grade}
                  </Badge>
                </div>
              </div>

              {recentDeviations.length === 0 ? (
                <p className="text-[#64748B] text-sm">No violations in the last {RECENT_WINDOW_DAYS} days.</p>
              ) : (
                <div className="space-y-2">
                  {recentDeviations.map((d, i) => {
                    const color = SEVERITY_COLOR[d.severity];
                    return (
                      <div
                        key={`${d.type}-${d.date}-${i}`}
                        className="rounded-lg px-3.5 py-3"
                        style={{ background: "rgba(148,163,184,0.04)", border: `1px solid ${color}30` }}
                      >
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-[#64748B] flex-shrink-0" style={{ fontSize: typography.fontSize.xs }}>{d.date}</span>
                            <span className="text-[#F8FAFC] text-sm font-medium truncate">{d.label}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {d.estimatedCost > 0 && (
                              <span className="text-xs font-bold" style={{ color }}>-{fmt$(d.estimatedCost)}</span>
                            )}
                            <Badge color={color}>{d.severity}</Badge>
                          </div>
                        </div>
                        <p className="text-[#94A3B8] mt-1.5" style={{ fontSize: typography.fontSize.xs }}>{d.evidence}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
