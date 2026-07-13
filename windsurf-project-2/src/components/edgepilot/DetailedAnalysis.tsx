"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Gavel, Brain, CheckCircle2, Circle, ChevronDown, FileCheck, AlertTriangle, Activity } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { Challenge, FundedAccount, PersonalAccount, Trade } from "@/types";
import {
  AccountRef,
  AccountRiskState,
  AICoachOutput,
  CoachItem,
  CoachSeverity,
} from "@/lib/analytics/aiCoach";
import { TraderDiscipline } from "@/lib/analytics/traderDiscipline";
import { TraderEdge } from "@/lib/analytics/traderEdge";
import { Deviation, DeviationSeverity } from "@/lib/analytics/accountabilityEngine";
import { Decision } from "@/lib/analytics/decisionEngine";
import { AnimatedBar } from "@/components/analytics/visualizations/AnimatedBar";
import { PrimaryEvaluation } from "./CockpitHero";
import { EdgePilotAvatar } from "./EdgePilotAvatar";
import { fetchMarketIntelligence, buildInitialIntelligence } from "@/lib/market/client";
import { MarketIntelligence, InstrumentMarketData, INSTRUMENT_KEYS } from "@/lib/market/types";
import type { MarketPulseEvidence } from "@/lib/market/marketPulse";

// ============================================================
// PropEdge — Detailed Analysis (EdgePilot V3)
// ============================================================
// A straight move of V2's sections 2-9 (Today's Contract, Account Command
// Center, Account Decisions, Rule Monitor, Violations, Plan Compliance,
// Behaviour Focus, Ask EdgePilot) — same JSX, same styling, same local
// helpers, zero logic changes. Only new thing here is the collapse
// wrapper: closed by default, so the cockpit (CockpitHero +
// ExecutiveCardsRow) is what a returning trader sees first.

const CARD = {
  background: glassmorphism.card.background,
  backdropFilter: glassmorphism.card.backdropBlur,
  border: "1px solid rgba(148,163,184,0.08)",
  borderRadius: borderRadius.xl,
};

const fmt$ = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

const SEVERITY_COLOR: Record<CoachSeverity, string> = {
  positive: "#10B981",
  neutral: "#298DFF",
  warning: "#F59E0B",
  critical: "#EF4444",
};

const DECISION_COLOR: Record<Decision, string> = {
  TRADE: "#10B981",
  TRADE_REDUCED: "#F59E0B",
  OBSERVE_ONLY: "#298DFF",
  STOP: "#EF4444",
};

const DEVIATION_SEVERITY_COLOR: Record<DeviationSeverity, string> = {
  critical: "#EF4444",
  high: "#F59E0B",
  medium: "#298DFF",
  low: "#94A3B8",
};

const GRADE_COLOR: Record<string, string> = { A: "#10B981", B: "#10B981", C: "#F59E0B", D: "#F59E0B", F: "#EF4444" };

// ── Market Intelligence display-only maps (presentation, not analytical rules) ──
const REGIME_COLOR: Record<string, string> = {
  bullish_trend: "#10B981",
  bearish_trend: "#EF4444",
  range: "#298DFF",
  transition: "#F59E0B",
  unknown: "#64748B",
};
const PHASE_COLOR: Record<string, string> = {
  expansion: "#10B981",
  pullback: "#F59E0B",
  compression: "#298DFF",
  rotation: "#298DFF",
  unknown: "#64748B",
};
const BIAS_COLOR: Record<string, string> = { bullish: "#10B981", bearish: "#EF4444", neutral: "#298DFF", unknown: "#64748B" };
const CONVICTION_COLOR: Record<string, string> = { high: "#10B981", medium: "#F59E0B", low: "#EF4444", unknown: "#64748B" };
const VOLATILITY_COLOR: Record<string, string> = { low: "#10B981", normal: "#298DFF", high: "#F59E0B", extreme: "#EF4444", unknown: "#64748B" };
const ENVIRONMENT_COLOR: Record<string, string> = { favorable: "#10B981", selective: "#F59E0B", poor: "#EF4444", unknown: "#64748B" };

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function formatLevelPrice(price: number): string {
  return price.toLocaleString(undefined, { maximumFractionDigits: 5 });
}
function formatSignedPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function EvidenceDisclosure({ evidence }: { evidence: MarketPulseEvidence[] }) {
  const [expanded, setExpanded] = useState(false);
  if (evidence.length === 0) return null;
  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 font-medium"
        style={{ color: "#298DFF", fontSize: typography.fontSize.xs }}
      >
        <ChevronDown className="w-3.5 h-3.5 transition-transform" style={{ transform: expanded ? "rotate(180deg)" : "none" }} />
        {expanded ? "Hide Evidence" : "Show Evidence"}
      </button>
      {expanded && (
        <ul className="mt-2 space-y-1.5">
          {evidence.map((e, i) => (
            <li key={i} className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.xs }}>
              <span className="text-[#64748B] uppercase mr-1.5" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
                {e.source}
              </span>
              {e.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Card status is derived from the instrument's own price/history
// availability AND the (separately honest) MarketPulse rollup — never
// invented: an instrument with no price data at all (NDX/US30, or a
// failed fetch) is "unavailable" regardless of what Pulse says; otherwise
// Pulse's own status (available/partial/unavailable) is trusted as-is.
function resolveCardStatus(instrument: InstrumentMarketData): "available" | "partial" | "unavailable" {
  if (instrument.status === "unavailable" || !instrument.marketPulse) return "unavailable";
  return instrument.marketPulse.status;
}

const CARD_STATUS_COLOR = { available: "#10B981", partial: "#F59E0B", unavailable: "#64748B" };
const CARD_STATUS_LABEL = { available: "Available", partial: "Partial Market Intelligence", unavailable: "Unavailable" };

function MarketIntelligenceCard({ instrument }: { instrument: InstrumentMarketData }) {
  const pulse = instrument.marketPulse;
  const status = resolveCardStatus(instrument);

  return (
    <div className="rounded-xl p-5 space-y-4" style={CARD}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[#F8FAFC] font-semibold text-sm">{instrument.symbol}</p>
        <Badge color={CARD_STATUS_COLOR[status]}>{CARD_STATUS_LABEL[status]}</Badge>
      </div>

      {status === "unavailable" && (
        <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.sm }}>
          Unavailable with current provider plan
        </p>
      )}

      {status === "partial" && pulse && (
        <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.xs }}>
          Daily history: {pulse.dataQuality.dailyHistory} · Weekly history: {pulse.dataQuality.weeklyHistory} · Market Context:{" "}
          {pulse.dataQuality.marketContext}
        </p>
      )}

      {pulse && status !== "unavailable" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="Market Regime" value={titleCase(pulse.regime.regime)} color={REGIME_COLOR[pulse.regime.regime]} />
            <StatTile label="Market Phase" value={titleCase(pulse.phase.phase)} color={PHASE_COLOR[pulse.phase.phase]} />
            <StatTile label="Structural Bias" value={titleCase(pulse.bias)} color={BIAS_COLOR[pulse.bias]} />
            <StatTile label="Conviction" value={titleCase(pulse.conviction.conviction)} color={CONVICTION_COLOR[pulse.conviction.conviction]} />
            <StatTile label="Volatility" value={titleCase(pulse.volatility.volatility)} color={VOLATILITY_COLOR[pulse.volatility.volatility]} />
            <StatTile label="Environment" value={titleCase(pulse.environment.environment)} color={ENVIRONMENT_COLOR[pulse.environment.environment]} />
          </div>

          <div>
            <p className="text-[#64748B] uppercase mb-1" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
              Nearest Key Level
            </p>
            <p className="text-[#F8FAFC] text-sm font-medium">
              {pulse.nearestLevel
                ? `${pulse.nearestLevel.label} @ ${formatLevelPrice(pulse.nearestLevel.price)} (${formatSignedPercent(pulse.nearestLevel.distancePercent)})`
                : "Not available"}
            </p>
          </div>

          <p className="text-[#CBD5E1]" style={{ fontSize: typography.fontSize.sm }}>
            {pulse.summary}
          </p>

          <EvidenceDisclosure evidence={pulse.evidence} />
        </>
      )}
    </div>
  );
}

function findAlertSeverity(items: CoachItem[], titlePrefix: string, accountName: string): CoachSeverity | null {
  const item = items.find((i) => i.title === `${titlePrefix} — ${accountName}`);
  return item ? item.severity : null;
}

function findRuleSource(account: AccountRef, challenges: Challenge[], fundedAccounts: FundedAccount[]): Challenge | undefined {
  if (account.type === "challenge") return challenges.find((c) => c.id === account.id);
  const funded = fundedAccounts.find((a) => a.id === account.id);
  return funded?.sourceChallengeId ? challenges.find((c) => c.id === funded.sourceChallengeId) : undefined;
}

function countTradingDays(trades: Trade[], account: AccountRef): number {
  const days = new Set(trades.filter((t) => t.accountId === account.id && t.accountType === account.type).map((t) => t.entryDate));
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

function ViolationCard({ deviation }: { deviation: Deviation }) {
  const [expanded, setExpanded] = useState(false);
  const color = DEVIATION_SEVERITY_COLOR[deviation.severity];
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "rgba(148,163,184,0.04)", border: `1px solid ${color}30` }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color }} />
          <span className="text-[#F8FAFC] text-sm font-medium truncate">{deviation.label}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {deviation.estimatedCost > 0 && (
            <span className="text-xs font-bold" style={{ color }}>
              -{fmt$(deviation.estimatedCost)}
            </span>
          )}
          <Badge color={color}>{deviation.severity}</Badge>
          <ChevronDown className="w-4 h-4 text-[#64748B] transition-transform" style={{ transform: expanded ? "rotate(180deg)" : "none" }} />
        </div>
      </button>
      {expanded && (
        <div className="px-3.5 pb-3.5 space-y-2" style={{ fontSize: typography.fontSize.xs }}>
          <p className="text-[#94A3B8]">
            <span className="text-[#64748B] uppercase mr-1.5" style={{ letterSpacing: typography.letterSpacing.label }}>
              Evidence
            </span>
            {deviation.evidence}
          </p>
          <p className="text-[#94A3B8]">
            <span className="text-[#64748B] uppercase mr-1.5" style={{ letterSpacing: typography.letterSpacing.label }}>
              Why it matters
            </span>
            {deviation.behaviouralExplanation}
          </p>
          <p className="text-[#CBD5E1]">
            <span className="text-[#64748B] uppercase mr-1.5" style={{ letterSpacing: typography.letterSpacing.label }}>
              Recommendation
            </span>
            {deviation.recommendation}
          </p>
          <p className="text-[#475569]">Confidence: {deviation.confidence}</p>
        </div>
      )}
    </div>
  );
}

export function DetailedAnalysis({
  accountEvaluations,
  riskStates,
  coach,
  challenges,
  fundedAccounts,
  personalAccounts,
  trades,
  discipline,
  edge,
  allDeviationsToday,
}: {
  accountEvaluations: PrimaryEvaluation[];
  riskStates: AccountRiskState[];
  coach: AICoachOutput;
  challenges: Challenge[];
  fundedAccounts: FundedAccount[];
  personalAccounts: PersonalAccount[];
  trades: Trade[];
  discipline: TraderDiscipline;
  edge: TraderEdge;
  allDeviationsToday: Deviation[];
}) {
  const [open, setOpen] = useState(false);
  const [selfChecks, setSelfChecks] = useState({ riskWithinPlan: false, maxTradesRespected: false });
  const toggleSelfCheck = (key: keyof typeof selfChecks) => setSelfChecks((prev) => ({ ...prev, [key]: !prev[key] }));

  // Market Intelligence — fetched from the existing /api/market-intelligence
  // route (same client used previously by Morning Briefing); never calls
  // TwelveData/Finnhub directly and never duplicates the backend's history
  // fetching. Loading/failure never blocks the rest of the page: this
  // section only mounts once the trader opens "View Detailed Analysis",
  // and fetchMarketIntelligence() always resolves to a well-formed object
  // (a clean "unavailable" shape on any failure), so there is no separate
  // error state to handle here.
  const [marketIntel, setMarketIntel] = useState<MarketIntelligence>(buildInitialIntelligence);
  const [marketIntelLoading, setMarketIntelLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    fetchMarketIntelligence().then((mi) => {
      if (!cancelled) {
        setMarketIntel(mi);
        setMarketIntelLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 rounded-xl px-5 py-4"
        style={CARD}
      >
        <span className="text-[#F8FAFC] font-semibold" style={{ fontSize: typography.fontSize.base }}>
          View Detailed Analysis
        </span>
        <ChevronDown className="w-5 h-5 text-[#94A3B8] transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-8 pt-6">
              {/* ── Today's Contract ── */}
              <div>
                <SectionHeader icon={FileCheck} title="Today's Contract" />
                {accountEvaluations.length === 0 ? (
                  <div className="rounded-xl p-6 text-center" style={CARD}>
                    <p className="text-[#64748B] text-sm">No active accounts to monitor.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {accountEvaluations.map(({ briefing, contract }) => (
                      <div key={`contract-${briefing.account.type}-${briefing.account.id}`} className="rounded-xl p-5" style={CARD}>
                        <p className="text-[#F8FAFC] font-semibold text-sm truncate mb-3">{briefing.account.name}</p>
                        {contract ? (
                          <div className="grid grid-cols-2 gap-2">
                            <StatTile label="Max Risk / Trade" value={contract.maxRiskPerTrade !== null ? fmt$(contract.maxRiskPerTrade) : "—"} />
                            <StatTile label="Max Trades" value={contract.maxTrades !== null ? String(contract.maxTrades) : "—"} />
                            <StatTile
                              label="Allowed Session"
                              value={contract.allowedSessions.length > 0 ? contract.allowedSessions.join(", ") : "Any"}
                            />
                            <StatTile
                              label="Allowed Instruments"
                              value={contract.allowedInstruments.length > 0 ? contract.allowedInstruments.join(", ") : "Any"}
                            />
                            <StatTile
                              label="Stop After"
                              value={contract.stopAfterLosses !== null ? `${contract.stopAfterLosses} loss${contract.stopAfterLosses === 1 ? "" : "es"}` : "—"}
                            />
                          </div>
                        ) : (
                          <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.sm }}>
                            Not committed today — complete the Morning Briefing to set today&apos;s plan.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Account Command Center ── */}
              <div>
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
                          : state.account.type === "funded"
                            ? fundedAccounts.find((a) => a.id === state.account.id)
                            : personalAccounts.find((p) => p.id === state.account.id);
                      const equity = state.account.accountSize + state.account.currentProfit;
                      const targetLeft =
                        state.account.type === "challenge" && source && "profitTarget" in source && source.profitTarget
                          ? fmt$(Math.max(0, source.profitTarget - state.account.currentProfit))
                          : "—";
                      const accountTypeLabel =
                        state.account.type === "challenge" ? "Challenge" : state.account.type === "funded" ? "Funded Account" : "Personal Account";
                      return (
                        <div key={`${state.account.type}-${state.account.id}`} className="rounded-xl p-5" style={CARD}>
                          <div className="flex items-center justify-between gap-2 mb-4">
                            <div className="min-w-0">
                              <p className="text-[#F8FAFC] font-semibold text-sm truncate">{state.account.name}</p>
                              <p className="text-[#64748B] text-xs">{accountTypeLabel}</p>
                            </div>
                            <Badge color={source?.status === "active" ? "#10B981" : "#94A3B8"}>{source?.status ?? "—"}</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <StatTile label="Current Equity" value={fmt$(equity)} />
                            <StatTile label="Daily Loss Buffer" value={state.dailyBuffer !== null ? fmt$(state.dailyBuffer) : "—"} />
                            <StatTile label="Max Loss Buffer" value={state.maxBuffer !== null ? fmt$(state.maxBuffer) : "N/A"} />
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
              </div>

              {/* ── Account Decisions ── */}
              <div>
                <SectionHeader icon={Gavel} title="Account Decisions" />
                {accountEvaluations.length === 0 ? (
                  <div className="rounded-xl p-6 text-center" style={CARD}>
                    <p className="text-[#64748B] text-sm">No active accounts to monitor.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {accountEvaluations.map(({ briefing, decision }) => {
                      const color = DECISION_COLOR[decision.decision];
                      return (
                        <div key={`decision-${briefing.account.type}-${briefing.account.id}`} className="rounded-xl p-5 space-y-3" style={CARD}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[#F8FAFC] font-semibold text-sm truncate">{briefing.account.name}</p>
                            <Badge color={color}>{decision.decision.replace("_", " ")}</Badge>
                          </div>
                          <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.xs }}>
                            Mode: {decision.modeLabel}
                          </p>
                          {decision.hardRules.length > 0 && (
                            <div>
                              <p className="text-[#64748B] uppercase mb-1" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
                                Hard Rules
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {decision.hardRules.map((rule) => (
                                  <Badge key={rule} color="#298DFF">{rule}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {decision.blockers.length > 0 && (
                            <div>
                              <p className="text-[#64748B] uppercase mb-1" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
                                Blockers
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {decision.blockers.map((blocker) => (
                                  <Badge key={blocker} color="#EF4444">{blocker}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {decision.unlockConditions.length > 0 && (
                            <div>
                              <p className="text-[#64748B] uppercase mb-1" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
                                Unlock Conditions
                              </p>
                              <p className="text-[#CBD5E1]" style={{ fontSize: typography.fontSize.sm }}>
                                {decision.unlockConditions.join(", ")}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Rule Monitor ── */}
              <div>
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
                      const maxUsedPct =
                        state.maxLimit !== null && state.maxBuffer !== null && state.maxLimit > 0
                          ? ((state.maxLimit - state.maxBuffer) / state.maxLimit) * 100
                          : null;
                      const isPersonal = state.account.type === "personal";
                      const targetPct =
                        state.account.type === "challenge" && ruleSource?.profitTarget
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

                          {maxUsedPct !== null ? (
                            <AnimatedBar
                              label="Max Loss"
                              percentage={maxUsedPct}
                              color={maxSeverity ? SEVERITY_COLOR[maxSeverity] : "#298DFF"}
                              valueLabel={`${Math.round(maxUsedPct)}% used`}
                            />
                          ) : (
                            <div className="flex items-center justify-between">
                              <span className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.sm }}>Max Loss</span>
                              <span className="text-[#64748B]" style={{ fontSize: typography.fontSize.xs }}>N/A — no max drawdown limit</span>
                            </div>
                          )}

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
                              <span className="text-[#64748B]" style={{ fontSize: typography.fontSize.xs }}>
                                {isFunded ? "N/A — funded stage" : isPersonal ? "N/A — no challenge target" : "Not set"}
                              </span>
                            </div>
                          )}

                          {isPersonal ? (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {state.account.riskPerTradePercent != null && (
                                <Badge color="#298DFF">Risk Per Trade: {state.account.riskPerTradePercent}%</Badge>
                              )}
                              {state.account.dailyDrawdown == null &&
                                state.account.maxDrawdown == null &&
                                state.account.riskPerTradePercent == null && (
                                  <Badge color="#94A3B8">No optional rules configured</Badge>
                                )}
                            </div>
                          ) : (
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
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Violations ── */}
              <div className="rounded-xl p-6" style={CARD}>
                <SectionHeader icon={AlertTriangle} title="Violations" />
                {allDeviationsToday.length === 0 ? (
                  <p className="text-[#64748B] text-sm">No rule violations detected today.</p>
                ) : (
                  <div className="space-y-2">
                    {allDeviationsToday.map((d, i) => (
                      <ViolationCard key={`${d.type}-${i}`} deviation={d} />
                    ))}
                  </div>
                )}
              </div>

              {/* ── Plan Compliance ── */}
              <div className="rounded-xl p-6" style={CARD}>
                <SectionHeader icon={CheckCircle2} title="Plan Compliance" />
                {accountEvaluations.length === 0 ? (
                  <p className="text-[#64748B] text-sm">No active accounts to score.</p>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
                    {accountEvaluations.map(({ briefing, accountability }) => (
                      <div
                        key={`compliance-${briefing.account.type}-${briefing.account.id}`}
                        className="rounded-lg p-4"
                        style={{ background: "rgba(148,163,184,0.04)", border: "1px solid rgba(148,163,184,0.08)" }}
                      >
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <p className="text-[#F8FAFC] font-semibold text-sm truncate">{briefing.account.name}</p>
                          <span
                            className="w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-sm flex-shrink-0"
                            style={{ background: `${GRADE_COLOR[accountability.grade]}1A`, color: GRADE_COLOR[accountability.grade] }}
                          >
                            {accountability.grade}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <StatTile label="Rule Compliance" value={`${accountability.ruleCompliancePercent}%`} />
                          <StatTile label="Behaviour Score" value={accountability.behaviourScore !== null ? `${accountability.behaviourScore}/100` : "—"} />
                          <StatTile label="Plan Compliance" value={`${accountability.planComplianceScore}/100`} />
                          <StatTile
                            label="Cost of Deviations"
                            value={accountability.estimatedCostOfDeviations > 0 ? `-${fmt$(accountability.estimatedCostOfDeviations)}` : "$0"}
                            color={accountability.estimatedCostOfDeviations > 0 ? "#EF4444" : undefined}
                          />
                        </div>
                        {accountability.biggestDeviation && (
                          <p className="text-[#64748B] mt-2" style={{ fontSize: typography.fontSize.xs }}>
                            Biggest deviation: {accountability.biggestDeviation.label}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-2.5">
                  {[
                    { label: "Risk ≤ recommended risk", checked: selfChecks.riskWithinPlan, key: "riskWithinPlan" as const },
                    { label: "Max trades respected", checked: selfChecks.maxTradesRespected, key: "maxTradesRespected" as const },
                  ].map((row) => (
                    <button
                      key={row.label}
                      type="button"
                      onClick={() => toggleSelfCheck(row.key)}
                      className="w-full flex items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 text-left"
                      style={{ background: "rgba(148,163,184,0.04)", border: "1px solid rgba(148,163,184,0.08)", cursor: "pointer" }}
                    >
                      <span className="flex items-center gap-2.5">
                        {row.checked ? (
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "#10B981" }} />
                        ) : (
                          <Circle className="w-4 h-4 flex-shrink-0 text-[#475569]" />
                        )}
                        <span className="text-[#F8FAFC] text-sm">{row.label}</span>
                      </span>
                      <span className="text-[#64748B] uppercase" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
                        Self-check
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Behaviour Focus ── */}
              <div className="rounded-xl p-6" style={CARD}>
                <SectionHeader icon={Brain} title="Behaviour Focus" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[#94A3B8] uppercase mb-1" style={{ fontSize: typography.fontSize.xs }}>Loss Discipline</p>
                    <p className="text-[#F8FAFC] font-semibold text-sm">
                      {discipline.lossDisciplineScore.value}
                      {discipline.lossDisciplineScore.metricLabel ? ` (${discipline.lossDisciplineScore.metricLabel})` : ""}
                    </p>
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
              </div>

              {/* ── Market Intelligence ── */}
              <div className="rounded-xl p-6" style={CARD}>
                <SectionHeader icon={Activity} title="Market Intelligence" />
                {!marketIntelLoading && (
                  <p className="text-[#64748B] -mt-2 mb-4" style={{ fontSize: typography.fontSize.xs }}>
                    Updated {formatUpdatedAt(marketIntel.fetchedAt)}
                  </p>
                )}
                {marketIntelLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-5 h-5 border-2 border-[#298DFF] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {INSTRUMENT_KEYS.map((key) => (
                      <MarketIntelligenceCard key={key} instrument={marketIntel.instruments[key]} />
                    ))}
                  </div>
                )}
              </div>

              {/* ── Ask EdgePilot ── */}
              <div className="rounded-xl p-6 flex items-center justify-between gap-4 flex-wrap" style={CARD}>
                <div className="flex items-center gap-4">
                  <EdgePilotAvatar state="confident" size={72} />
                  <div>
                    <h3 className="text-[#F8FAFC] font-semibold mb-1" style={{ fontSize: typography.fontSize.section }}>Ask EdgePilot</h3>
                    <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.xs }}>Coming soon: conversational trading copilot.</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold cursor-not-allowed"
                  style={{ background: "rgba(148,163,184,0.08)", color: "#64748B", border: "1px solid rgba(148,163,184,0.15)" }}
                >
                  Ask EdgePilot
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
