import { DailyContract, Trade } from "@/types";
import { BriefingMode } from "./aiCoach";
import { TraderDiscipline } from "./traderDiscipline";
import { detectSession } from "@/lib/importTrades";

// ============================================================
// PropEdge — Accountability + Plan Deviation Engine (EdgePilot V2)
// ============================================================
// Answers "did today's actual trading match the plan the trader committed
// to?" — entirely from a DailyContract + that account's Trade history,
// pure and deterministic like every other engine in this folder. One
// detector list (computeDeviations, the "Plan Deviation Engine") feeds
// both the raw violation feed shown on EdgePilot/Rules and the aggregate
// score/grade (computeDailyAccountability, the "Accountability Engine") —
// no duplicated detection logic between the two spec sections.
//
// Every detector is evidence-based and independently gated: if the data
// needed to check a rule isn't there (no session recorded, insufficient
// sizing history, no contract at all), it's skipped rather than guessed.
// No detector ever penalizes a winning trade purely for being profitable —
// estimatedCost is always $0 unless the trade actually lost money, since a
// cost figure this system reports must be real, not hypothetical.

export type DeviationSeverity = "low" | "medium" | "high" | "critical";
export type DeviationConfidence = "High" | "Moderate" | "Low";

export type DeviationType =
  | "max_risk_exceeded"
  | "trade_count_exceeded"
  | "trading_after_daily_stop"
  | "outside_allowed_session"
  | "unauthorized_instrument"
  | "position_size_escalation"
  | "revenge_trading_sequence";

export interface Deviation {
  type: DeviationType;
  label: string;
  severity: DeviationSeverity;
  evidence: string;
  estimatedCost: number;
  confidence: DeviationConfidence;
  behaviouralExplanation: string;
  recommendation: string;
}

function fmt$(v: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function lossAmount(t: Trade): number {
  return t.pnl < 0 ? Math.abs(t.pnl) : 0;
}

// Session/time-scoped detectors and Position Size Escalation both need
// today's trades in chronological order — same "entryTime string sort"
// convention traderDiscipline.ts's sortChronologically uses, scoped here
// to a single already-filtered day so a plain string sort is enough.
function sortByEntryTime(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => (a.entryTime ?? "").localeCompare(b.entryTime ?? ""));
}

function toTimestamp(dateStr: string, timeStr?: string): number | null {
  if (!dateStr || !timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return null;
  const ts = new Date(`${dateStr}T${timeStr}:00`).getTime();
  return Number.isFinite(ts) ? ts : null;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// ── 1. Max Risk Exceeded ─────────────────────────────────────────────────
// Evidence = the realized loss itself, not a separately-tracked planned-risk
// figure (Trade has no risk-amount field anywhere in this schema) — a loss
// beyond the committed ceiling is real evidence of a risk breach regardless
// of whether the cause was a missing stop, a widened stop, or slippage.

function detectMaxRiskExceeded(contract: DailyContract, todaysTrades: Trade[]): Deviation[] {
  if (contract.maxRiskPerTrade == null || contract.maxRiskPerTrade <= 0) return [];
  const violations: Deviation[] = [];
  for (const t of todaysTrades) {
    const loss = lossAmount(t);
    if (loss <= contract.maxRiskPerTrade) continue;
    const severity: DeviationSeverity = loss > contract.maxRiskPerTrade * 2 ? "critical" : "high";
    violations.push({
      type: "max_risk_exceeded",
      label: "Maximum Risk Exceeded",
      severity,
      evidence: `Planned max risk: ${fmt$(contract.maxRiskPerTrade)}/trade. Actual loss on ${t.symbol}: ${fmt$(loss)}.`,
      estimatedCost: round2(loss - contract.maxRiskPerTrade),
      confidence: "High",
      behaviouralExplanation: "A loss beyond your committed risk means your stop wasn't respected or the position was sized past your plan for this trade.",
      recommendation: `Keep every loss at or under ${fmt$(contract.maxRiskPerTrade)} — respect your stop.`,
    });
  }
  return violations;
}

// ── 2. Trade Count Exceeded ──────────────────────────────────────────────
// One bundled violation (not one per excess trade) — the rule break is
// "you kept trading past your cap," which happened once, not N times.

const TRADE_COUNT_CRITICAL_OVERAGE = 3;

function detectTradeCountExceeded(contract: DailyContract, todaysTrades: Trade[]): Deviation[] {
  if (contract.maxTrades == null || todaysTrades.length <= contract.maxTrades) return [];
  const excess = todaysTrades.slice(contract.maxTrades);
  const cost = excess.reduce((s, t) => s + lossAmount(t), 0);
  const overage = todaysTrades.length - contract.maxTrades;
  const severity: DeviationSeverity = overage >= TRADE_COUNT_CRITICAL_OVERAGE ? "critical" : "high";
  return [
    {
      type: "trade_count_exceeded",
      label: "Trade Count Exceeded",
      severity,
      evidence: `Planned max trades: ${contract.maxTrades}. Actual: ${todaysTrades.length}.`,
      estimatedCost: round2(cost),
      confidence: "High",
      behaviouralExplanation: "Trading past your own cap usually means chasing a losing session or forcing setups that weren't there.",
      recommendation: "Stop entering new trades once you hit your daily trade cap.",
    },
  ];
}

// ── 3. Trading After Daily Stop ──────────────────────────────────────────
// Walk chronologically, find where consecutive losses reach the committed
// stop, bundle everything traded after that point into one critical
// violation — mirrors the spec's own worked example exactly.

function detectTradingAfterDailyStop(contract: DailyContract, todaysTrades: Trade[]): Deviation[] {
  if (contract.stopAfterLosses == null || contract.stopAfterLosses <= 0) return [];
  let consecutiveLosses = 0;
  let stopIndex = -1;
  for (let i = 0; i < todaysTrades.length; i++) {
    consecutiveLosses = todaysTrades[i].pnl < 0 ? consecutiveLosses + 1 : 0;
    if (consecutiveLosses >= contract.stopAfterLosses) {
      stopIndex = i;
      break;
    }
  }
  if (stopIndex === -1) return [];
  const after = todaysTrades.slice(stopIndex + 1);
  if (after.length === 0) return [];
  const netAfter = after.reduce((s, t) => s + t.pnl, 0);
  return [
    {
      type: "trading_after_daily_stop",
      label: "Trading After Daily Stop",
      severity: "critical",
      evidence: `Planned stop after ${contract.stopAfterLosses} loss${contract.stopAfterLosses === 1 ? "" : "es"}. Continued trading — ${after.length} more trade${after.length === 1 ? "" : "s"} taken.`,
      estimatedCost: round2(netAfter < 0 ? Math.abs(netAfter) : 0),
      confidence: "High",
      behaviouralExplanation: "Trading past your own stop rule is the clearest sign of emotional override — the plan was abandoned mid-session.",
      recommendation: `Stop immediately after your ${ordinal(contract.stopAfterLosses)} loss — no exceptions.`,
    },
  ];
}

// ── 4. Outside Allowed Session ───────────────────────────────────────────
// Empty allowedSessions = unrestricted ("Any"), never checked. Falls back
// to the same time-window detectSession() logic already used for import
// (src/lib/importTrades.ts) when a trade's session wasn't recorded — never
// invents a session, skips if it truly can't be determined.

function detectOutsideAllowedSession(contract: DailyContract, todaysTrades: Trade[]): Deviation[] {
  if (!contract.allowedSessions || contract.allowedSessions.length === 0) return [];
  const violations: Deviation[] = [];
  for (const t of todaysTrades) {
    const session = t.session ?? (t.entryTime ? detectSession(t.entryTime) : undefined);
    if (!session || contract.allowedSessions.includes(session)) continue;
    violations.push({
      type: "outside_allowed_session",
      label: "Outside Allowed Session",
      severity: "medium",
      evidence: `Allowed session(s): ${contract.allowedSessions.join(", ")}. Actual: ${session}${t.entryTime ? ` at ${t.entryTime}` : ""} on ${t.symbol}.`,
      estimatedCost: round2(lossAmount(t)),
      confidence: "High",
      behaviouralExplanation: "Trading outside your planned session usually means chasing setups outside the hours your edge is actually proven in.",
      recommendation: `Only trade during ${contract.allowedSessions.join(", ")}.`,
    });
  }
  return violations;
}

// ── 5. Unauthorized Instrument ───────────────────────────────────────────
// Empty allowedInstruments = unrestricted ("Any"), never checked.

function detectUnauthorizedInstrument(contract: DailyContract, todaysTrades: Trade[]): Deviation[] {
  if (!contract.allowedInstruments || contract.allowedInstruments.length === 0) return [];
  const allowed = new Set(contract.allowedInstruments.map((s) => s.toUpperCase()));
  const violations: Deviation[] = [];
  for (const t of todaysTrades) {
    if (!t.symbol || allowed.has(t.symbol.toUpperCase())) continue;
    const loss = lossAmount(t);
    violations.push({
      type: "unauthorized_instrument",
      label: "Unauthorized Instrument",
      severity: loss > 0 ? "high" : "medium",
      evidence: `Allowed instrument(s): ${contract.allowedInstruments.join(", ")}. Traded: ${t.symbol}.`,
      estimatedCost: round2(loss),
      confidence: "High",
      behaviouralExplanation: "Trading an instrument outside your plan is a sign of chasing opportunity instead of executing your edge.",
      recommendation: `Only trade ${contract.allowedInstruments.join(", ")} today.`,
    });
  }
  return violations;
}

// ── 6. Position Size Escalation ──────────────────────────────────────────
// Baseline is this account's own median lot size on the same symbol, from
// trade history BEFORE today — needs enough prior trades to mean anything
// (same 10-trade "not a coincidence" floor traderDiscipline.ts's
// MIN_GROUP_SAMPLE_SIZE uses for its own lot-size groupings), so an
// instrument a trader is new to never gets flagged for lacking a baseline.

const MIN_SIZING_BASELINE_SAMPLE = 10;
const SIZING_RELIABLE_SAMPLE = 30;
const SIZING_ESCALATION_MULTIPLE = 1.5;

function detectPositionSizeEscalation(todaysTrades: Trade[], priorTrades: Trade[]): Deviation[] {
  const bySymbol = new Map<string, number[]>();
  for (const t of priorTrades) {
    if (!t.symbol || t.quantity <= 0) continue;
    const arr = bySymbol.get(t.symbol) ?? [];
    arr.push(t.quantity);
    bySymbol.set(t.symbol, arr);
  }

  const violations: Deviation[] = [];
  for (const t of todaysTrades) {
    if (!t.symbol || t.quantity <= 0) continue;
    const history = bySymbol.get(t.symbol);
    if (!history || history.length < MIN_SIZING_BASELINE_SAMPLE) continue;
    const baseline = median(history);
    if (baseline <= 0 || t.quantity <= baseline * SIZING_ESCALATION_MULTIPLE) continue;
    const pctOver = Math.round(((t.quantity - baseline) / baseline) * 100);
    violations.push({
      type: "position_size_escalation",
      label: "Position Size Escalation",
      severity: "medium",
      evidence: `Typical size on ${t.symbol}: ${baseline.toFixed(2)} lots. This trade: ${t.quantity.toFixed(2)} lots (+${pctOver}%).`,
      estimatedCost: round2(lossAmount(t)),
      confidence: history.length >= SIZING_RELIABLE_SAMPLE ? "High" : "Moderate",
      behaviouralExplanation: "Sizing well above your own historical norm on this instrument is a common precursor to an account-threatening loss.",
      recommendation: `Keep sizing on ${t.symbol} consistent with your historical median (${baseline.toFixed(2)} lots).`,
    });
  }
  return violations;
}

// ── 7. Revenge Trading Sequence ──────────────────────────────────────────
// A loss followed within a short window by a same-or-larger-size re-entry
// — the classic "win it back immediately" tell. 15 minutes is a named,
// documented threshold (same convention as aiCoach.ts's other constants),
// not derived from data — this is an intraday per-incident detector, a
// different lens from traderDiscipline.ts's aggregate revenge-trading
// score, which compares average delays across a trader's whole history.

const REVENGE_REENTRY_MINUTES = 15;

function detectRevengeTradingSequence(todaysTrades: Trade[]): Deviation[] {
  const violations: Deviation[] = [];
  for (let i = 0; i < todaysTrades.length - 1; i++) {
    const cur = todaysTrades[i];
    const next = todaysTrades[i + 1];
    if (cur.pnl >= 0) continue;
    const exitTs = toTimestamp(cur.exitDate, cur.exitTime);
    const entryTs = toTimestamp(next.entryDate, next.entryTime);
    if (exitTs === null || entryTs === null) continue;
    const minutes = (entryTs - exitTs) / 60_000;
    if (minutes < 0 || minutes > REVENGE_REENTRY_MINUTES) continue;
    if (next.quantity < cur.quantity) continue; // sized down after the loss — not a revenge signal
    violations.push({
      type: "revenge_trading_sequence",
      label: "Revenge Trading Sequence",
      severity: "high",
      evidence: `Re-entered ${next.symbol} ${Math.round(minutes)} min after a loss on ${cur.symbol}, same or larger size (${next.quantity.toFixed(2)} vs ${cur.quantity.toFixed(2)} lots).`,
      estimatedCost: round2(lossAmount(next)),
      confidence: "Moderate",
      behaviouralExplanation: "Re-entering this fast after a loss, at the same or larger size, is the classic emotional 'win it back' pattern.",
      recommendation: "Step away for at least 15–30 minutes after a loss before re-entering.",
    });
  }
  return violations;
}

// ── Payout-mode severity escalation ──────────────────────────────────────
// Post-process, not a detector: any violation that happens while the
// account is in Payout Protection mode (aiCoach.ts's BriefingMode) is more
// costly than the same violation in a normal session, so every severity
// found above is bumped one level.

const SEVERITY_ESCALATION: Record<DeviationSeverity, DeviationSeverity> = {
  low: "medium",
  medium: "high",
  high: "critical",
  critical: "critical",
};

function escalateForPayoutMode(deviations: Deviation[], briefingMode: BriefingMode): Deviation[] {
  if (briefingMode !== "payout_protection") return deviations;
  return deviations.map((d) => ({
    ...d,
    severity: SEVERITY_ESCALATION[d.severity],
    evidence: `${d.evidence} — occurred while in Payout Protection mode.`,
  }));
}

// ── Plan Deviation Engine ────────────────────────────────────────────────

export function computeDeviations(contract: DailyContract | null, accountTrades: Trade[], briefingMode: BriefingMode): Deviation[] {
  if (!contract) return [];
  const todaysTrades = sortByEntryTime(accountTrades.filter((t) => t.entryDate === contract.contractDate));
  const priorTrades = accountTrades.filter((t) => t.entryDate < contract.contractDate);

  const deviations = [
    ...detectMaxRiskExceeded(contract, todaysTrades),
    ...detectTradeCountExceeded(contract, todaysTrades),
    ...detectTradingAfterDailyStop(contract, todaysTrades),
    ...detectOutsideAllowedSession(contract, todaysTrades),
    ...detectUnauthorizedInstrument(contract, todaysTrades),
    ...detectPositionSizeEscalation(todaysTrades, priorTrades),
    ...detectRevengeTradingSequence(todaysTrades),
  ];

  return escalateForPayoutMode(deviations, briefingMode);
}

// ── Accountability Engine (Post-Session Audit) ───────────────────────────

export type DailyGrade = "A" | "B" | "C" | "D" | "F";

export interface DailyAccountability {
  ruleCompliancePercent: number;
  behaviourScore: number | null;
  planComplianceScore: number;
  grade: DailyGrade;
  biggestDeviation: Deviation | null;
  estimatedCostOfDeviations: number;
  deviations: Deviation[];
}

const SEVERITY_WEIGHT: Record<DeviationSeverity, number> = { critical: 40, high: 20, medium: 10, low: 5 };

// Same "{score}/100" shape traderDiscipline.ts's own
// parseRecoveryRatePercent duplicates rather than importing a private
// helper from another file — same convention, applied here.
function parseLossDisciplineScore(discipline: TraderDiscipline): number | null {
  const match = discipline.lossDisciplineScore.metricLabel.match(/^(\d+)\/100$/);
  return match ? Number(match[1]) : null;
}

function gradeFromScore(score: number): DailyGrade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

// behaviourScore reuses the account's existing rolling Loss Discipline
// Score (traderDiscipline.ts) rather than recomputing from today's tiny
// trade sample — a single day rarely has enough trades to score behaviour
// on its own, so this is the trader's real behavioural baseline, not noise.
// planComplianceScore never has a pnl term — "Discipline must dominate"
// per spec, so profitability plays literally zero role in the grade.
export function computeDailyAccountability(
  contract: DailyContract | null,
  accountTrades: Trade[],
  briefingMode: BriefingMode,
  discipline: TraderDiscipline
): DailyAccountability {
  const deviations = computeDeviations(contract, accountTrades, briefingMode);
  const ruleCompliancePercent = Math.max(0, 100 - deviations.reduce((s, d) => s + SEVERITY_WEIGHT[d.severity], 0));
  const behaviourScore = parseLossDisciplineScore(discipline);
  const planComplianceScore =
    behaviourScore !== null ? Math.round(0.6 * ruleCompliancePercent + 0.4 * behaviourScore) : ruleCompliancePercent;
  const biggestDeviation =
    deviations.length === 0
      ? null
      : [...deviations].sort((a, b) => b.estimatedCost - a.estimatedCost || SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity])[0];

  return {
    ruleCompliancePercent,
    behaviourScore,
    planComplianceScore,
    grade: gradeFromScore(planComplianceScore),
    biggestDeviation,
    estimatedCostOfDeviations: round2(deviations.reduce((s, d) => s + d.estimatedCost, 0)),
    deviations,
  };
}
