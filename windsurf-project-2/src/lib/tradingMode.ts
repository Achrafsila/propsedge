import { Trade } from "@/types";
import { TradingMode } from "@/context/TradingModeContext";

// ============================================================
// PropEdge — Trading Mode trade isolation
// ============================================================
// Prop Firm and Personal Capital must never share a trade dataset. This is
// the single choke point every page should read `trades` through before
// doing anything with it: Prop Firm mode is a no-op pass (today's exact
// trade list, unchanged), Personal Capital mode filters down to trades
// that are actually personal.
//
// V1 reality: there is no personal trading-account model yet — Trade's
// accountType is still only "challenge" | "funded", and AccountsContext
// has no personal-accounts list. So today, Personal Capital's trade set is
// always empty, not because trades are hidden, but because none exist that
// qualify. The (accountType as string) === "personal" check and the
// optional personalAccountIds set below exist so that the moment personal
// accounts ship, this function starts including their trades automatically
// — no caller of getTradesForTradingMode needs to change.

export interface TradingModeAccounts {
  // IDs of accounts known to belong to Personal Capital. Always
  // undefined/empty today — no personal account list exists yet anywhere
  // in AccountsContext. Forward-compat hook for a future block.
  personalAccountIds?: Iterable<string>;
}

function isPersonalCapitalTrade(trade: Trade, personalAccountIds?: Set<string>): boolean {
  if ((trade.accountType as string) === "personal") return true;
  if (personalAccountIds?.has(trade.accountId)) return true;
  return false;
}

export function getTradesForTradingMode(
  trades: Trade[],
  tradingMode: TradingMode,
  accounts?: TradingModeAccounts
): Trade[] {
  if (tradingMode === "prop-firm") return trades;

  const personalAccountIds = accounts?.personalAccountIds ? new Set(accounts.personalAccountIds) : undefined;
  return trades.filter((trade) => isPersonalCapitalTrade(trade, personalAccountIds));
}
