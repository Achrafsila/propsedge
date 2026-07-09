"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { PersonalAccount, Trade } from "@/types";
import { useAuth } from "@/context/AuthContext";

// ============================================================
// PropEdge — Personal Accounts context
// ============================================================
// ⚠️ TEMPORARY STORAGE LAYER — localStorage only, by explicit product
// decision at the time this was built (no Supabase schema change in
// scope). This means Personal Accounts and Personal Trades:
//   - do NOT sync across devices/browsers for the same user
//   - are lost if the user clears site data
//   - are not first-class Supabase entities (no RLS, no server-side
//     queries, no joins with challenges/fundedAccounts at the DB level)
//
// TODO(migration): move personalAccounts/personalTrades to Supabase
// tables (e.g. `personal_accounts`, and widen `trades.account_type`'s
// CHECK constraint to include "personal") once schema changes are back
// in scope, so Personal Accounts become first-class entities on par with
// Challenge/FundedAccount. When that happens:
//   - This provider's shape (addPersonalAccount/addPersonalTrade/etc.)
//     should stay the same so AccountsContext's delegation below doesn't
//     need to change — only the internals swap from localStorage
//     read/write to Supabase fetch/insert/subscribe, mirroring how
//     AccountsContext already does it for challenges/fundedAccounts/trades.
//   - Add an orphan-prevention trigger for personal trades (see
//     supabase/migrations/007_prevent_orphan_trades.sql) to replace the
//     client-side cascade delete in deletePersonalAccount() below.
//   - Consider a one-time client-side migration on first login post-cutover
//     to read any existing localStorage data and upsert it server-side
//     instead of silently discarding it.
//
// Until then, mirrors PersonalPortfolioContext's exact "hydrate from
// localStorage on mount, persist on mutation" pattern, but scoped per-user
// (that context's own keys are unscoped, a known, accepted gap for a
// single cash-ledger; real trade history is worth the extra scoping,
// matching the precedent MorningBriefing already set with its own
// user-scoped storage key).
//
// Owns personalAccounts AND personalTrades together (not split across two
// contexts) because every trade mutation must recalculate its account's
// currentEquity — the same "recalc on every add/delete" invariant
// AccountsContext already enforces for challenge/funded accounts, just
// implemented here client-side instead of via a DB round-trip.
//
// AccountsContext (src/context/AccountsContext.tsx) consumes this context
// and merges personalTrades into its own exposed `trades`, and delegates
// addTrade/addTradesBatch/deleteTradesForAccount here whenever
// accountType === "personal" — every other page keeps calling the single
// useAccounts() hook and never needs to know two storage backends exist.

const emptyImportResult = () => ({ imported: [] as Trade[], failed: 0, errors: [] as never[] });

export interface PersonalTradeImportResult {
  imported: Trade[];
  failed: number;
  errors: never[];
}

interface PersonalAccountsContextType {
  personalAccounts: PersonalAccount[];
  personalTrades: Trade[];
  personalAccountsLoading: boolean;
  addPersonalAccount: (account: Omit<PersonalAccount, "id" | "currentEquity">) => PersonalAccount;
  updatePersonalAccount: (id: string, patch: Partial<PersonalAccount>) => void;
  deletePersonalAccount: (id: string) => void;
  addPersonalTrade: (trade: Omit<Trade, "id">) => Trade;
  addPersonalTradesBatch: (trades: Omit<Trade, "id">[]) => PersonalTradeImportResult;
  deletePersonalTrade: (id: string) => void;
  deleteTradesForPersonalAccount: (accountId: string) => void;
}

const PersonalAccountsContext = createContext<PersonalAccountsContextType | undefined>(undefined);

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `pa_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

// TODO(migration): these localStorage keys go away once personalAccounts
// moves to a Supabase `personal_accounts` table — replace with a
// user-scoped Supabase query (RLS on auth.uid()), same as challenges/
// fundedAccounts in AccountsContext.
function accountsKey(userId: string): string {
  return `pe_personal_accounts_${userId}`;
}

function tradesKey(userId: string): string {
  return `pe_personal_trades_${userId}`;
}

// currentEquity = initialCapital + sum(pnl of that account's own trades) —
// the same "account fields are the canonical source of truth, recomputed
// after every trade mutation" convention recalcAccount() already uses for
// challenge/funded accounts.
function recalcEquity(account: PersonalAccount, trades: Trade[]): PersonalAccount {
  const totalPnL = trades
    .filter((t) => t.accountId === account.id && t.accountType === "personal")
    .reduce((sum, t) => sum + t.pnl, 0);
  return { ...account, currentEquity: account.initialCapital + totalPnL };
}

export function PersonalAccountsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [personalAccounts, setPersonalAccounts] = useState<PersonalAccount[]>([]);
  const [personalTrades, setPersonalTrades] = useState<Trade[]>([]);
  const [personalAccountsLoading, setPersonalAccountsLoading] = useState(true);

  // TODO(migration): swap this hydration effect for a Supabase fetch (see
  // AccountsContext's challenges/fundedAccounts/trades effects) once this
  // entity moves off localStorage — the rest of this provider's public
  // API is designed to stay identical across that swap.
  //
  // Same "default first, hydrate from localStorage on mount" pattern as
  // every other context here — re-runs whenever the logged-in user changes
  // so switching accounts in the same browser never leaks data between users.
  useEffect(() => {
    if (!user) {
      setPersonalAccounts([]);
      setPersonalTrades([]);
      setPersonalAccountsLoading(false);
      return;
    }
    try {
      const storedAccounts = localStorage.getItem(accountsKey(user.id));
      setPersonalAccounts(storedAccounts ? JSON.parse(storedAccounts) : []);
    } catch {
      setPersonalAccounts([]);
    }
    try {
      const storedTrades = localStorage.getItem(tradesKey(user.id));
      setPersonalTrades(storedTrades ? JSON.parse(storedTrades) : []);
    } catch {
      setPersonalTrades([]);
    }
    setPersonalAccountsLoading(false);
  }, [user]);

  const persistAccounts = (next: PersonalAccount[]) => {
    setPersonalAccounts(next);
    if (user) localStorage.setItem(accountsKey(user.id), JSON.stringify(next));
  };

  const persistTrades = (next: Trade[]) => {
    setPersonalTrades(next);
    if (user) localStorage.setItem(tradesKey(user.id), JSON.stringify(next));
  };

  const addPersonalAccount = (account: Omit<PersonalAccount, "id" | "currentEquity">): PersonalAccount => {
    const next: PersonalAccount = { ...account, id: generateId(), currentEquity: account.initialCapital };
    persistAccounts([...personalAccounts, next]);
    return next;
  };

  const updatePersonalAccount = (id: string, patch: Partial<PersonalAccount>) => {
    persistAccounts(personalAccounts.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  // Cascades: also removes this account's trades — the client-side
  // equivalent of the orphan-prevention trigger challenge/funded accounts
  // get from the DB (see supabase/migrations/007_prevent_orphan_trades.sql).
  const deletePersonalAccount = (id: string) => {
    persistAccounts(personalAccounts.filter((a) => a.id !== id));
    persistTrades(personalTrades.filter((t) => t.accountId !== id));
  };

  const addPersonalTrade = (trade: Omit<Trade, "id">): Trade => {
    const saved: Trade = { ...trade, id: generateId() };
    const updatedTrades = [...personalTrades, saved];
    persistTrades(updatedTrades);
    const account = personalAccounts.find((a) => a.id === saved.accountId);
    if (account) persistAccounts(personalAccounts.map((a) => (a.id === account.id ? recalcEquity(a, updatedTrades) : a)));
    return saved;
  };

  const addPersonalTradesBatch = (trades: Omit<Trade, "id">[]): PersonalTradeImportResult => {
    if (trades.length === 0) return emptyImportResult();
    const saved: Trade[] = trades.map((t) => ({ ...t, id: generateId() }));
    const updatedTrades = [...personalTrades, ...saved];
    persistTrades(updatedTrades);
    const affectedAccountIds = new Set(saved.map((t) => t.accountId));
    persistAccounts(
      personalAccounts.map((a) => (affectedAccountIds.has(a.id) ? recalcEquity(a, updatedTrades) : a))
    );
    return { imported: saved, failed: 0, errors: [] };
  };

  const deletePersonalTrade = (id: string) => {
    const tradeToDelete = personalTrades.find((t) => t.id === id);
    if (!tradeToDelete) return;
    const updatedTrades = personalTrades.filter((t) => t.id !== id);
    persistTrades(updatedTrades);
    const account = personalAccounts.find((a) => a.id === tradeToDelete.accountId);
    if (account) persistAccounts(personalAccounts.map((a) => (a.id === account.id ? recalcEquity(a, updatedTrades) : a)));
  };

  const deleteTradesForPersonalAccount = (accountId: string) => {
    const updatedTrades = personalTrades.filter((t) => t.accountId !== accountId);
    persistTrades(updatedTrades);
    const account = personalAccounts.find((a) => a.id === accountId);
    if (account) persistAccounts(personalAccounts.map((a) => (a.id === accountId ? recalcEquity(a, updatedTrades) : a)));
  };

  return (
    <PersonalAccountsContext.Provider
      value={{
        personalAccounts,
        personalTrades,
        personalAccountsLoading,
        addPersonalAccount,
        updatePersonalAccount,
        deletePersonalAccount,
        addPersonalTrade,
        addPersonalTradesBatch,
        deletePersonalTrade,
        deleteTradesForPersonalAccount,
      }}
    >
      {children}
    </PersonalAccountsContext.Provider>
  );
}

export function usePersonalAccounts() {
  const context = useContext(PersonalAccountsContext);
  if (context === undefined) {
    throw new Error("usePersonalAccounts must be used within a PersonalAccountsProvider");
  }
  return context;
}
