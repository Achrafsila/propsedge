import { PersonalAccount, Trade } from "@/types";
import { GlobalTradeStats, globalTradeStats } from "./globalAnalytics";
import { computeDrawdown, DrawdownBreakdown } from "@/lib/drawdown";

// ============================================================
// PropEdge — Personal Account Stats (Portfolio overview)
// ============================================================
// A Personal Account has NO mandatory prop firm rules — drawdown and risk
// usage are only ever computed when the user has actually configured the
// corresponding optional limit; otherwise they're null so the UI can render
// "N/A" instead of a fabricated number.

export interface PersonalAccountRiskUsage {
  riskPerTradePercent: number | null;
  dailyLossLimitPercent: number | null;
  maxDrawdownLimitPercent: number | null;
}

export interface PersonalAccountStats {
  initialCapital: number;
  currentEquity: number;
  netPnL: number;
  roiPercent: number;
  tradeStats: GlobalTradeStats;
  // null when the user never set a maxDrawdownLimit for this account.
  drawdown: DrawdownBreakdown | null;
  // null when none of the three optional risk rules is configured.
  riskUsage: PersonalAccountRiskUsage | null;
}

export function computePersonalAccountStats(account: PersonalAccount, trades: Trade[]): PersonalAccountStats {
  const accountTrades = trades.filter((t) => t.accountId === account.id && t.accountType === "personal");
  const tradeStats = globalTradeStats(accountTrades);

  const netPnL = account.currentEquity - account.initialCapital;
  const roiPercent = account.initialCapital > 0 ? (netPnL / account.initialCapital) * 100 : 0;

  const drawdown =
    account.maxDrawdownLimit != null
      ? computeDrawdown(account.maxDrawdownLimit, account.initialCapital, netPnL)
      : null;

  const hasAnyRiskRule =
    account.dailyLossLimit != null || account.maxDrawdownLimit != null || account.riskPerTradePercent != null;
  const riskUsage: PersonalAccountRiskUsage | null = hasAnyRiskRule
    ? {
        riskPerTradePercent: account.riskPerTradePercent ?? null,
        dailyLossLimitPercent: account.dailyLossLimit ?? null,
        maxDrawdownLimitPercent: account.maxDrawdownLimit ?? null,
      }
    : null;

  return {
    initialCapital: account.initialCapital,
    currentEquity: account.currentEquity,
    netPnL,
    roiPercent,
    tradeStats,
    drawdown,
    riskUsage,
  };
}
