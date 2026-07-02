import { Challenge, FundedAccount, Trade } from "@/types";

// ============================================================
// PropEdge — Global Trade Analytics engine (Operational View)
// ============================================================
// Pure, stateless helpers over a Trade[] list. This is the single source
// of truth for cross-account trading performance: every trade is counted
// individually here, unlike the Business Metrics engine (src/lib/challenges.ts)
// which collapses a 2-step challenge's Step 1 + Step 2 rows into one root
// for funding-rate/capital reporting. Global Analytics never does that
// collapsing — Step 1 and Step 2 are two accounts with their own trades,
// and both fully count.
//
// Every helper takes an already-filtered Trade[] (see filterGlobalTrades)
// so the same functions can later feed an AI Coach comparing arbitrary
// slices of the same trade set (challenge vs funded, session vs session,
// account vs account, etc.) without re-implementing filtering logic.

export type AnalysisScope = "all" | "challenge" | "funded";
export type SessionKey = "London" | "New York" | "Asian" | "No Session";

export interface GlobalFilters {
  scope: AnalysisScope;
  dateFrom: string; // "YYYY-MM-DD", "" = unbounded
  dateTo: string; // "YYYY-MM-DD", "" = unbounded
  propFirm: string; // "" = all
  accountId: string; // "" = all
  instrument: string; // "" = all
  session: string; // "" = all, otherwise a SessionKey
}

export const DEFAULT_GLOBAL_FILTERS: GlobalFilters = {
  scope: "all",
  dateFrom: "",
  dateTo: "",
  propFirm: "",
  accountId: "",
  instrument: "",
  session: "",
};

// ── Account index ────────────────────────────────────────────────────────
// Maps a trade's (accountType, accountId) to display/grouping metadata.
// Built once per render from the live challenges/fundedAccounts lists so
// account and prop-firm names always match what's on screen elsewhere.

export interface AccountIndexEntry {
  accountId: string;
  accountType: "challenge" | "funded";
  accountName: string;
  propFirmName: string;
}

export type AccountIndex = Map<string, AccountIndexEntry>;

function accountKey(accountType: "challenge" | "funded", accountId: string): string {
  return `${accountType}:${accountId}`;
}

export function buildAccountIndex(
  challenges: Challenge[],
  fundedAccounts: FundedAccount[]
): AccountIndex {
  const index: AccountIndex = new Map();
  for (const c of challenges) {
    index.set(accountKey("challenge", c.id), {
      accountId: c.id,
      accountType: "challenge",
      accountName: c.accountName,
      propFirmName: c.propFirmName,
    });
  }
  for (const a of fundedAccounts) {
    index.set(accountKey("funded", a.id), {
      accountId: a.id,
      accountType: "funded",
      accountName: a.accountName,
      propFirmName: a.propFirmName,
    });
  }
  return index;
}

export function lookupAccount(index: AccountIndex, trade: Trade): AccountIndexEntry | undefined {
  if (!trade.accountId || !trade.accountType) return undefined;
  return index.get(accountKey(trade.accountType, trade.accountId));
}

// A trade whose accountId/accountType no longer resolves to a live challenge
// or funded account — typically because that account was deleted after the
// trade was recorded. These still happened and still count toward overall
// P&L, but they must never be grouped into a fake "Unknown Account" bucket.
export function isTraceableTrade(trade: Trade, index: AccountIndex): boolean {
  return !!lookupAccount(index, trade);
}

export function getOrphanedTrades(trades: Trade[], index: AccountIndex): Trade[] {
  return trades.filter((t) => !isTraceableTrade(t, index));
}

export function getSessionKey(trade: Trade): SessionKey {
  return (trade.session as SessionKey) ?? "No Session";
}

function hasValidPnL(trade: Trade): boolean {
  return typeof trade.pnl === "number" && isFinite(trade.pnl);
}

// ── Filtering ─────────────────────────────────────────────────────────────
// Every trade is evaluated independently — no root/child collapsing. Trades
// with no date or a non-finite P&L are dropped outright (malformed rows);
// trades whose account was later deleted (see isTraceableTrade) are kept
// here — they still count toward overall stats/equity/calendar — and are
// only excluded from the per-account/per-firm breakdowns further below.

export function filterGlobalTrades(
  trades: Trade[],
  filters: GlobalFilters,
  index: AccountIndex
): Trade[] {
  return trades.filter((t) => {
    if (!t.entryDate || !hasValidPnL(t)) return false;
    if (filters.scope !== "all" && t.accountType !== filters.scope) return false;
    if (filters.accountId && t.accountId !== filters.accountId) return false;
    if (filters.dateFrom && t.entryDate < filters.dateFrom) return false;
    if (filters.dateTo && t.entryDate > filters.dateTo) return false;
    if (filters.instrument && t.symbol !== filters.instrument) return false;
    if (filters.session && getSessionKey(t) !== filters.session) return false;
    if (filters.propFirm) {
      const entry = lookupAccount(index, t);
      if (!entry || entry.propFirmName !== filters.propFirm) return false;
    }
    return true;
  });
}

// ── 1. globalTradeStats ────────────────────────────────────────────────────

export interface StreakInfo {
  type: "win" | "loss" | "none";
  count: number;
}

export interface GlobalTradeStats {
  totalTrades: number;
  netPnL: number;
  winRate: number; // 0–100
  profitFactor: number;
  wins: number;
  losses: number;
  breakeven: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
  avgDailyPnL: number;
  tradingDays: number;
  longestWinStreak: number;
  longestLossStreak: number;
  currentStreak: StreakInfo;
}

function sortChronologically(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => {
    const dateCompare = a.entryDate.localeCompare(b.entryDate);
    if (dateCompare !== 0) return dateCompare;
    return (a.entryTime ?? "").localeCompare(b.entryTime ?? "");
  });
}

export function globalTradeStats(trades: Trade[]): GlobalTradeStats {
  const sorted = sortChronologically(trades);
  const totalTrades = sorted.length;
  const netPnL = sorted.reduce((sum, t) => sum + t.pnl, 0);

  const winningTrades = sorted.filter((t) => t.pnl > 0);
  const losingTrades = sorted.filter((t) => t.pnl < 0);
  const breakevenTrades = sorted.filter((t) => t.pnl === 0);

  const grossProfit = winningTrades.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = losingTrades.reduce((s, t) => s + t.pnl, 0);

  const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;
  const profitFactor = grossLoss !== 0 ? Math.abs(grossProfit / grossLoss) : 0;
  const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;
  const bestTrade = sorted.length > 0 ? Math.max(...sorted.map((t) => t.pnl)) : 0;
  const worstTrade = sorted.length > 0 ? Math.min(...sorted.map((t) => t.pnl)) : 0;

  const byDay = calendarData(sorted);
  const tradingDays = Object.keys(byDay).length;
  const avgDailyPnL = tradingDays > 0 ? netPnL / tradingDays : 0;

  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let runType: "win" | "loss" | "none" = "none";
  let runCount = 0;
  for (const t of sorted) {
    const type: "win" | "loss" | "none" = t.pnl > 0 ? "win" : t.pnl < 0 ? "loss" : "none";
    if (type === runType && type !== "none") {
      runCount += 1;
    } else {
      runType = type;
      runCount = type === "none" ? 0 : 1;
    }
    if (runType === "win") longestWinStreak = Math.max(longestWinStreak, runCount);
    if (runType === "loss") longestLossStreak = Math.max(longestLossStreak, runCount);
  }

  const currentStreak: StreakInfo = { type: "none", count: 0 };
  for (let i = sorted.length - 1; i >= 0; i--) {
    const t = sorted[i];
    const type: "win" | "loss" | "none" = t.pnl > 0 ? "win" : t.pnl < 0 ? "loss" : "none";
    if (i === sorted.length - 1) {
      currentStreak.type = type;
      currentStreak.count = type === "none" ? 0 : 1;
      if (type === "none") break;
    } else if (type === currentStreak.type) {
      currentStreak.count += 1;
    } else {
      break;
    }
  }

  return {
    totalTrades,
    netPnL,
    winRate,
    profitFactor,
    wins: winningTrades.length,
    losses: losingTrades.length,
    breakeven: breakevenTrades.length,
    avgWin,
    avgLoss,
    bestTrade,
    worstTrade,
    avgDailyPnL,
    tradingDays,
    longestWinStreak,
    longestLossStreak,
    currentStreak,
  };
}

// ── 2. globalEquityCurve ───────────────────────────────────────────────────
// Cumulative P&L, one point per trade (not per day) — starts at zero.

export interface EquityPoint {
  index: number;
  tradeId: string;
  date: string;
  pnl: number;
  cumulative: number;
}

export function globalEquityCurve(trades: Trade[]): EquityPoint[] {
  const sorted = sortChronologically(trades);
  let running = 0;
  const points: EquityPoint[] = [{ index: 0, tradeId: "start", date: "Start", pnl: 0, cumulative: 0 }];
  sorted.forEach((t, i) => {
    running += t.pnl;
    points.push({ index: i + 1, tradeId: t.id, date: t.entryDate, pnl: t.pnl, cumulative: running });
  });
  return points;
}

// ── 3. calendarData ────────────────────────────────────────────────────────

export interface CalendarDayData {
  pnl: number;
  trades: number;
}

export function calendarData(trades: Trade[]): Record<string, CalendarDayData> {
  return trades.reduce((acc: Record<string, CalendarDayData>, t) => {
    const key = t.entryDate;
    if (!key) return acc;
    if (!acc[key]) acc[key] = { pnl: 0, trades: 0 };
    acc[key].pnl += t.pnl;
    acc[key].trades += 1;
    return acc;
  }, {});
}

// ── 4–7. Performance breakdowns ─────────────────────────────────────────────
// All sorted descending by net P&L, each entry keyed for click-to-filter.

export interface BreakdownEntry {
  key: string;
  label: string;
  pnl: number;
  trades: number;
  winRate: number;
}

function summarizeGroup(key: string, label: string, groupTrades: Trade[]): BreakdownEntry {
  const pnl = groupTrades.reduce((s, t) => s + t.pnl, 0);
  const wins = groupTrades.filter((t) => t.pnl > 0).length;
  return {
    key,
    label,
    pnl,
    trades: groupTrades.length,
    winRate: groupTrades.length > 0 ? (wins / groupTrades.length) * 100 : 0,
  };
}

function groupBy<K>(trades: Trade[], keyFn: (t: Trade) => K): Map<K, Trade[]> {
  const map = new Map<K, Trade[]>();
  for (const t of trades) {
    const k = keyFn(t);
    const bucket = map.get(k);
    if (bucket) bucket.push(t);
    else map.set(k, [t]);
  }
  return map;
}

export function performanceByAccount(trades: Trade[], index: AccountIndex): BreakdownEntry[] {
  // Trades whose account no longer exists are excluded here (see the
  // "missing accounts" warning card instead of a fake "Unknown Account" bar).
  // Grouped internally by the composite (type, id) key so a challenge and a
  // funded account can never collide, but the entry's own `key` is the raw
  // accountId — that's what GlobalFilters.accountId expects, so clicking a
  // bar can set the filter directly without re-deriving accountType.
  const traceable = trades.filter((t) => isTraceableTrade(t, index));
  const groups = groupBy(traceable, (t) => accountKey(t.accountType, t.accountId));
  const entries = Array.from(groups.entries()).map(([mapKey, groupTrades]) => {
    const entry = index.get(mapKey);
    return summarizeGroup(entry?.accountId ?? mapKey, entry?.accountName ?? mapKey, groupTrades);
  });
  return entries.sort((a, b) => b.pnl - a.pnl);
}

export function performanceByPropFirm(trades: Trade[], index: AccountIndex): BreakdownEntry[] {
  // Same reasoning as performanceByAccount — a trade with no resolvable
  // account has no prop firm either, so it's excluded rather than bucketed
  // under a fake "Unknown Firm" category.
  const traceable = trades.filter((t) => isTraceableTrade(t, index));
  const groups = groupBy(traceable, (t) => lookupAccount(index, t)!.propFirmName);
  const entries = Array.from(groups.entries()).map(([key, groupTrades]) =>
    summarizeGroup(key, key, groupTrades)
  );
  return entries.sort((a, b) => b.pnl - a.pnl);
}

export function performanceByInstrument(trades: Trade[]): BreakdownEntry[] {
  const groups = groupBy(trades, (t) => t.symbol || "Unknown");
  const entries = Array.from(groups.entries()).map(([key, groupTrades]) =>
    summarizeGroup(key, key, groupTrades)
  );
  return entries.sort((a, b) => b.pnl - a.pnl);
}

export function performanceBySession(trades: Trade[]): BreakdownEntry[] {
  const groups = groupBy(trades, (t) => getSessionKey(t));
  const entries = Array.from(groups.entries()).map(([key, groupTrades]) =>
    summarizeGroup(key, key, groupTrades)
  );
  return entries.sort((a, b) => b.pnl - a.pnl);
}

// ── 8. tradeDistribution ────────────────────────────────────────────────────

export interface WinLossSlice {
  name: string;
  value: number;
  color: string;
}

export interface SessionCount {
  session: string;
  count: number;
}

export interface TradeDistributionResult {
  winLoss: WinLossSlice[];
  bySession: SessionCount[];
}

export function tradeDistribution(trades: Trade[]): TradeDistributionResult {
  const wins = trades.filter((t) => t.pnl > 0).length;
  const losses = trades.filter((t) => t.pnl < 0).length;
  const breakeven = trades.filter((t) => t.pnl === 0).length;

  const winLoss: WinLossSlice[] = [
    { name: "Wins", value: wins, color: "#10B981" },
    { name: "Losses", value: losses, color: "#EF4444" },
    { name: "Breakeven", value: breakeven, color: "#94A3B8" },
  ].filter((slice) => slice.value > 0);

  const sessionGroups = groupBy(trades, (t) => getSessionKey(t));
  const bySession: SessionCount[] = Array.from(sessionGroups.entries())
    .map(([session, groupTrades]) => ({ session, count: groupTrades.length }))
    .sort((a, b) => b.count - a.count);

  return { winLoss, bySession };
}
