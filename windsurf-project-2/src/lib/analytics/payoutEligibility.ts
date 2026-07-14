import { Challenge, FundedAccount, Trade, Payout, MinimumDailyProfitType } from "@/types";

// The single source of truth for "is this funded account payout-eligible,
// and against which rules" — every consumer (AI Coach, Dashboard, Risk
// Center, Funded page, Portfolio analytics) calls evaluatePayoutEligibility
// instead of re-deriving these facts itself. Returns structured data, not
// prose — callers own their own tone/formatting (see aiCoach.ts's
// buildPayoutReadinessItems for an example of formatting these into
// user-facing coaching copy).
//
// Rule resolution order: a FundedAccount's own native `payoutRules` always
// wins when `.required` is true. Otherwise, for accounts that came from a
// passed evaluation (fundingPath === "evaluation", sourceChallengeId set),
// this falls back to the legacy rule fields that have always lived on the
// source Challenge row (minTradingDays, minPayout, consistencyRule as free
// text) — preserving existing behavior for every pre-existing converted
// account without requiring a data migration. An account with neither a
// native rule nor a traceable source Challenge just has no applicable check
// for that rule (skipped, not "not satisfied").

export type PayoutRuleStatus = "satisfied" | "not_satisfied";

export interface ConsistencyCheck {
  key: "consistency";
  status: PayoutRuleStatus;
  limitPercent: number;
  bestDayDate: string;
  bestDayAmount: number;
  bestDayConcentrationPercent: number;
}

export interface MinimumTradingDaysCheck {
  key: "minimumTradingDays";
  status: PayoutRuleStatus;
  requiredDays: number;
  qualifyingDays: number;
}

export interface MinimumPayoutCheck {
  key: "minimumPayout";
  status: PayoutRuleStatus;
  requiredMinPayout: number;
  availableProfit: number;
}

export type PayoutRuleCheck = ConsistencyCheck | MinimumTradingDaysCheck | MinimumPayoutCheck;

export interface PayoutEligibilityResult {
  checks: PayoutRuleCheck[];
  // True when every *applicable* check is satisfied — an account with zero
  // applicable checks (no rules at all, e.g. a plain Instant Funded account
  // with both toggles off) is eligible by definition.
  isEligible: boolean;
  availableProfit: number;
}

// consistencyRule is free text on Challenge (e.g. "40%", "evaluation 50%,
// funded 30%") — the first percentage found is treated as the max share of
// total profit a single day is allowed to represent.
export function parseConsistencyLimitPercent(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.match(/(\d{1,3})\s*%/);
  return match ? Number(match[1]) : null;
}

function countQualifyingDays(
  dailyPnl: Map<string, number>,
  qualifyingDailyProfit: { type: MinimumDailyProfitType; value: number } | undefined,
  initialBalance: number
): number {
  if (!qualifyingDailyProfit) {
    // Legacy behavior (no native threshold set): any profitable day counts.
    return [...dailyPnl.values()].filter((v) => v > 0).length;
  }
  const threshold =
    qualifyingDailyProfit.type === "fixed"
      ? qualifyingDailyProfit.value
      : (qualifyingDailyProfit.value / 100) * initialBalance;
  return [...dailyPnl.values()].filter((v) => v >= threshold).length;
}

export function evaluatePayoutEligibility(
  account: FundedAccount,
  trades: Trade[],
  challenges: Challenge[],
  payouts: Payout[]
): PayoutEligibilityResult {
  const sourceChallenge = account.sourceChallengeId
    ? challenges.find((c) => c.id === account.sourceChallengeId)
    : undefined;

  const accountTrades = trades.filter((t) => t.accountId === account.id && t.accountType === "funded");
  const dailyPnl = new Map<string, number>();
  for (const t of accountTrades) dailyPnl.set(t.entryDate, (dailyPnl.get(t.entryDate) ?? 0) + t.pnl);

  const checks: PayoutRuleCheck[] = [];

  // ── Consistency ──────────────────────────────────────────────────────
  const nativeConsistency = account.payoutRules.consistency;
  const limitPercent = nativeConsistency.required
    ? nativeConsistency.limitPercent ?? null
    : parseConsistencyLimitPercent(sourceChallenge?.consistencyRule ?? null);

  if (limitPercent != null && account.currentProfit > 0) {
    let bestDate: string | null = null;
    let bestAmount = 0;
    for (const [date, amount] of dailyPnl) {
      if (amount > bestAmount) {
        bestAmount = amount;
        bestDate = date;
      }
    }
    if (bestDate !== null && bestAmount > 0) {
      const concentrationPercent = Math.round((bestAmount / account.currentProfit) * 100);
      checks.push({
        key: "consistency",
        status: concentrationPercent >= limitPercent ? "not_satisfied" : "satisfied",
        limitPercent,
        bestDayDate: bestDate,
        bestDayAmount: bestAmount,
        bestDayConcentrationPercent: concentrationPercent,
      });
    }
  }

  // ── Minimum trading days ─────────────────────────────────────────────
  const nativeMinDays = account.payoutRules.minimumTradingDays;
  const requiredDays = nativeMinDays.required ? nativeMinDays.days ?? null : sourceChallenge?.minTradingDays ?? null;

  if (requiredDays != null) {
    const qualifyingDays = countQualifyingDays(
      dailyPnl,
      nativeMinDays.required ? nativeMinDays.qualifyingDailyProfit : undefined,
      account.initialBalance
    );
    checks.push({
      key: "minimumTradingDays",
      status: qualifyingDays >= requiredDays ? "satisfied" : "not_satisfied",
      requiredDays,
      qualifyingDays,
    });
  }

  // ── Minimum payout threshold ─────────────────────────────────────────
  // No native FundedAccount field for this yet — always resolved from a
  // linked evaluation Challenge, same as before this refactor.
  const alreadyClaimed = payouts
    .filter((p) => p.fundedAccountId === account.id && (p.status === "paid" || p.status === "pending"))
    .reduce((sum, p) => sum + (p.status === "paid" ? p.receivedPayoutAmount : p.requestedPayoutAmount), 0);
  const availableProfit = Math.max(0, account.currentProfit - alreadyClaimed);

  const requiredMinPayout = sourceChallenge?.minPayout ?? null;
  if (requiredMinPayout != null) {
    checks.push({
      key: "minimumPayout",
      status: availableProfit >= requiredMinPayout ? "satisfied" : "not_satisfied",
      requiredMinPayout,
      availableProfit,
    });
  }

  return {
    checks,
    isEligible: checks.every((c) => c.status === "satisfied"),
    availableProfit,
  };
}
