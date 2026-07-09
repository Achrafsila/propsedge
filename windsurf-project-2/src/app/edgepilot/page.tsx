"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import {
  Compass,
  ShieldCheck,
  Gavel,
  Brain,
  CheckCircle2,
  Circle,
  Sparkles,
} from "lucide-react";
import { useAccounts } from "@/context/AccountsContext";
import { glassmorphism, borderRadius, typography, gradientText } from "@/design-system";
import { Challenge, FundedAccount, Trade } from "@/types";
import { getTraderIdentity } from "@/lib/analytics/traderIdentity";
import { getTraderHabits } from "@/lib/analytics/traderHabits";
import { getTraderEdge } from "@/lib/analytics/traderEdge";
import { getTraderBlindSpots } from "@/lib/analytics/traderBlindSpots";
import { getTraderDiscipline } from "@/lib/analytics/traderDiscipline";
import { getTraderEvolution } from "@/lib/analytics/traderEvolution";
import { getDataConfidence } from "@/lib/analytics/dataConfidence";
import {
  getAICoachRecommendation,
  getAccountRiskStates,
  AccountRef,
  CoachItem,
  CoachSeverity,
  CoachRiskLevel,
} from "@/lib/analytics/aiCoach";
import { AnimatedBar } from "@/components/analytics/visualizations/AnimatedBar";
import { CountUpNumber } from "@/components/analytics/visualizations/CountUpNumber";

// ─── Shared card style (same tokens as every other page in this app) ──────
const CARD: CSSProperties = {
  background: glassmorphism.card.background,
  backdropFilter: glassmorphism.card.backdropBlur,
  border: "1px solid rgba(148,163,184,0.08)",
  borderRadius: borderRadius.xl,
};

const fmt$ = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

// Same severity palette AICoachPanel used — reused here so bar/badge colors
// trace back to the same already-computed CoachItem.severity, never a new
// threshold decided in this file.
const SEVERITY_COLOR: Record<CoachSeverity, string> = {
  positive: "#10B981",
  neutral: "#298DFF",
  warning: "#F59E0B",
  critical: "#EF4444",
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

function findAlertSeverity(items: CoachItem[], titlePrefix: string, accountName: string): CoachSeverity | null {
  const item = items.find((i) => i.title === `${titlePrefix} — ${accountName}`);
  return item ? item.severity : null;
}

// The rule set (profitTarget/minTradingDays/consistencyRule/payout fields)
// always lives on a Challenge row — for a funded account that means its
// originating challenge via sourceChallengeId, same lookup
// aiCoach.ts's buildPayoutReadinessItems already relies on.
function findRuleSource(account: AccountRef, challenges: Challenge[], fundedAccounts: FundedAccount[]): Challenge | undefined {
  if (account.type === "challenge") return challenges.find((c) => c.id === account.id);
  const funded = fundedAccounts.find((a) => a.id === account.id);
  return funded?.sourceChallengeId ? challenges.find((c) => c.id === funded.sourceChallengeId) : undefined;
}

function countTradingDays(trades: Trade[], account: AccountRef): number {
  const days = new Set(
    trades.filter((t) => t.accountId === account.id && t.accountType === account.type).map((t) => t.entryDate)
  );
  return days.size;
}

function formatPayoutRules(rule: Challenge | undefined): string {
  if (!rule) return "Not set";
  const parts: string[] = [];
  if (rule.payoutDays != null) parts.push(`Every ${rule.payoutDays}d`);
  if (rule.minPayout != null) parts.push(`Min ${fmt$(rule.minPayout)}`);
  if (rule.payoutSplit != null) parts.push(`${rule.payoutSplit}% split`);
  return parts.length > 0 ? parts.join(" · ") : "Not set";
}

// ─── Small building blocks ──────────────────────────────────────────────

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="w-4 h-4 text-[#298DFF]" />
      <h3 className="text-[#F8FAFC] font-semibold" style={{ fontSize: typography.fontSize.section }}>
        {title}
      </h3>
    </div>
  );
}

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

function StatTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: "rgba(148,163,184,0.04)", border: "1px solid rgba(148,163,184,0.08)" }}>
      <p className="text-[#64748B] uppercase mb-1" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
        {label}
      </p>
      <p className="font-bold text-sm" style={{ color: color ?? "#F8FAFC" }}>
        {value}
      </p>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────

export default function EdgePilotPage() {
  const {
    challenges,
    fundedAccounts,
    trades,
    payouts,
    getDashboardKPIs,
    challengesLoading,
    fundedAccountsLoading,
    tradesLoading,
  } = useAccounts();

  const isLoading = challengesLoading || fundedAccountsLoading || tradesLoading;

  const identity = useMemo(() => getTraderIdentity(trades), [trades]);
  const habits = useMemo(() => getTraderHabits(trades), [trades]);
  const edge = useMemo(() => getTraderEdge(trades), [trades]);
  const blindSpots = useMemo(() => getTraderBlindSpots(trades), [trades]);
  const discipline = useMemo(() => getTraderDiscipline(trades), [trades]);
  const evolution = useMemo(() => getTraderEvolution(trades), [trades]);
  const dataConfidence = useMemo(() => getDataConfidence(trades), [trades]);
  const dashboardKPIs = getDashboardKPIs();

  const coach = useMemo(
    () =>
      getAICoachRecommendation({
        trades,
        challenges,
        fundedAccounts,
        payouts,
        dashboardKPIs,
        traderIdentity: identity,
        traderHabits: habits,
        traderEdge: edge,
        traderBlindSpots: blindSpots,
        traderDiscipline: discipline,
        traderEvolution: evolution,
        dataConfidence,
      }),
    [trades, challenges, fundedAccounts, payouts, dashboardKPIs, identity, habits, edge, blindSpots, discipline, evolution, dataConfidence]
  );

  const riskStates = useMemo(
    () => getAccountRiskStates(challenges, fundedAccounts, trades),
    [challenges, fundedAccounts, trades]
  );

  // ── Today's Checklist: two rows read straight off already-computed
  // severities; three are local self-check toggles (no live trade-count/
  // stop-loss tracking exists yet, so these are honesty checks, not derived
  // facts).
  const consistencySafe = !coach.propRuleAlerts.some(
    (i) => i.title.includes("Consistency") && (i.severity === "warning" || i.severity === "critical")
  );
  const payoutSafe = !coach.payoutReadiness.some((i) => i.severity === "warning" || i.severity === "critical");

  const [selfChecks, setSelfChecks] = useState({
    riskWithinPlan: false,
    maxTradesRespected: false,
    stopConditionRespected: false,
  });
  const toggleSelfCheck = (key: keyof typeof selfChecks) =>
    setSelfChecks((prev) => ({ ...prev, [key]: !prev[key] }));

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-6 h-6 border-2 border-[#298DFF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const riskColor = RISK_LEVEL_COLOR[coach.riskLevel];

  return (
    <div className="space-y-8">
      {/* ── HERO ── */}
      <div className="relative -mx-6 -mt-6 px-6 pt-12 pb-8 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(120% 120% at 50% 0%, rgba(41,141,255,0.35) 0%, rgba(41,141,255,0.10) 32%, rgba(41,141,255,0) 65%)" }}
        />
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${riskColor}1A` }}>
            <Compass className="w-7 h-7" style={{ color: riskColor }} />
          </div>
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              style={{
                fontSize: "3rem",
                fontWeight: 800,
                letterSpacing: "-0.05em",
                lineHeight: 1,
                background: gradientText.premium,
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              EdgePilot
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="text-[#94A3B8] mt-2"
              style={{ fontSize: typography.fontSize.base }}
            >
              Your Trading Copilot
            </motion.p>
          </div>
        </div>
      </div>

      {/* ── 1. Today's Mission ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.4 }}
        className="rounded-xl p-6" style={CARD}>
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <SectionHeader icon={Sparkles} title="Today's Mission" />
          <Badge color={riskColor}>{RISK_LEVEL_LABEL[coach.riskLevel]}</Badge>
        </div>
        <p className="text-[#F8FAFC] font-semibold mb-5" style={{ fontSize: typography.fontSize.lg }}>
          {coach.mainPriority}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg p-4" style={{ background: `${riskColor}0D`, border: `1px solid ${riskColor}30` }}>
            <p className="text-[#94A3B8] uppercase mb-1" style={{ fontSize: typography.fontSize.xs }}>
              Recommended Risk / Trade
            </p>
            <p className="font-extrabold tabular-nums" style={{ fontSize: typography.fontSize.xl, color: "#F8FAFC" }}>
              {coach.recommendedRisk.amount !== null ? (
                <CountUpNumber value={coach.recommendedRisk.amount} format={(v) => `$${Math.round(v).toLocaleString("en-US")}`} />
              ) : (
                "—"
              )}
            </p>
            <p className="text-[#64748B] mt-1" style={{ fontSize: typography.fontSize.xs }}>
              {coach.recommendedRisk.rationale}
            </p>
          </div>
          <div className="rounded-lg p-4" style={{ background: "rgba(148,163,184,0.04)", border: "1px solid rgba(148,163,184,0.08)" }}>
            <p className="text-[#94A3B8] uppercase mb-1" style={{ fontSize: typography.fontSize.xs }}>
              Next Best Action
            </p>
            <p className="text-[#CBD5E1]" style={{ fontSize: typography.fontSize.sm }}>
              {coach.nextBestAction}
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── 2. Account Command Center ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.4, delay: 0.05 }}>
        <SectionHeader icon={ShieldCheck} title="Account Command Center" />
        {riskStates.length === 0 ? (
          <div className="rounded-xl p-6 text-center" style={CARD}>
            <p className="text-[#64748B] text-sm">No active accounts to monitor.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {riskStates.map((state) => {
              const source =
                state.account.type === "challenge"
                  ? challenges.find((c) => c.id === state.account.id)
                  : fundedAccounts.find((a) => a.id === state.account.id);
              const equity = state.account.accountSize + state.account.currentProfit;
              const targetLeft =
                state.account.type === "challenge" && source && "profitTarget" in source && source.profitTarget
                  ? fmt$(Math.max(0, source.profitTarget - state.account.currentProfit))
                  : "—";
              return (
                <div key={`${state.account.type}-${state.account.id}`} className="rounded-xl p-5" style={CARD}>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="min-w-0">
                      <p className="text-[#F8FAFC] font-semibold text-sm truncate">{state.account.name}</p>
                      <p className="text-[#64748B] text-xs">{state.account.type === "challenge" ? "Challenge" : "Funded Account"}</p>
                    </div>
                    <Badge color={source?.status === "active" ? "#10B981" : "#94A3B8"}>{source?.status ?? "—"}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <StatTile label="Current Equity" value={fmt$(equity)} />
                    <StatTile label="Daily Loss Buffer" value={state.dailyBuffer !== null ? fmt$(state.dailyBuffer) : "—"} />
                    <StatTile label="Max Loss Buffer" value={fmt$(state.maxBuffer)} />
                    <StatTile label="Target Left" value={targetLeft} />
                    <StatTile
                      label="Recommended Risk"
                      value={coach.recommendedRisk.amount !== null ? `${fmt$(coach.recommendedRisk.amount)} (acct-wide)` : "—"}
                    />
                    <StatTile label="Status" value={source?.status ?? "—"} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* ── 3. Rule Monitor ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.4, delay: 0.1 }}>
        <SectionHeader icon={Gavel} title="Rule Monitor" />
        {riskStates.length === 0 ? (
          <div className="rounded-xl p-6 text-center" style={CARD}>
            <p className="text-[#64748B] text-sm">No active accounts to monitor.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {riskStates.map((state) => {
              const ruleSource = findRuleSource(state.account, challenges, fundedAccounts);
              const isFunded = state.account.type === "funded";

              const dailySeverity = findAlertSeverity(coach.accountAlerts, "Daily Loss Guardrail", state.account.name);
              const maxSeverity = findAlertSeverity(coach.accountAlerts, "Max Loss Guardrail", state.account.name);
              const targetSeverity = findAlertSeverity(coach.propRuleAlerts, "Profit Target Plan", state.account.name);

              const dailyUsedPct =
                state.dailyLimit !== null && state.dailyBuffer !== null && state.dailyLimit > 0
                  ? ((state.dailyLimit - state.dailyBuffer) / state.dailyLimit) * 100
                  : null;
              const maxUsedPct = state.maxLimit > 0 ? ((state.maxLimit - state.maxBuffer) / state.maxLimit) * 100 : 0;
              const targetPct =
                !isFunded && ruleSource?.profitTarget
                  ? Math.min(100, (state.account.currentProfit / ruleSource.profitTarget) * 100)
                  : null;

              const tradingDays = countTradingDays(trades, state.account);
              const minDays = ruleSource?.minTradingDays ?? null;

              return (
                <div key={`${state.account.type}-${state.account.id}`} className="rounded-xl p-5 space-y-4" style={CARD}>
                  <p className="text-[#F8FAFC] font-semibold text-sm truncate">{state.account.name}</p>

                  {dailyUsedPct !== null ? (
                    <AnimatedBar
                      label="Daily Loss"
                      percentage={dailyUsedPct}
                      color={dailySeverity ? SEVERITY_COLOR[dailySeverity] : "#298DFF"}
                      valueLabel={`${Math.round(dailyUsedPct)}% used`}
                    />
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.sm }}>Daily Loss</span>
                      <span className="text-[#64748B]" style={{ fontSize: typography.fontSize.xs }}>N/A — no daily limit</span>
                    </div>
                  )}

                  <AnimatedBar
                    label="Max Loss"
                    percentage={maxUsedPct}
                    color={maxSeverity ? SEVERITY_COLOR[maxSeverity] : "#298DFF"}
                    valueLabel={`${Math.round(maxUsedPct)}% used`}
                  />

                  {targetPct !== null ? (
                    <AnimatedBar
                      label="Profit Target"
                      percentage={targetPct}
                      color={targetSeverity ? SEVERITY_COLOR[targetSeverity] : "#298DFF"}
                      valueLabel={`${Math.round(targetPct)}%`}
                    />
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.sm }}>Profit Target</span>
                      <span className="text-[#64748B]" style={{ fontSize: typography.fontSize.xs }}>{isFunded ? "N/A — funded stage" : "Not set"}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge color="#298DFF">Consistency: {ruleSource?.consistencyRule ?? "Not set"}</Badge>
                    <Badge color="#298DFF">
                      Min. Trading Days: {tradingDays}
                      {minDays != null ? ` / ${minDays}` : ""}
                    </Badge>
                    <Badge color="#298DFF">
                      Payout Rules: {isFunded ? formatPayoutRules(ruleSource) : "N/A — not yet funded"}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* ── 4. Today's Checklist ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.4, delay: 0.15 }}
        className="rounded-xl p-6" style={CARD}>
        <SectionHeader icon={CheckCircle2} title="Today's Checklist" />
        <div className="space-y-2.5">
          {[
            { label: "Consistency safe", checked: consistencySafe, selfCheck: false },
            { label: "Payout conditions safe", checked: payoutSafe, selfCheck: false },
            { label: "Risk ≤ recommended risk", checked: selfChecks.riskWithinPlan, selfCheck: true, key: "riskWithinPlan" as const },
            { label: "Max trades respected", checked: selfChecks.maxTradesRespected, selfCheck: true, key: "maxTradesRespected" as const },
            { label: "Stop condition respected", checked: selfChecks.stopConditionRespected, selfCheck: true, key: "stopConditionRespected" as const },
          ].map((row) => (
            <button
              key={row.label}
              type="button"
              disabled={!row.selfCheck}
              onClick={() => row.selfCheck && row.key && toggleSelfCheck(row.key)}
              className="w-full flex items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 text-left"
              style={{
                background: "rgba(148,163,184,0.04)",
                border: "1px solid rgba(148,163,184,0.08)",
                cursor: row.selfCheck ? "pointer" : "default",
              }}
            >
              <span className="flex items-center gap-2.5">
                {row.checked ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "#10B981" }} />
                ) : (
                  <Circle className="w-4 h-4 flex-shrink-0 text-[#475569]" />
                )}
                <span className="text-[#F8FAFC] text-sm">{row.label}</span>
              </span>
              {row.selfCheck && (
                <span className="text-[#64748B] uppercase" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
                  Self-check
                </span>
              )}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── 5. Behaviour Focus ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.4, delay: 0.2 }}
        className="rounded-xl p-6" style={CARD}>
        <SectionHeader icon={Brain} title="Behaviour Focus" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-[#94A3B8] uppercase mb-1" style={{ fontSize: typography.fontSize.xs }}>Loss Discipline</p>
            <p className="text-[#F8FAFC] font-semibold text-sm">{discipline.lossDisciplineScore.value}{discipline.lossDisciplineScore.metricLabel ? ` (${discipline.lossDisciplineScore.metricLabel})` : ""}</p>
          </div>
          <div>
            <p className="text-[#94A3B8] uppercase mb-1" style={{ fontSize: typography.fontSize.xs }}>Revenge Trading Risk</p>
            <p className="text-[#F8FAFC] font-semibold text-sm">{discipline.revengeTradingRisk.value}</p>
          </div>
          <div>
            <p className="text-[#94A3B8] uppercase mb-1" style={{ fontSize: typography.fontSize.xs }}>Risk Inconsistency</p>
            <p className="text-[#F8FAFC] font-semibold text-sm">{discipline.riskConsistency.value}</p>
          </div>
          <div>
            <p className="text-[#94A3B8] uppercase mb-1" style={{ fontSize: typography.fontSize.xs }}>Best Setup Focus</p>
            <p className="text-[#F8FAFC] font-semibold text-sm">
              {edge.bestSetup.value}
              {edge.bestSetup.detail ? ` — ${edge.bestSetup.detail}` : ""}
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── 6. Ask EdgePilot ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.4, delay: 0.25 }}
        className="rounded-xl p-6 flex items-center justify-between gap-4 flex-wrap" style={CARD}>
        <div>
          <h3 className="text-[#F8FAFC] font-semibold mb-1" style={{ fontSize: typography.fontSize.section }}>Ask EdgePilot</h3>
          <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.xs }}>Coming soon: conversational trading copilot.</p>
        </div>
        <button
          type="button"
          disabled
          className="px-4 py-2.5 rounded-xl text-sm font-semibold cursor-not-allowed"
          style={{ background: "rgba(148,163,184,0.08)", color: "#64748B", border: "1px solid rgba(148,163,184,0.15)" }}
        >
          Ask EdgePilot
        </button>
      </motion.div>
    </div>
  );
}
