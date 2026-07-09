import { Trade } from "@/types";
import { TradingMode } from "@/context/TradingModeContext";

// ============================================================
// PropEdge — Trading Mode trade isolation
// ============================================================
// Prop Firm and Personal Capital must never share a trade dataset. This is
// the single choke point every page should read `trades` through before
// doing anything with it: Prop Firm mode excludes personal trades,
// Personal Capital mode includes only personal trades.
//
// Personal Accounts now exist (see PersonalAccountsContext) — every
// personal trade self-identifies via accountType === "personal", which
// isPersonalCapitalTrade already checks unconditionally. The optional
// personalAccountIds set is kept as a secondary, explicit-id-based check
// for any caller that wants to scope to specific accounts rather than the
// whole personal trade set.

export interface TradingModeAccounts {
  personalAccountIds?: Iterable<string>;
}

function isPersonalCapitalTrade(trade: Trade, personalAccountIds?: Set<string>): boolean {
  if (trade.accountType === "personal") return true;
  if (personalAccountIds?.has(trade.accountId)) return true;
  return false;
}

export function getTradesForTradingMode(
  trades: Trade[],
  tradingMode: TradingMode,
  accounts?: TradingModeAccounts
): Trade[] {
  const personalAccountIds = accounts?.personalAccountIds ? new Set(accounts.personalAccountIds) : undefined;
  if (tradingMode === "prop-firm") {
    return trades.filter((trade) => !isPersonalCapitalTrade(trade, personalAccountIds));
  }
  return trades.filter((trade) => isPersonalCapitalTrade(trade, personalAccountIds));
}
