import { Trade, Challenge, FundedAccount, Payout, DashboardKPIs, PersonalAccount } from "@/types";
import { computeDrawdown, resolveDrawdownDollars } from "@/lib/drawdown";
import { evaluatePayoutEligibility, parseConsistencyLimitPercent, ConsistencyCheck, MinimumTradingDaysCheck, MinimumPayoutCheck } from "./payoutEligibility";
import { TraderIdentity } from "./traderIdentity";
import { TraderHabits } from "./traderHabits";
import { TraderEdge } from "./traderEdge";
import { TraderBlindSpots } from "./traderBlindSpots";
import { TraderDiscipline, getTraderDiscipline } from "./traderDiscipline";
import { TraderEvolution } from "./traderEvolution";
import { DataConfidence } from "./dataConfidence";

// ============================================================
// PropEdge — AI Coach engine (V1, deterministic)
// ============================================================
// Answers exactly one question every time it runs: "What should I do
// today to protect my account, respect prop firm rules, and maximize
// payout probability?" — entirely from data already stored in Supabase
// (trades, challenges, funded accounts, payouts) plus the Trader DNA
// engines already computed elsewhere in this app.
//
// V1 is 100% rule-based arithmetic — no OpenAI/external AI call, no API
// key, no network request. Every number in every message is traced back
// to a stored field or a deterministic formula below; every threshold is
// a named constant. This keeps the coach auditable (a user can verify any
// recommendation by hand) and free to run on every render. A V2 could
// swap the narrative-building step for an LLM call while keeping this
// file's guardrail math (buffers, expectancy, consistency ratios) as the
// factual grounding the model is constrained to — see the bottom of this
// file for that seam.
//
// Self-contained by design, same convention as the rest of
// src/lib/analytics/*: no imports from traderDNA.ts/globalAnalytics.ts,
// only the finished engine outputs (TraderIdentity, TraderHabits, etc.)
// already computed by the caller. Small helpers (mean, money formatting)
// are duplicated rather than imported, matching every other file here.
//
// One deliberate exception: getAccountBriefings() (Morning Briefing V1,
// below) imports getTraderDiscipline() directly, because it needs
// behavioural signals scoped to ONE account rather than the caller's
// already-computed, all-accounts-combined `input.traderDiscipline`.
// traderDiscipline.ts is a pure function of Trade[], so filtering trades to
// one account first and calling it locally is the only way to get a
// genuinely per-account discipline score without duplicating that engine's
// math here.

// ── Output shape ─────────────────────────────────────────────────────────

export type CoachSeverity = "positive" | "neutral" | "warning" | "critical";
export type CoachRiskLevel = "low" | "moderate" | "high" | "critical";

export interface CoachItem {
  title: string;
  severity: CoachSeverity;
  message: string;
  evidence: string;
  action: string;
}

export interface RecommendedRisk {
  amount: number | null;
  currency?: string;
  rationale: string;
}

export interface AICoachOutput {
  riskLevel: CoachRiskLevel;
  mainPriority: string;
  nextBestAction: string;
  accountAlerts: CoachItem[];
  propRuleAlerts: CoachItem[];
  behaviouralInsights: CoachItem[];
  payoutReadiness: CoachItem[];
  recommendedRisk: RecommendedRisk;
  summary: string;
}

export interface AICoachInput {
  trades: Trade[];
  challenges: Challenge[];
  fundedAccounts: FundedAccount[];
  personalAccounts?: PersonalAccount[];
  payouts?: Payout[];
  dashboardKPIs?: DashboardKPIs;
  traderIdentity: TraderIdentity;
  traderHabits: TraderHabits;
  traderEdge: TraderEdge;
  traderBlindSpots: TraderBlindSpots;
  traderDiscipline: TraderDiscipline;
  traderEvolution: TraderEvolution;
  dataConfidence: DataConfidence;
}

// ── Shared helpers ───────────────────────────────────────────────────────

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function fmtMoney(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.round(Math.abs(value)).toLocaleString("en-US")}`;
}

function fmtMoneyPerTrade(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toFixed(2)}/trade`;
}

// "YYYY-MM-DD" in the trader's local time zone, matching Trade.entryDate's
// stored format exactly (see src/types/index.ts) — used to isolate today's
// trades for the Daily Loss Guardrail and the Consistency Rule's
// "is this today's profit" framing.
function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Same "not a coincidence" floor Your Edge/Blind Spots/Discipline use for
// their own expectancy-based groupings — an expectancy figure below this
// sample size is a projection, not a verified edge.
const MIN_SAMPLE_FOR_EXPECTANCY = 10;

function severityRank(s: CoachSeverity): number {
  return { critical: 3, warning: 2, neutral: 1, positive: 0 }[s];
}

// ── Unified active-account view ──────────────────────────────────────────
// Challenge and FundedAccount are different tables with different fields
// (see src/types/index.ts) — this is the minimal shape every guardrail
// rule below actually needs, built once per account so the daily/max loss
// math never has to branch on account type.

export interface AccountRef {
  id: string;
  type: "challenge" | "funded" | "personal";
  name: string;
  accountSize: number;
  currentProfit: number;
  // Non-null for challenge/funded (Supabase requires it). Personal accounts
  // have NO mandatory max drawdown rule by design — null means "no rule
  // configured", not "0% allowed".
  maxDrawdown: number | null;
  // FundedAccount carries no dailyDrawdown field in the schema (only
  // Challenge does — see src/types/index.ts) and V1 cannot add one
  // (no Supabase schema changes). The Daily Loss Guardrail therefore only
  // ever fires for challenge accounts; this is a known data-model gap,
  // not an oversight. Personal accounts: null unless the user configured
  // dailyLossLimit.
  dailyDrawdown: number | null;
  // Personal accounts only — percent of account size the user has chosen
  // to risk per trade. null = no personal sizing rule configured.
  riskPerTradePercent: number | null;
}

function buildActiveAccountRefs(
  challenges: Challenge[],
  fundedAccounts: FundedAccount[],
  personalAccounts: PersonalAccount[] = []
): AccountRef[] {
  const activeChallenges = challenges.filter((c) => c.status === "active");
  const activeFunded = fundedAccounts.filter((a) => a.status === "active");
  const activePersonal = personalAccounts.filter((p) => p.status === "active");
  return [
    ...activeChallenges.map((c): AccountRef => ({
      id: c.id,
      type: "challenge",
      name: `${c.propFirmName} — ${c.accountName}`,
      accountSize: c.accountSize,
      currentProfit: c.currentProfit,
      maxDrawdown: c.maxDrawdown,
      dailyDrawdown: c.dailyDrawdown ?? null,
      riskPerTradePercent: null,
    })),
    ...activeFunded.map((a): AccountRef => ({
      id: a.id,
      type: "funded",
      name: `${a.propFirmName} — ${a.accountName}`,
      accountSize: a.accountSize,
      currentProfit: a.currentProfit,
      maxDrawdown: a.maxDrawdown,
      dailyDrawdown: null,
      riskPerTradePercent: null,
    })),
    // No "PropFirm — " prefix — personal account names never collide with
    // the challenge/funded naming convention, which always carries that prefix.
    ...activePersonal.map((p): AccountRef => ({
      id: p.id,
      type: "personal",
      name: p.accountName,
      accountSize: p.initialCapital,
      currentProfit: p.currentEquity - p.initialCapital,
      maxDrawdown: p.maxDrawdownLimit ?? null,
      dailyDrawdown: p.dailyLossLimit ?? null,
      riskPerTradePercent: p.riskPerTradePercent ?? null,
    })),
  ];
}

function getTodayPnL(trades: Trade[], account: AccountRef, today: string): number {
  return trades
    .filter((t) => t.accountId === account.id && t.accountType === account.type && t.entryDate === today)
    .reduce((s, t) => s + t.pnl, 0);
}

// A buffer at or above this share of the limit is untouched enough to
// trade normally; below it the guardrail starts speaking up.
const BUFFER_NEUTRAL_RATIO = 0.5;
// Rule 1 & 2 thresholds, exactly as specified: under 25% remaining is
// "high risk", under 10% is "critical".
const BUFFER_WARNING_RATIO = 0.25;
const BUFFER_CRITICAL_RATIO = 0.1;

function severityFromBufferRatio(ratio: number): CoachSeverity {
  if (ratio < BUFFER_CRITICAL_RATIO) return "critical";
  if (ratio < BUFFER_WARNING_RATIO) return "warning";
  if (ratio < BUFFER_NEUTRAL_RATIO) return "neutral";
  return "positive";
}

// Deterministic "how much can I still risk" suggestion, rounded down to
// the nearest $5 for a clean, sizeable-looking number. `factor` controls
// how aggressively the buffer is eaten into — the daily buffer resets
// tomorrow so it can afford a larger slice than the max-loss buffer, which
// never resets for the life of the account.
function suggestedRiskFromBuffer(buffer: number, factor: number): number {
  return Math.max(0, Math.floor((buffer * factor) / 5) * 5);
}

const DAILY_RISK_FACTOR = 0.08;
const MAX_LOSS_RISK_FACTOR = 0.05;

// Trailing window for a Personal Account's "how is equity trending" signal
// (capital protection / growth mode + the Recommended Risk rationale).
// No peak-equity history is stored anywhere in the schema, so this is
// approximated from realized trade P&L over the window, same convention
// computeAccountRiskState already uses for drawdown below.
const RECENT_EQUITY_WINDOW_DAYS = 7;

function addDaysToDateString(dateString: string, days: number): string {
  const d = new Date(`${dateString}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Personal accounts only — % change in equity (realized P&L / account size)
// over the trailing window, used to drive capital-protection/growth
// classification and the Recommended Risk rationale. null for non-personal
// accounts (they have no equivalent notion in V1).
function computeRecentEquityChangePercent(account: AccountRef, trades: Trade[], today: string): number | null {
  if (account.type !== "personal" || account.accountSize <= 0) return null;
  const cutoff = addDaysToDateString(today, -RECENT_EQUITY_WINDOW_DAYS);
  const windowPnl = trades
    .filter(
      (t) =>
        t.accountId === account.id &&
        t.accountType === account.type &&
        t.entryDate >= cutoff &&
        t.entryDate <= today
    )
    .reduce((s, t) => s + t.pnl, 0);
  return (windowPnl / account.accountSize) * 100;
}

export interface AccountRiskState {
  account: AccountRef;
  dailyLimit: number | null;
  dailyBuffer: number | null;
  // null = no max drawdown rule configured for this account (only possible
  // for Personal Accounts — challenge/funded always carry a max drawdown).
  maxLimit: number | null;
  maxBuffer: number | null;
  recentEquityChangePercent: number | null;
}

function computeAccountRiskState(account: AccountRef, trades: Trade[], today: string): AccountRiskState {
  let dailyLimit: number | null = null;
  let dailyBuffer: number | null = null;
  if (account.dailyDrawdown != null) {
    dailyLimit = resolveDrawdownDollars(account.dailyDrawdown, account.accountSize);
    const todayPnl = getTodayPnL(trades, account, today);
    const usedToday = todayPnl < 0 ? Math.abs(todayPnl) : 0;
    dailyBuffer = Math.max(0, dailyLimit - usedToday);
  }

  // Drawdown only ever grows from realized losses — same convention
  // src/lib/drawdown.ts documents and every other page already relies on.
  // Trailing-mode accounts are approximated the same way (no peak-equity
  // history is stored anywhere in the schema to trail against precisely),
  // matching how challenges/page.tsx and funded/page.tsx already treat
  // drawdownMode as informational rather than branching the formula.
  let maxLimit: number | null = null;
  let maxBuffer: number | null = null;
  if (account.maxDrawdown !== null) {
    const dd = computeDrawdown(account.maxDrawdown, account.accountSize, account.currentProfit);
    maxLimit = dd.maxDrawdownDollars;
    maxBuffer = dd.remainingDrawdownDollars;
  }

  return {
    account,
    dailyLimit,
    dailyBuffer,
    maxLimit,
    maxBuffer,
    recentEquityChangePercent: computeRecentEquityChangePercent(account, trades, today),
  };
}

// ── Rule 1: Daily Loss Guardrail ─────────────────────────────────────────

function buildDailyLossItem(state: AccountRiskState): CoachItem | null {
  if (state.dailyLimit === null || state.dailyBuffer === null || state.dailyLimit <= 0) return null;

  const { account, dailyLimit, dailyBuffer } = state;
  const ratio = dailyBuffer / dailyLimit;
  const severity = severityFromBufferRatio(ratio);
  const suggested = suggestedRiskFromBuffer(dailyBuffer, DAILY_RISK_FACTOR);

  const action =
    severity === "critical"
      ? "Stop trading on this account for the rest of the day."
      : severity === "warning"
        ? `Reduce next trade risk to ${fmtMoney(suggested)} max or stop trading today.`
        : severity === "neutral"
          ? `Keep sizing conservative — ${fmtMoney(dailyBuffer)} of today's loss buffer remains.`
          : "No daily loss pressure right now — trade your plan normally.";

  return {
    title: `Daily Loss Guardrail — ${account.name}`,
    severity,
    message: `You are currently ${fmtMoney(dailyBuffer)} away from the daily loss limit on ${account.name}.`,
    evidence: `Daily loss limit ${fmtMoney(dailyLimit)} · Remaining today ${fmtMoney(dailyBuffer)} (${Math.round(ratio * 100)}%)`,
    action,
  };
}

// ── Rule 2: Max Loss Guardrail ───────────────────────────────────────────

function buildMaxLossItem(state: AccountRiskState): CoachItem | null {
  if (state.maxLimit === null || state.maxBuffer === null) return null;
  const { account, maxLimit, maxBuffer } = state;
  const ratio = maxLimit > 0 ? maxBuffer / maxLimit : 1;
  const severity = severityFromBufferRatio(ratio);
  const suggested = suggestedRiskFromBuffer(maxBuffer, MAX_LOSS_RISK_FACTOR);

  const action =
    severity === "critical"
      ? "Stop trading on this account — one more losing trade risks a full breach."
      : severity === "warning"
        ? `Cut position size — keep total risk under ${fmtMoney(suggested)} per trade until this buffer rebuilds.`
        : severity === "neutral"
          ? `Trade normally but avoid oversized positions — ${fmtMoney(maxBuffer)} of max drawdown buffer remains.`
          : "Your max loss buffer is healthy.";

  return {
    title: `Max Loss Guardrail — ${account.name}`,
    severity,
    message: `You have ${fmtMoney(maxBuffer)} of max drawdown buffer left on ${account.name} (${Math.round(ratio * 100)}% remaining).`,
    evidence: `Max drawdown allowance ${fmtMoney(maxLimit)} · Remaining ${fmtMoney(maxBuffer)}`,
    action,
  };
}

// ── Rule 3: Profit Target Plan ───────────────────────────────────────────

function buildProfitTargetItem(challenge: Challenge, trades: Trade[]): CoachItem | null {
  if (!challenge.profitTarget || challenge.profitTarget <= 0) return null;

  const name = `${challenge.propFirmName} — ${challenge.accountName}`;
  const remaining = challenge.profitTarget - challenge.currentProfit;

  if (remaining <= 0) {
    return {
      title: `Profit Target Plan — ${name}`,
      severity: "positive",
      message: `You have already reached the profit target on ${name}.`,
      evidence: `Target ${fmtMoney(challenge.profitTarget)} · Current profit ${fmtMoney(challenge.currentProfit)}`,
      action: "Review this account for a pass/payout request rather than continuing to add risk.",
    };
  }

  const accountTrades = trades.filter((t) => t.accountId === challenge.id && t.accountType === "challenge");
  const expectancy = accountTrades.length > 0 ? mean(accountTrades.map((t) => t.pnl)) : 0;
  const reliable = accountTrades.length >= MIN_SAMPLE_FOR_EXPECTANCY && expectancy > 0;

  if (!reliable) {
    return {
      title: `Profit Target Plan — ${name}`,
      severity: "neutral",
      message: `You are ${fmtMoney(remaining)} away from the profit target on ${name}.`,
      evidence:
        accountTrades.length === 0
          ? "No trades logged on this account yet."
          : `Current expectancy ${fmtMoneyPerTrade(expectancy)} across ${accountTrades.length} trades — not enough history for a reliable projection yet.`,
      action: "Trade your plan and log every trade — the projection will firm up once expectancy is reliably positive.",
    };
  }

  const tradesNeeded = Math.ceil(remaining / expectancy);
  return {
    title: `Profit Target Plan — ${name}`,
    severity: "neutral",
    message: `You are ${fmtMoney(remaining)} away from target on ${name}. At your current expectancy of ${fmtMoneyPerTrade(expectancy)}, this requires around ${tradesNeeded} quality trade${tradesNeeded === 1 ? "" : "s"}.`,
    evidence: `Target ${fmtMoney(challenge.profitTarget)} · Current profit ${fmtMoney(challenge.currentProfit)} · Expectancy ${fmtMoneyPerTrade(expectancy)} (${accountTrades.length} trades)`,
    action: `Focus on your highest-quality setups — roughly ${tradesNeeded} trade${tradesNeeded === 1 ? "" : "s"} at current expectancy closes the gap.`,
  };
}

// ── Rule 4: Consistency Rule ─────────────────────────────────────────────
// parseConsistencyLimitPercent now lives in ./payoutEligibility (imported
// above) since it's shared with the payout-eligibility service below.

function buildConsistencyItem(
  name: string,
  accountId: string,
  accountType: "challenge" | "funded",
  trades: Trade[],
  totalProfit: number,
  limitPercent: number | null,
  today: string
): CoachItem | null {
  if (limitPercent === null || totalProfit <= 0) return null;

  const accountTrades = trades.filter((t) => t.accountId === accountId && t.accountType === accountType);
  const byDay = new Map<string, number>();
  for (const t of accountTrades) byDay.set(t.entryDate, (byDay.get(t.entryDate) ?? 0) + t.pnl);

  let bestDate: string | null = null;
  let bestAmount = 0;
  for (const [date, amount] of byDay) {
    if (amount > bestAmount) {
      bestAmount = amount;
      bestDate = date;
    }
  }
  if (bestDate === null || bestAmount <= 0) return null;

  const concentrationPct = Math.round((bestAmount / totalProfit) * 100);
  const isToday = bestDate === today;
  const severity: CoachSeverity =
    concentrationPct >= limitPercent ? "critical" : concentrationPct >= limitPercent * 0.8 ? "warning" : "positive";

  const dayPhrase = isToday ? "Today's profit" : `Your best trading day (${bestDate})`;

  return {
    title: `Consistency Rule — ${name}`,
    severity,
    message: `${dayPhrase} already represents ${concentrationPct}% of total profit on ${name}, against a ${limitPercent}% consistency limit.`,
    evidence: `Best single-day profit ${fmtMoney(bestAmount)} on ${bestDate} · Total profit ${fmtMoney(totalProfit)} · Limit ${limitPercent}%`,
    action:
      severity === "positive"
        ? "No concentration risk right now — keep spreading profitable trades across multiple days."
        : "Avoid increasing size on your best-performing day; spread profitable trades across more days to protect payout eligibility.",
  };
}

// ── Rule 5: Payout Readiness ─────────────────────────────────────────────
// Sources every rule fact from evaluatePayoutEligibility (src/lib/analytics/
// payoutEligibility.ts) — the single source of truth shared with Dashboard,
// Risk Center, the Funded page, and Portfolio analytics — and only owns the
// user-facing coaching copy/severity/tone here.

interface PayoutReadinessResult {
  items: CoachItem[];
  isNear: boolean;
}

function buildPayoutReadinessItems(
  account: FundedAccount,
  challenges: Challenge[],
  trades: Trade[],
  payouts: Payout[],
  today: string
): PayoutReadinessResult {
  const name = `${account.propFirmName} — ${account.accountName}`;
  const { checks, availableProfit, isEligible } = evaluatePayoutEligibility(account, trades, challenges, payouts);

  const items: CoachItem[] = [];

  const minDaysCheck = checks.find((c): c is MinimumTradingDaysCheck => c.key === "minimumTradingDays");
  if (minDaysCheck) {
    const missing = minDaysCheck.requiredDays - minDaysCheck.qualifyingDays;
    const ok = minDaysCheck.status === "satisfied";
    items.push({
      title: `Minimum Trading Days — ${name}`,
      severity: ok ? "positive" : "warning",
      message: ok
        ? `You have met the minimum trading days requirement on ${name} (${minDaysCheck.qualifyingDays}/${minDaysCheck.requiredDays} profitable days).`
        : `You still need ${missing} more profitable trading day${missing === 1 ? "" : "s"} on ${name} before this account is payout-eligible.`,
      evidence: `Profitable trading days ${minDaysCheck.qualifyingDays} of required ${minDaysCheck.requiredDays}`,
      action: ok ? "Requirement satisfied." : "Prioritize consistent, quality setups to bank more profitable days.",
    });
  }

  items.push({
    title: `Profit Available — ${name}`,
    severity: availableProfit > 0 ? "positive" : "neutral",
    message:
      availableProfit > 0
        ? `${fmtMoney(availableProfit)} of unclaimed profit is available for payout on ${name}.`
        : `No unclaimed profit is currently available for payout on ${name}.`,
    evidence: `Current profit ${fmtMoney(account.currentProfit)} · Available ${fmtMoney(availableProfit)}`,
    action: availableProfit > 0 ? "Confirm the other payout conditions before requesting." : "Keep trading to build claimable profit.",
  });

  const minPayoutCheck = checks.find((c): c is MinimumPayoutCheck => c.key === "minimumPayout");
  if (minPayoutCheck) {
    const ok = minPayoutCheck.status === "satisfied";
    items.push({
      title: `Minimum Payout Threshold — ${name}`,
      severity: ok ? "positive" : "warning",
      message: ok
        ? `Available profit meets the ${fmtMoney(minPayoutCheck.requiredMinPayout)} minimum payout threshold on ${name}.`
        : `You need ${fmtMoney(minPayoutCheck.requiredMinPayout - minPayoutCheck.availableProfit)} more available profit on ${name} to clear the ${fmtMoney(minPayoutCheck.requiredMinPayout)} minimum payout threshold.`,
      evidence: `Available ${fmtMoney(minPayoutCheck.availableProfit)} · Minimum required ${fmtMoney(minPayoutCheck.requiredMinPayout)}`,
      action: ok ? "Requirement satisfied." : "Continue trading toward the minimum payout threshold before filing a request.",
    });
  }

  const consistencyCheck = checks.find((c): c is ConsistencyCheck => c.key === "consistency");
  if (consistencyCheck) {
    const isToday = consistencyCheck.bestDayDate === today;
    const severity: CoachSeverity =
      consistencyCheck.bestDayConcentrationPercent >= consistencyCheck.limitPercent
        ? "critical"
        : consistencyCheck.bestDayConcentrationPercent >= consistencyCheck.limitPercent * 0.8
          ? "warning"
          : "positive";
    const dayPhrase = isToday ? "Today's profit" : `Your best trading day (${consistencyCheck.bestDayDate})`;
    items.push({
      title: `Consistency Rule (Payout) — ${name}`,
      severity,
      message: `${dayPhrase} already represents ${consistencyCheck.bestDayConcentrationPercent}% of total profit on ${name}, against a ${consistencyCheck.limitPercent}% consistency limit.`,
      evidence: `Best single-day profit ${fmtMoney(consistencyCheck.bestDayAmount)} on ${consistencyCheck.bestDayDate} · Total profit ${fmtMoney(account.currentProfit)} · Limit ${consistencyCheck.limitPercent}%`,
      action:
        severity === "positive"
          ? "No concentration risk right now — keep spreading profitable trades across multiple days."
          : "Avoid increasing size on your best-performing day; spread profitable trades across more days to protect payout eligibility.",
    });
  }

  // Matches prior semantics exactly: eligible on every applicable rule AND
  // there's actually unclaimed profit to request — a payout-ready account
  // with $0 available isn't "near" a payout regardless of rule status.
  const isNear = isEligible && availableProfit > 0;
  return { items, isNear };
}

// ── Rule 7: Behavioural Overlay ──────────────────────────────────────────

function buildBehaviouralInsights(discipline: TraderDiscipline, edge: TraderEdge): CoachItem[] {
  const items: CoachItem[] = [];

  if (discipline.performanceAfterLoss.value === "Negative Recovery") {
    items.push({
      title: "Biggest Behavioural Leak — Trading After Losses",
      severity: "warning",
      message: "Your biggest behavioural leak is how you trade immediately after a loss.",
      evidence: `${discipline.performanceAfterLoss.narrative} (${discipline.performanceAfterLoss.metricLabel}, ${discipline.performanceAfterLoss.sampleSize} trades)`,
      action: "After any loss today, pause and take a fixed cooldown before your next entry — especially after a losing streak.",
    });
  }

  if (discipline.riskConsistency.value === "Variable" || discipline.riskConsistency.value === "Highly Variable") {
    items.push({
      title: "Position Sizing Inconsistency",
      severity: discipline.riskConsistency.value === "Highly Variable" ? "critical" : "warning",
      message: `Your position sizing is currently ${discipline.riskConsistency.value.toLowerCase()}.`,
      evidence: `${discipline.riskConsistency.narrative} (median ${discipline.riskConsistency.metricLabel})`,
      action: "Pick one lot size for today's setups and stick to it instead of adjusting size trade-to-trade.",
    });
  }

  if (discipline.positionSizeAfterLosses.value === "Increasing Risk") {
    items.push({
      title: "Revenge Sizing Detected",
      severity: "critical",
      message: "You tend to increase your position size right after a losing trade.",
      evidence: `${discipline.positionSizeAfterLosses.narrative} (${discipline.positionSizeAfterLosses.metricLabel})`,
      action: "Cap your position size at today's planned risk regardless of the previous trade's outcome.",
    });
  }

  if (edge.bestSetup.sampleSize >= MIN_SAMPLE_FOR_EXPECTANCY) {
    items.push({
      title: "Best Setup Focus",
      severity: "positive",
      message: `Your strongest statistical edge is ${edge.bestSetup.value}${edge.bestSetup.detail ? ` (${edge.bestSetup.detail})` : ""}.`,
      evidence: `${edge.bestSetup.metricLabel} across ${edge.bestSetup.sampleSize} trades`,
      action: "Prioritize this setup today and treat everything else as lower conviction.",
    });
  }

  return items;
}

// ── Rule 6: Recommended Risk ─────────────────────────────────────────────

function parseLossDisciplineScore(discipline: TraderDiscipline): number | null {
  const match = discipline.lossDisciplineScore.metricLabel.match(/^(\d+)\/100$/);
  return match ? Number(match[1]) : null;
}

function hasRevengeSignal(discipline: TraderDiscipline): boolean {
  return (
    discipline.positionSizeAfterLosses.value === "Increasing Risk" ||
    discipline.revengeTradingRisk.value === "High" ||
    discipline.revengeTradingScore.value === "Poor" ||
    discipline.revengeTradingScore.value === "High Risk"
  );
}

const RISK_LEVEL_HARD_CAP_RATIO = 0.01; // never recommend more than 1% of account size per trade
// Personal Accounts with neither a daily nor max drawdown rule configured
// fall back to this — tighter than the generic 1% hard cap since there's no
// other guardrail backstopping the trader on that account.
const PERSONAL_DEFAULT_RISK_RATIO = 0.005;
// A trailing-week equity drop at or beyond this magnitude puts a Personal
// Account into capital-protection mode (Recommended Risk rationale + Morning
// Briefing mode) — the ticket's own example ("down 3.2%... reduce risk").
const PERSONAL_PROTECTION_THRESHOLD_PCT = 2;

function buildRecommendedRisk(
  primaryState: AccountRiskState | null,
  discipline: TraderDiscipline,
  nearPayout: boolean
): RecommendedRisk {
  if (primaryState === null) {
    return { amount: null, currency: "USD", rationale: "No active accounts to size risk for." };
  }

  const { account, dailyBuffer, maxBuffer, recentEquityChangePercent } = primaryState;

  const candidates: { amount: number; label: string }[] = [];
  if (dailyBuffer !== null) candidates.push({ amount: dailyBuffer * DAILY_RISK_FACTOR, label: "today's daily loss buffer" });
  if (maxBuffer !== null) candidates.push({ amount: maxBuffer * MAX_LOSS_RISK_FACTOR, label: "the max drawdown buffer" });
  candidates.push({ amount: account.accountSize * RISK_LEVEL_HARD_CAP_RATIO, label: "a 1% of account size cap" });

  if (account.type === "personal") {
    if (account.riskPerTradePercent !== null) {
      candidates.push({
        amount: account.accountSize * (account.riskPerTradePercent / 100),
        label: "your configured risk per trade",
      });
    } else if (dailyBuffer === null && maxBuffer === null) {
      candidates.push({
        amount: account.accountSize * PERSONAL_DEFAULT_RISK_RATIO,
        label: "a conservative 0.5% of account size default (no risk rules configured)",
      });
    }
  }

  const tightest = candidates.reduce((a, b) => (b.amount < a.amount ? b : a));
  let amount = tightest.amount;
  const reasons = [`capped by ${tightest.label}`];

  // Rule 6: never recommend more than the available buffer allows, then
  // scale down further for behavioural risk — each factor only ever
  // reduces the number, never increases it.
  const score = parseLossDisciplineScore(discipline);
  if (score !== null && score < 50) {
    amount *= 0.5;
    reasons.push("halved for a below-average loss discipline score");
  }

  if (hasRevengeSignal(discipline)) {
    amount *= 0.5;
    reasons.push("reduced further for active revenge-trading signals");
  }

  if (nearPayout) {
    amount *= 0.5;
    reasons.push("payout protection mode active — this account is close to payout eligibility");
  }

  amount = Math.max(0, Math.floor(amount / 5) * 5);

  if (account.type === "personal" && recentEquityChangePercent !== null && recentEquityChangePercent <= -PERSONAL_PROTECTION_THRESHOLD_PCT) {
    const riskPct = account.accountSize > 0 ? (amount / account.accountSize) * 100 : 0;
    return {
      amount,
      currency: "USD",
      rationale: `${account.name} is down ${Math.abs(recentEquityChangePercent).toFixed(1)}% this week. Reduce risk to ${riskPct.toFixed(2)}% until equity recovers. (${reasons.join("; ")})`,
    };
  }

  return {
    amount,
    currency: "USD",
    rationale: `Based on ${account.name}: ${reasons.join("; ")}.`,
  };
}

// ── Recent expectancy (used only for Main Priority's negative-expectancy
// check) ─────────────────────────────────────────────────────────────────
// The last 30 chronological trades across every account passed in — a
// simple, self-contained recency window rather than parsing any other
// engine's formatted output.

function computeRecentExpectancy(trades: Trade[]): { expectancy: number; sampleSize: number } {
  const valid = trades.filter((t) => !!t.entryDate && Number.isFinite(t.pnl));
  const sorted = [...valid].sort(
    (a, b) => a.entryDate.localeCompare(b.entryDate) || (a.entryTime ?? "").localeCompare(b.entryTime ?? "")
  );
  const recent = sorted.slice(-30);
  return { expectancy: recent.length > 0 ? mean(recent.map((t) => t.pnl)) : 0, sampleSize: recent.length };
}

// ── Rule 8: Main Priority Selection ──────────────────────────────────────
// Walks the fixed priority order from the spec, returning the first
// condition that actually applies. Every branch reuses an item/value this
// file already computed — no new thresholds decided here.

function selectMainPriority(
  accountAlerts: CoachItem[],
  propRuleAlerts: CoachItem[],
  nearPayout: boolean,
  nearPayoutAccountName: string | null,
  recentExpectancy: number,
  recentSampleSize: number,
  discipline: TraderDiscipline,
  edge: TraderEdge
): { mainPriority: string; nextBestAction: string } {
  const criticalDaily = accountAlerts.find((i) => i.title.startsWith("Daily Loss Guardrail") && i.severity === "critical");
  if (criticalDaily) {
    return {
      mainPriority: `Protect against a daily loss breach — ${criticalDaily.title.replace("Daily Loss Guardrail — ", "")}`,
      nextBestAction: criticalDaily.action,
    };
  }

  const criticalMax = accountAlerts.find((i) => i.title.startsWith("Max Loss Guardrail") && i.severity === "critical");
  if (criticalMax) {
    return {
      mainPriority: `Protect against a max drawdown breach — ${criticalMax.title.replace("Max Loss Guardrail — ", "")}`,
      nextBestAction: criticalMax.action,
    };
  }

  if (nearPayout && nearPayoutAccountName) {
    return {
      mainPriority: `Protect your upcoming payout on ${nearPayoutAccountName}`,
      nextBestAction: "Switch to payout protection mode — trade smaller size and avoid unnecessary risk until the payout is requested.",
    };
  }

  if (recentSampleSize >= MIN_SAMPLE_FOR_EXPECTANCY && recentExpectancy <= 0) {
    return {
      mainPriority: "Your recent expectancy is flat or negative",
      nextBestAction: "Pause and review your last losing trades before sizing up again — trade only your highest-conviction setup.",
    };
  }

  const score = parseLossDisciplineScore(discipline);
  if (score !== null && score < 50) {
    return {
      mainPriority: "Improve your loss discipline",
      nextBestAction: discipline.lossDisciplineScore.narrative || "Reduce risk after losses and give yourself a cooldown before re-entering.",
    };
  }

  if (discipline.riskConsistency.value === "Highly Variable" || discipline.riskConsistency.value === "Variable") {
    return {
      mainPriority: "Tighten your position-sizing consistency",
      nextBestAction: "Pick one lot size for today's setups and stick to it.",
    };
  }

  const openProfitTargetItem = propRuleAlerts.find((i) => i.title.startsWith("Profit Target Plan") && i.severity !== "positive");
  if (openProfitTargetItem) {
    return {
      mainPriority: openProfitTargetItem.title.replace("Profit Target Plan — ", "Work toward the profit target on "),
      nextBestAction: openProfitTargetItem.action,
    };
  }

  if (edge.bestSetup.sampleSize >= MIN_SAMPLE_FOR_EXPECTANCY) {
    return {
      mainPriority: `Focus on your best setup: ${edge.bestSetup.value}${edge.bestSetup.detail ? ` (${edge.bestSetup.detail})` : ""}`,
      nextBestAction: "Prioritize this setup today and size normally within your existing buffers.",
    };
  }

  return {
    mainPriority: "No urgent risk today — trade your plan",
    nextBestAction: "Keep executing your normal process; no guardrail or behavioural flag needs attention right now.",
  };
}

// ── Overall Risk Level ────────────────────────────────────────────────────

function computeOverallRiskLevel(items: CoachItem[]): CoachRiskLevel {
  if (items.some((i) => i.severity === "critical")) return "critical";
  const warnings = items.filter((i) => i.severity === "warning").length;
  if (warnings >= 2) return "high";
  if (warnings === 1) return "moderate";
  return "low";
}

// ── Summary ────────────────────────────────────────────────────────────────

function buildSummary(
  riskLevel: CoachRiskLevel,
  mainPriority: string,
  recommendedRisk: RecommendedRisk,
  dashboardKPIs: DashboardKPIs | undefined
): string {
  const riskAmountPhrase =
    recommendedRisk.amount !== null ? ` Recommended max risk per trade today: ${fmtMoney(recommendedRisk.amount)}.` : "";
  const breachNote =
    dashboardKPIs && dashboardKPIs.breachedFundedAccounts > 0
      ? ` You currently have ${dashboardKPIs.breachedFundedAccounts} breached account${dashboardKPIs.breachedFundedAccounts === 1 ? "" : "s"} — review what went wrong there before sizing up elsewhere.`
      : "";
  return `Your overall risk level today is ${riskLevel}. ${mainPriority}.${riskAmountPhrase}${breachNote}`;
}

// ── Per-account risk states (exported for EdgePilot's Account Command
// Center / Rule Monitor — same buildActiveAccountRefs/computeAccountRiskState
// helpers getAICoachRecommendation() already uses internally, no new math) ──

export function getAccountRiskStates(
  challenges: Challenge[],
  fundedAccounts: FundedAccount[],
  trades: Trade[],
  personalAccounts: PersonalAccount[] = []
): AccountRiskState[] {
  const today = todayDateString();
  return buildActiveAccountRefs(challenges, fundedAccounts, personalAccounts).map((account) =>
    computeAccountRiskState(account, trades, today)
  );
}

// ── Morning Briefing V1: per-account Mode + recommendation ───────────────
// Answers a per-account version of the same question getAICoachRecommendation
// answers globally: "what should I do on THIS account today?" — reusing
// every guardrail/behavioural rule above rather than inventing new math.
// Every threshold reused here (BUFFER_CRITICAL_RATIO, BUFFER_WARNING_RATIO,
// the 50-point loss-discipline cutoff) is the exact same constant the rest
// of this file already uses; the two new constants below are named and
// justified individually.

export type BriefingMode =
  | "aggressive_attack"
  | "growth"
  | "normal"
  | "protection"
  | "recovery"
  | "payout_protection"
  | "near_breach"
  | "no_trading";

// The daily objective the trader picks in the Morning Briefing (session-only,
// never persisted to Supabase) — a soft nudge on top of the guardrail/
// behaviour classification below, never able to override it.
export type TodaysObjective =
  | "pass_challenge"
  | "protect_funded"
  | "prepare_payout"
  | "build_consistency"
  | "focus_discipline"
  | "recover_losses";

export interface AccountBriefing {
  account: AccountRef;
  mode: BriefingMode;
  modeLabel: string;
  recommendedRisk: RecommendedRisk;
  maxTrades: number | null;
  stopAfterLosses: number | null;
  remainingTarget: number | null; // challenge only; null for funded accounts
  healthTier: "healthy" | "watch" | "critical";
  healthLabel: string;
}

const MODE_LABEL: Record<BriefingMode, string> = {
  aggressive_attack: "Aggressive Attack",
  growth: "Growth",
  normal: "Normal",
  protection: "Protection",
  recovery: "Recovery",
  payout_protection: "Payout Protection",
  near_breach: "Near Breach",
  no_trading: "No Trading",
};

// Guidance only — no "trades taken today"/"consecutive losses" counter is
// tracked anywhere in this schema, so these are deterministic recommendations
// keyed by Mode, not a derived precision figure. Rounder modes (more buffer,
// more behavioural headroom) get more trades and a longer losing streak
// before stopping; tighter modes get less of both.
const MODE_GUIDANCE: Record<BriefingMode, { maxTrades: number; stopAfterLosses: number }> = {
  aggressive_attack: { maxTrades: 5, stopAfterLosses: 3 },
  growth: { maxTrades: 4, stopAfterLosses: 2 },
  normal: { maxTrades: 3, stopAfterLosses: 2 },
  protection: { maxTrades: 2, stopAfterLosses: 1 },
  recovery: { maxTrades: 1, stopAfterLosses: 1 },
  payout_protection: { maxTrades: 2, stopAfterLosses: 1 },
  near_breach: { maxTrades: 1, stopAfterLosses: 1 },
  no_trading: { maxTrades: 0, stopAfterLosses: 0 },
};

// The worse (lower) of the daily/max buffer ratios — whichever guardrail is
// closer to breaching drives the Mode, same "worst alert wins" precedent
// getAICoachRecommendation() already uses for picking its primary account.
function worstBufferRatio(state: AccountRiskState): { ratio: number; buffer: number } {
  const candidates: { ratio: number; buffer: number }[] = [];
  if (state.dailyLimit !== null && state.dailyBuffer !== null && state.dailyLimit > 0) {
    candidates.push({ ratio: state.dailyBuffer / state.dailyLimit, buffer: state.dailyBuffer });
  }
  if (state.maxLimit !== null && state.maxBuffer !== null && state.maxLimit > 0) {
    candidates.push({ ratio: state.maxBuffer / state.maxLimit, buffer: state.maxBuffer });
  }
  if (candidates.length === 0) return { ratio: 1, buffer: state.maxBuffer ?? 0 };
  return candidates.reduce((a, b) => (b.ratio < a.ratio ? b : a));
}

// Same 50-point cutoff parseLossDisciplineScore's callers already treat as
// "below average" (buildRecommendedRisk, selectMainPriority) — reused, not
// redefined. The ceiling is a soft-nudge-only band: on its own it changes
// nothing, it only lets an explicit "focus_discipline" objective tip an
// already-marginal (50-64) score toward more caution.
const BORDERLINE_DISCIPLINE_FLOOR = 50;
const BORDERLINE_DISCIPLINE_CEILING = 65;

// Reuses the exact Math.ceil(remaining/expectancy) projection
// buildProfitTargetItem() already surfaces as prose — 5 "quality trades to
// close the gap" is treated as close enough to justify an attacking mode,
// matching this file's existing preference for round, auditable numbers
// (e.g. the $5 rounding in suggestedRiskFromBuffer) over invented precision.
const AGGRESSIVE_ATTACK_MAX_TRADES_NEEDED = 5;

function classifyBriefingMode(
  state: AccountRiskState,
  discipline: TraderDiscipline,
  isNearPayout: boolean,
  remainingTarget: number | null,
  reliableExpectancy: boolean,
  tradesNeeded: number | null,
  objective: TodaysObjective | undefined
): BriefingMode {
  const worst = worstBufferRatio(state);
  if (worst.ratio < BUFFER_CRITICAL_RATIO) {
    return worst.buffer <= 0 ? "no_trading" : "near_breach";
  }

  if (state.account.type === "funded" && isNearPayout) {
    return "payout_protection";
  }

  const score = parseLossDisciplineScore(discipline);
  const poorBehaviour = hasRevengeSignal(discipline) || (score !== null && score < BORDERLINE_DISCIPLINE_FLOOR);
  if (poorBehaviour) {
    return "recovery";
  }

  if (worst.ratio < BUFFER_WARNING_RATIO) {
    return "protection";
  }

  let mode: BriefingMode;
  if (state.account.type === "challenge" && remainingTarget !== null && remainingTarget > 0) {
    mode =
      reliableExpectancy && tradesNeeded !== null && tradesNeeded <= AGGRESSIVE_ATTACK_MAX_TRADES_NEEDED
        ? "aggressive_attack"
        : "growth";
  } else if (state.account.type === "personal") {
    // No challenge target to attack toward — Personal Accounts classify
    // purely off the trailing-week equity trend (capital protection vs
    // growth vs steady), never off payout/challenge concepts.
    const chg = state.recentEquityChangePercent;
    if (chg !== null && chg <= -PERSONAL_PROTECTION_THRESHOLD_PCT) {
      mode = "protection";
    } else if (chg !== null && chg >= 0) {
      mode = "growth";
    } else {
      mode = "normal";
    }
  } else {
    mode = "normal";
  }

  // Objective nudges — soft, only ever move a borderline case toward more
  // caution, never override the guardrail/behaviour checks above. The other
  // four objectives (pass_challenge, protect_funded, prepare_payout,
  // build_consistency) are informational-only in V1: they shape the
  // Briefing's copy, not this classification, a deliberately conservative
  // default.
  if (
    objective === "focus_discipline" &&
    mode === "normal" &&
    score !== null &&
    score >= BORDERLINE_DISCIPLINE_FLOOR &&
    score < BORDERLINE_DISCIPLINE_CEILING
  ) {
    mode = "protection";
  }
  if (
    objective === "recover_losses" &&
    (mode === "normal" || mode === "growth") &&
    discipline.revengeTradingScore.value === "Moderate"
  ) {
    mode = "protection";
  }

  return mode;
}

// Worst severity across every already-built alert/readiness item that
// belongs to this account (daily loss, max loss, profit target, consistency,
// payout readiness — exactly the categories the ticket names), collapsed
// from the engine's existing 4-tier CoachSeverity down to a 3-tier health
// badge. No new thresholds — same severityRank the rest of this file uses.
function computeAccountHealthTier(
  accountName: string,
  accountAlerts: CoachItem[],
  propRuleAlerts: CoachItem[],
  payoutReadiness: CoachItem[]
): { tier: "healthy" | "watch" | "critical"; label: string } {
  const items = [...accountAlerts, ...propRuleAlerts, ...payoutReadiness].filter((i) =>
    i.title.endsWith(`— ${accountName}`)
  );
  const worst = items.reduce<CoachSeverity>(
    (acc, i) => (severityRank(i.severity) > severityRank(acc) ? i.severity : acc),
    "positive"
  );
  if (worst === "critical") return { tier: "critical", label: "Critical" };
  if (worst === "warning") return { tier: "watch", label: "Watch" };
  return { tier: "healthy", label: "Healthy" };
}

export function getAccountBriefings(input: AICoachInput, objective?: TodaysObjective): AccountBriefing[] {
  const { trades, challenges, fundedAccounts, personalAccounts = [], payouts = [] } = input;
  const today = todayDateString();

  const riskStates = buildActiveAccountRefs(challenges, fundedAccounts, personalAccounts).map((account) =>
    computeAccountRiskState(account, trades, today)
  );

  // Rebuilds the same alert categories getAICoachRecommendation() builds
  // (guardrails, profit target, consistency, payout readiness) so Account
  // Health never drifts from what the rest of EdgePilot already shows for
  // the same account — no parallel severity logic.
  const accountAlerts: CoachItem[] = [];
  for (const state of riskStates) {
    const daily = buildDailyLossItem(state);
    if (daily) accountAlerts.push(daily);
    const maxLoss = buildMaxLossItem(state);
    if (maxLoss) accountAlerts.push(maxLoss);
  }

  const propRuleAlerts: CoachItem[] = [];
  for (const c of challenges.filter((c) => c.status === "active")) {
    const profitTargetItem = buildProfitTargetItem(c, trades);
    if (profitTargetItem) propRuleAlerts.push(profitTargetItem);

    const limitPercent = parseConsistencyLimitPercent(c.consistencyRule);
    const consistencyItem = buildConsistencyItem(
      `${c.propFirmName} — ${c.accountName}`,
      c.id,
      "challenge",
      trades,
      c.currentProfit,
      limitPercent,
      today
    );
    if (consistencyItem) propRuleAlerts.push(consistencyItem);
  }

  const payoutReadinessByAccountId = new Map<string, PayoutReadinessResult>();
  const payoutReadiness: CoachItem[] = [];
  for (const a of fundedAccounts.filter((a) => a.status === "active")) {
    const result = buildPayoutReadinessItems(a, challenges, trades, payouts, today);
    payoutReadinessByAccountId.set(a.id, result);
    payoutReadiness.push(...result.items);
  }

  return riskStates.map((state) => {
    const { account } = state;
    const accountTrades = trades.filter((t) => t.accountId === account.id && t.accountType === account.type);
    const discipline = getTraderDiscipline(accountTrades);

    const isNearPayout =
      account.type === "funded" ? (payoutReadinessByAccountId.get(account.id)?.isNear ?? false) : false;

    let remainingTarget: number | null = null;
    let reliableExpectancy = false;
    let tradesNeeded: number | null = null;
    if (account.type === "challenge") {
      const challenge = challenges.find((c) => c.id === account.id);
      if (challenge?.profitTarget && challenge.profitTarget > 0) {
        remainingTarget = challenge.profitTarget - challenge.currentProfit;
        if (remainingTarget > 0) {
          const expectancy = accountTrades.length > 0 ? mean(accountTrades.map((t) => t.pnl)) : 0;
          reliableExpectancy = accountTrades.length >= MIN_SAMPLE_FOR_EXPECTANCY && expectancy > 0;
          if (reliableExpectancy) tradesNeeded = Math.ceil(remainingTarget / expectancy);
        }
      }
    }

    const mode = classifyBriefingMode(
      state,
      discipline,
      isNearPayout,
      remainingTarget,
      reliableExpectancy,
      tradesNeeded,
      objective
    );
    const recommendedRisk = buildRecommendedRisk(state, discipline, isNearPayout);
    const guidance = MODE_GUIDANCE[mode];
    const health = computeAccountHealthTier(account.name, accountAlerts, propRuleAlerts, payoutReadiness);

    return {
      account,
      mode,
      modeLabel: MODE_LABEL[mode],
      recommendedRisk,
      maxTrades: guidance.maxTrades,
      stopAfterLosses: guidance.stopAfterLosses,
      remainingTarget,
      healthTier: health.tier,
      healthLabel: health.label,
    };
  });
}

// ── Entry point ────────────────────────────────────────────────────────────

export function getAICoachRecommendation(input: AICoachInput): AICoachOutput {
  const { trades, challenges, fundedAccounts, personalAccounts = [], payouts = [], dashboardKPIs, traderDiscipline, traderEdge } = input;
  const today = todayDateString();

  const activeAccounts = buildActiveAccountRefs(challenges, fundedAccounts, personalAccounts);
  const riskStates = activeAccounts.map((account) => computeAccountRiskState(account, trades, today));

  const accountAlerts: CoachItem[] = [];
  for (const state of riskStates) {
    const daily = buildDailyLossItem(state);
    if (daily) accountAlerts.push(daily);
    const maxLoss = buildMaxLossItem(state);
    if (maxLoss) accountAlerts.push(maxLoss);
  }

  const propRuleAlerts: CoachItem[] = [];
  for (const c of challenges.filter((c) => c.status === "active")) {
    const profitTargetItem = buildProfitTargetItem(c, trades);
    if (profitTargetItem) propRuleAlerts.push(profitTargetItem);

    const limitPercent = parseConsistencyLimitPercent(c.consistencyRule);
    const consistencyItem = buildConsistencyItem(
      `${c.propFirmName} — ${c.accountName}`,
      c.id,
      "challenge",
      trades,
      c.currentProfit,
      limitPercent,
      today
    );
    if (consistencyItem) propRuleAlerts.push(consistencyItem);
  }

  const payoutReadiness: CoachItem[] = [];
  let nearPayout = false;
  let nearPayoutAccountName: string | null = null;
  for (const a of fundedAccounts.filter((a) => a.status === "active")) {
    const { items, isNear } = buildPayoutReadinessItems(a, challenges, trades, payouts, today);
    payoutReadiness.push(...items);
    if (isNear && !nearPayout) {
      nearPayout = true;
      nearPayoutAccountName = `${a.propFirmName} — ${a.accountName}`;
    }
  }

  const behaviouralInsights = buildBehaviouralInsights(traderDiscipline, traderEdge);

  // The account driving the worst active guardrail also drives the
  // Recommended Risk figure — sizing advice should track whichever
  // account most urgently needs protection today, not an arbitrary one.
  const worstAlert = [...accountAlerts].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0];
  const primaryState =
    (worstAlert
      ? riskStates.find((s) => worstAlert.title.endsWith(`— ${s.account.name}`))
      : undefined) ?? riskStates[0] ?? null;

  const recommendedRisk = buildRecommendedRisk(primaryState, traderDiscipline, nearPayout);

  const { expectancy: recentExpectancy, sampleSize: recentSampleSize } = computeRecentExpectancy(trades);

  const { mainPriority, nextBestAction } = selectMainPriority(
    accountAlerts,
    propRuleAlerts,
    nearPayout,
    nearPayoutAccountName,
    recentExpectancy,
    recentSampleSize,
    traderDiscipline,
    traderEdge
  );

  const riskLevel = computeOverallRiskLevel([...accountAlerts, ...propRuleAlerts, ...behaviouralInsights]);
  const summary = buildSummary(riskLevel, mainPriority, recommendedRisk, dashboardKPIs);

  return {
    riskLevel,
    mainPriority,
    nextBestAction,
    accountAlerts,
    propRuleAlerts,
    behaviouralInsights,
    payoutReadiness,
    recommendedRisk,
    summary,
  };
}

// ── V2 seam ────────────────────────────────────────────────────────────────
// A future LLM-backed coach can call getAICoachRecommendation() first to
// get every guardrail number/severity already computed and verified above,
// then pass that structured object (not raw trades/account rows) as
// grounding context to an LLM purely for narrative rewriting — the model
// would never compute a buffer, expectancy, or consistency ratio itself,
// only rephrase numbers this file already derived. That keeps V2's output
// as auditable as V1's: any claim it makes must trace back to a field on
// this same AICoachOutput.
