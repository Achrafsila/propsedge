"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { toast } from "sonner";
import {
  Challenge,
  FundedAccount,
  Payout,
  Trade,
  PersonalAccount,
  FundingRateStats,
  ROIStats,
  DashboardKPIs,
  ChallengeStatus,
  FundedAccountStatus,
  PayoutStatus,
} from "@/types";
import { useAuth } from "@/context/AuthContext";
import { usePersonalAccounts } from "@/context/PersonalAccountsContext";
import { getRootChallenges, getEffectiveStatus, getEffectiveConvertedToFunded, getEffectiveStartDate, getEffectiveFundedDate } from "@/lib/challenges";
import {
  fetchChallenges,
  insertChallenge,
  updateChallengeDb,
  deleteChallengeDb,
} from "@/lib/supabase/challenges";
import {
  fetchFundedAccounts,
  insertFundedAccount,
  updateFundedAccountDb,
  deleteFundedAccountDb,
} from "@/lib/supabase/funded_accounts";
import {
  fetchTrades,
  insertTrade,
  insertTradesBatch,
  deleteTradeDb,
  deleteTradesByAccountDb,
  deleteTradesByIdsDb,
} from "@/lib/supabase/trades";
import {
  fetchPayouts,
  insertPayout,
  updatePayoutDb,
  deletePayoutDb,
} from "@/lib/supabase/payouts";

// One failed chunk from a bulk import — enough detail to tell a user (or
// the console) exactly which rows didn't make it in and why.
export interface TradeImportBatchError {
  batchIndex: number;
  rowRange: string; // e.g. "251-500", 1-based to match spreadsheet row numbering conventions used elsewhere in the importer
  message: string;
}

export interface TradeImportResult {
  imported: Trade[];
  failed: number;
  errors: TradeImportBatchError[];
}

interface AccountsContextType {
  challenges: Challenge[];
  challengesLoading: boolean;
  fundedAccounts: FundedAccount[];
  fundedAccountsLoading: boolean;
  payouts: Payout[];
  payoutsLoading: boolean;
  trades: Trade[];
  tradesLoading: boolean;
  personalAccounts: PersonalAccount[];
  personalAccountsLoading: boolean;
  addChallenge: (challenge: Omit<Challenge, "id">) => void;
  updateChallenge: (id: string, challenge: Partial<Challenge>) => void;
  deleteChallenge: (id: string) => void;
  addFundedAccount: (account: Omit<FundedAccount, "id">) => void;
  updateFundedAccount: (id: string, account: Partial<FundedAccount>) => void;
  deleteFundedAccount: (id: string) => void;
  addPersonalAccount: (account: Omit<PersonalAccount, "id" | "currentEquity">) => PersonalAccount;
  updatePersonalAccount: (id: string, account: Partial<PersonalAccount>) => void;
  deletePersonalAccount: (id: string) => void;
  addPayout: (payout: Omit<Payout, "id">) => void;
  updatePayout: (id: string, payout: Partial<Payout>) => void;
  deletePayout: (id: string) => void;
  addTrade: (trade: Omit<Trade, "id">) => Promise<Trade | null>;
  addTradesBatch: (trades: Omit<Trade, "id">[]) => Promise<TradeImportResult>;
  deleteTrade: (id: string) => void;
  deleteTradesForAccount: (accountId: string, accountType: "challenge" | "funded" | "personal") => Promise<void>;
  getAccountPnL: (accountId: string, accountType: "challenge" | "funded" | "personal") => number;
  convertChallengeToFunded: (challengeId: string, fundedAccount: Omit<FundedAccount, "id">) => void;
  getFundingRateStats: () => FundingRateStats;
  getROIStats: () => ROIStats;
  getDashboardKPIs: () => DashboardKPIs;
}

const AccountsContext = createContext<AccountsContextType | undefined>(undefined);

export function AccountsProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  // TODO(migration): PersonalAccountsContext is a temporary localStorage-only
  // storage layer (see its file header) — personalAccounts/personalTrades
  // don't sync across devices and aren't queryable server-side yet. Once
  // that context moves to Supabase, everything below this line (the merged
  // `trades`, the addTrade/addTradesBatch/deleteTradesForAccount delegation
  // by accountType) should need no changes — only usePersonalAccounts()'s
  // internals change.
  const {
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
  } = usePersonalAccounts();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [challengesLoading, setChallengesLoading] = useState(true);
  const [fundedAccounts, setFundedAccounts] = useState<FundedAccount[]>([]);
  const [fundedAccountsLoading, setFundedAccountsLoading] = useState(true);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(true);
  // Supabase-backed trades only (challenge/funded) — the context's exposed
  // `trades` below is this merged with personalTrades (localStorage-backed,
  // see PersonalAccountsContext), so every existing consumer of
  // useAccounts().trades transparently sees personal trades too without
  // any changes on their end.
  const [dbTrades, setDbTrades] = useState<Trade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(true);
  const trades = useMemo(() => [...dbTrades, ...personalTrades], [dbTrades, personalTrades]);

  // ── Load challenges from Supabase whenever the authenticated user changes ──
  // authLoading: stay in loading state until Supabase session is resolved so we
  // don't flash the empty state before the user object arrives.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setChallenges([]);
      setChallengesLoading(false);
      return;
    }
    setChallengesLoading(true);
    fetchChallenges(user.id)
      .then(setChallenges)
      .catch((err) => {
        console.error("Failed to load challenges:", err);
        toast.error(`Load challenges: ${err?.message ?? String(err)}`);
      })
      .finally(() => setChallengesLoading(false));
  }, [user?.id, authLoading]);

  // ── Load funded accounts from Supabase when user changes ──────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setFundedAccounts([]);
      setFundedAccountsLoading(false);
      return;
    }
    setFundedAccountsLoading(true);
    fetchFundedAccounts(user.id)
      .then(setFundedAccounts)
      .catch((err) => {
        console.error("Failed to load funded accounts:", err);
        toast.error(`Load funded accounts: ${err?.message ?? String(err)}`);
      })
      .finally(() => setFundedAccountsLoading(false));
  }, [user?.id, authLoading]);

  // ── Load trades from Supabase when user changes ───────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setDbTrades([]);
      setTradesLoading(false);
      return;
    }
    setTradesLoading(true);
    fetchTrades(user.id)
      .then(setDbTrades)
      .catch((err) => {
        console.error("Failed to load trades:", err);
        toast.error(`Load trades: ${err?.message ?? String(err)}`);
      })
      .finally(() => setTradesLoading(false));
  }, [user?.id, authLoading]);

  // ── Load payouts from Supabase when user changes ──────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setPayouts([]);
      setPayoutsLoading(false);
      return;
    }
    setPayoutsLoading(true);
    fetchPayouts(user.id)
      .then(setPayouts)
      .catch((err) => {
        console.error("Failed to load payouts:", err);
        toast.error(`Load payouts: ${err?.message ?? String(err)}`);
      })
      .finally(() => setPayoutsLoading(false));
  }, [user?.id, authLoading]);

  // ── Orphan trade safety ──────────────────────────────────────────────────
  // Never auto-delete trades merely because their account is absent from
  // this user's loaded account list. In the future, Team Workspace will load
  // shared accounts separately; a temporary fetch failure or revoked share
  // must never trigger destructive cleanup. Reconciliation is a separate,
  // explicit, owner-confirmed operation with an audit trail.

  // ── Challenge CRUD (Supabase-backed) ──────────────────────────────────────

  const addChallenge = (challenge: Omit<Challenge, "id">) => {
    if (!user) return;
    const tempId = `temp-${Date.now()}`;
    setChallenges((prev) => [{ id: tempId, ...challenge }, ...prev]);
    insertChallenge(user.id, challenge)
      .then((saved) => {
        setChallenges((prev) => prev.map((c) => (c.id === tempId ? saved : c)));
        toast.success("Challenge saved");
      })
      .catch((err) => {
        console.error("Failed to add challenge:", err);
        setChallenges((prev) => prev.filter((c) => c.id !== tempId));
        toast.error(`Failed to save challenge: ${err?.message ?? String(err)}`);
      });
  };

  const updateChallenge = (id: string, updates: Partial<Challenge>) => {
    // Optimistic local update
    setChallenges((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
    updateChallengeDb(id, updates).catch((err) =>
      console.error("Failed to update challenge:", err)
    );

    // A Step 2 failure ends the whole challenge lifecycle — the parent
    // Step 1 must stop reading as completed once its Step 2 has failed.
    if (updates.status === "failed") {
      const child = challenges.find((c) => c.id === id);
      if (child?.parentChallengeId) {
        const parentId = child.parentChallengeId;
        setChallenges((prev) =>
          prev.map((c) => (c.id === parentId ? { ...c, status: "failed" } : c))
        );
        updateChallengeDb(parentId, { status: "failed" }).catch((err) =>
          console.error("Failed to update parent challenge:", err)
        );
      }
    }
  };

  const deleteChallenge = (id: string) => {
    const linkedTradeIds = dbTrades
      .filter((t) => t.accountId === id && t.accountType === "challenge")
      .map((t) => t.id);

    // Optimistic local removal — trades first, then the account. Every
    // context consumer (Trader DNA, Dashboard) reads `trades`/`challenges`
    // straight from this context, so clearing both here refreshes them
    // immediately with no separate refetch needed.
    if (linkedTradeIds.length > 0) {
      setDbTrades((prev) => prev.filter((t) => !linkedTradeIds.includes(t.id)));
    }
    setChallenges((prev) => prev.filter((c) => c.id !== id));

    // Delete trades from the DB before the account — account_id has no FK
    // (it can point at either challenge_accounts or funded_accounts), so
    // this ordering, plus the DB trigger in migration 007, is what
    // guarantees no orphan trade is ever left behind.
    (linkedTradeIds.length > 0 ? deleteTradesByAccountDb(id, "challenge") : Promise.resolve())
      .then(() => deleteChallengeDb(id))
      .catch((err) => console.error("Failed to delete challenge:", err));
  };

  // ── Funded Account CRUD (Supabase-backed) ────────────────────────────────

  const addFundedAccount = (account: Omit<FundedAccount, "id">) => {
    if (!user) return;
    const tempId = `temp-${Date.now()}`;
    setFundedAccounts((prev) => [{ id: tempId, ...account }, ...prev]);
    insertFundedAccount(user.id, account)
      .then((saved) => {
        setFundedAccounts((prev) => prev.map((a) => (a.id === tempId ? saved : a)));
        toast.success("Funded account saved");
      })
      .catch((err) => {
        console.error("Failed to add funded account:", err);
        setFundedAccounts((prev) => prev.filter((a) => a.id !== tempId));
        toast.error(`Failed to save funded account: ${err?.message ?? String(err)}`);
      });
  };

  const updateFundedAccount = (id: string, updates: Partial<FundedAccount>) => {
    setFundedAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
    );
    updateFundedAccountDb(id, updates).catch((err) =>
      console.error("Failed to update funded account:", err)
    );
  };

  const deleteFundedAccount = (id: string) => {
    const linkedTradeIds = dbTrades
      .filter((t) => t.accountId === id && t.accountType === "funded")
      .map((t) => t.id);

    // Optimistic local removal — trades first, then the account (see
    // deleteChallenge above for why).
    if (linkedTradeIds.length > 0) {
      setDbTrades((prev) => prev.filter((t) => !linkedTradeIds.includes(t.id)));
    }
    setFundedAccounts((prev) => prev.filter((a) => a.id !== id));

    (linkedTradeIds.length > 0 ? deleteTradesByAccountDb(id, "funded") : Promise.resolve())
      .then(() => deleteFundedAccountDb(id))
      .catch((err) => console.error("Failed to delete funded account:", err));
  };

  const addPayout = (payout: Omit<Payout, "id">) => {
    if (!user) return;
    insertPayout(user.id, payout)
      .then((saved) => setPayouts((prev) => [saved, ...prev]))
      .catch((err) => console.error("Failed to add payout:", err));
  };

  const updatePayout = (id: string, updates: Partial<Payout>) => {
    setPayouts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
    updatePayoutDb(id, updates).catch((err) =>
      console.error("Failed to update payout:", err)
    );
  };

  const deletePayout = (id: string) => {
    setPayouts((prev) => prev.filter((p) => p.id !== id));
    deletePayoutDb(id).catch((err) =>
      console.error("Failed to delete payout:", err)
    );
  };

  // ── Trade Engine helpers ──────────────────────────────────────────────────

  // Recomputes a Supabase-backed account's P&L fields from a given trade
  // list and persists the result. Called after every addTrade / deleteTrade
  // for challenge/funded accounts only — personal accounts recalculate
  // their own equity inside PersonalAccountsContext instead, so this never
  // actually runs for accountType "personal" (the type param stays 3-way
  // only because callers resolve it from a Trade's accountType, which is
  // 3-way at the type level).
  const recalcAccount = (
    accountId: string,
    accountType: "challenge" | "funded" | "personal",
    allTrades: Trade[]
  ) => {
    if (accountType === "personal") return;
    const accountTrades = allTrades.filter(
      (t) => t.accountId === accountId && t.accountType === accountType
    );
    const totalPnL = accountTrades.reduce((sum, t) => sum + t.pnl, 0);

    if (accountType === "challenge") {
      const account = challenges.find((c) => c.id === accountId);
      if (!account) return;
      // maxDrawdown is stored as a percentage (e.g. 10 = 10%)
      const maxDDDollars = (account.maxDrawdown / 100) * account.accountSize;
      const lossAmount = Math.max(0, -totalPnL);
      const remainingDollars = Math.max(0, maxDDDollars - lossAmount);
      const newCurrentProfit = totalPnL;
      const newRemainingDrawdown = account.accountSize > 0
        ? (remainingDollars / account.accountSize) * 100
        : 0;
      setChallenges((prev) =>
        prev.map((c) =>
          c.id === accountId
            ? { ...c, currentProfit: newCurrentProfit, remainingDrawdown: newRemainingDrawdown }
            : c
        )
      );
      updateChallengeDb(accountId, {
        currentProfit: newCurrentProfit,
        remainingDrawdown: newRemainingDrawdown,
      }).catch((err) => console.error("Failed to recalc challenge:", err));
    } else {
      const account = fundedAccounts.find((a) => a.id === accountId);
      if (!account) return;
      // maxDrawdown is stored as a percentage (e.g. 10 = 10%)
      const maxDDDollars = (account.maxDrawdown / 100) * account.accountSize;
      const lossAmount = Math.max(0, -totalPnL);
      const remainingDollars = Math.max(0, maxDDDollars - lossAmount);
      const newCurrentProfit = totalPnL;
      const newCurrentBalance = account.initialBalance + totalPnL;
      const newRemainingDrawdown = account.accountSize > 0
        ? (remainingDollars / account.accountSize) * 100
        : 0;
      setFundedAccounts((prev) =>
        prev.map((a) =>
          a.id === accountId
            ? {
                ...a,
                currentProfit: newCurrentProfit,
                currentBalance: newCurrentBalance,
                remainingDrawdown: newRemainingDrawdown,
              }
            : a
        )
      );
      updateFundedAccountDb(accountId, {
        currentProfit: newCurrentProfit,
        currentBalance: newCurrentBalance,
        remainingDrawdown: newRemainingDrawdown,
      }).catch((err) => console.error("Failed to recalc funded account:", err));
    }
  };

  // Single-trade entry (the manual "Add Trade" dialog). Returns the saved
  // trade, or null on failure. Bulk CSV import uses addTradesBatch below
  // instead — firing one of these per row (as import used to) meant a
  // large file fired hundreds of concurrent inserts *and* concurrent
  // recalcAccount() writes, which exhausted Supabase's connection pool
  // after roughly the first 100 and silently failed the rest.
  const addTrade = (trade: Omit<Trade, "id">): Promise<Trade | null> => {
    // Personal accounts are client-side only (see PersonalAccountsContext)
    // — no Supabase insert, no network round-trip.
    if (trade.accountType === "personal") {
      return Promise.resolve(addPersonalTrade(trade));
    }
    if (!user) return Promise.resolve(null);
    return insertTrade(user.id, trade)
      .then((saved) => {
        let newTrades: Trade[] = [];
        setDbTrades((prev) => {
          newTrades = [...prev, saved];
          return newTrades;
        });
        recalcAccount(saved.accountId, saved.accountType, newTrades);
        return saved;
      })
      .catch((err) => {
        console.error("Failed to add trade:", err);
        return null;
      });
  };

  // Trade count per bulk-insert request. A single INSERT of this many rows
  // is one request, so a 2000-row import becomes ~8 requests instead of
  // ~2000 — the fix for the connection-pool exhaustion addTrade's doc
  // comment above describes.
  const TRADE_IMPORT_BATCH_SIZE = 250;

  // Bulk CSV import. Chunks `trades` into TRADE_IMPORT_BATCH_SIZE-row
  // batches and inserts each batch with a single request, running batches
  // sequentially (never more than one in flight) so a large file can never
  // re-create the original concurrency problem regardless of its size.
  // Rows with missing/invalid data are never passed in here — those are
  // already filtered out as "skipped" by the parser before this is called.
  // Local state is updated once at the end (not per row), and each
  // affected account is recalculated once (not once per inserted trade).
  const addTradesBatch = async (newTrades: Omit<Trade, "id">[]): Promise<TradeImportResult> => {
    if (newTrades.length === 0) {
      return { imported: [], failed: 0, errors: [] };
    }

    // Import Trades always operates on one selected account (and therefore
    // one account type) per run — checking the first row is unambiguous.
    // Personal accounts are client-side only, so the whole batch is
    // delegated to PersonalAccountsContext, no Supabase round-trip at all.
    if (newTrades[0].accountType === "personal") {
      const result = addPersonalTradesBatch(newTrades);
      return { imported: result.imported, failed: result.failed, errors: [] };
    }

    if (!user) {
      return { imported: [], failed: newTrades.length, errors: [] };
    }

    const imported: Trade[] = [];
    const errors: TradeImportBatchError[] = [];

    for (let batchIndex = 0; batchIndex * TRADE_IMPORT_BATCH_SIZE < newTrades.length; batchIndex++) {
      const start = batchIndex * TRADE_IMPORT_BATCH_SIZE;
      const chunk = newTrades.slice(start, start + TRADE_IMPORT_BATCH_SIZE);
      const rowRange = `${start + 1}-${start + chunk.length}`;
      try {
        const saved = await insertTradesBatch(user.id, chunk);
        imported.push(...saved);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[AccountsContext] Trade import batch ${batchIndex} (rows ${rowRange}) failed:`, message);
        errors.push({ batchIndex, rowRange, message });
      }
    }

    if (imported.length > 0) {
      let updatedTrades: Trade[] = [];
      setDbTrades((prev) => {
        updatedTrades = [...prev, ...imported];
        return updatedTrades;
      });

      const affectedAccounts = new Map<string, { accountId: string; accountType: "challenge" | "funded" }>();
      for (const t of imported) {
        if (t.accountType === "personal") continue;
        affectedAccounts.set(`${t.accountType}:${t.accountId}`, { accountId: t.accountId, accountType: t.accountType });
      }
      affectedAccounts.forEach(({ accountId, accountType }) => recalcAccount(accountId, accountType, updatedTrades));
    }

    return {
      imported,
      failed: newTrades.length - imported.length,
      errors,
    };
  };

  const deleteTrade = (id: string) => {
    const tradeToDelete = trades.find((t) => t.id === id);
    if (!tradeToDelete) return;

    if (tradeToDelete.accountType === "personal") {
      deletePersonalTrade(id);
      return;
    }

    const newTrades = dbTrades.filter((t) => t.id !== id);
    setDbTrades(newTrades); // optimistic removal
    deleteTradeDb(id)
      .then(() => {
        recalcAccount(tradeToDelete.accountId, tradeToDelete.accountType, newTrades);
      })
      .catch((err) => {
        console.error("Failed to delete trade:", err);
        setDbTrades(dbTrades); // rollback
      });
  };

  // Wipes every trade on a single account — used by "Delete All Trades" in
  // the Trade Journal, which is scoped to whichever account is currently
  // selected there, never every account the user owns. Reuses
  // deleteTradesByAccountDb(), the same cascade delete already used to
  // clear an account's trades when the account itself is deleted. The
  // account's P&L/drawdown is recalculated against an empty trade list for
  // just that account — the same recalcAccount() math deleteTrade() uses,
  // run once instead of looping over every account.
  const deleteTradesForAccount = (
    accountId: string,
    accountType: "challenge" | "funded" | "personal"
  ): Promise<void> => {
    if (accountType === "personal") {
      deleteTradesForPersonalAccount(accountId);
      return Promise.resolve();
    }

    const previousTrades = dbTrades;
    const newTrades = dbTrades.filter(
      (t) => !(t.accountId === accountId && t.accountType === accountType)
    );

    setDbTrades(newTrades); // optimistic clear

    return deleteTradesByAccountDb(accountId, accountType)
      .then(() => {
        recalcAccount(accountId, accountType, newTrades);
        toast.success("Account trades deleted successfully.");
      })
      .catch((err) => {
        console.error("Failed to delete account trades:", err);
        setDbTrades(previousTrades); // rollback
        toast.error(`Failed to delete account trades: ${err?.message ?? String(err)}`);
        throw err;
      });
  };

  // Returns 0 — account fields are the canonical source of truth after M4.
  // UI formulas like `challenge.currentProfit + getAccountPnL()` stay correct.
  const getAccountPnL = (_accountId: string, _accountType: "challenge" | "funded" | "personal") => {
    return 0;
  };

  const convertChallengeToFunded = (
    challengeId: string,
    fundedAccount: Omit<FundedAccount, "id">
  ) => {
    if (!user) return;

    // Optimistic: hide the Convert button immediately
    setChallenges((prev) =>
      prev.map((c) => (c.id === challengeId ? { ...c, convertedToFunded: true } : c))
    );

    insertFundedAccount(user.id, fundedAccount)
      .then((saved) => {
        setFundedAccounts((prev) => [saved, ...prev]);
        // Persist the challenge update with the real funded account UUID
        updateChallenge(challengeId, {
          status: "passed",
          convertedToFunded: true,
          fundedAccountId: saved.id,
        });

        // convertedToFundedAt is a separate, best-effort write: it depends on
        // migration 008 (converted_to_funded_at column) having been applied.
        // Kept out of the update above so a DB rejection here can never
        // block or roll back the conversion itself — only the Average Time
        // to Funded KPI falls back to `updated_at` until the column exists.
        const convertedToFundedAt = new Date().toISOString();
        setChallenges((prev) =>
          prev.map((c) => (c.id === challengeId ? { ...c, convertedToFundedAt } : c))
        );
        updateChallengeDb(challengeId, { convertedToFundedAt }).catch((err) =>
          console.error("Failed to persist convertedToFundedAt (has migration 008 been applied?):", err)
        );
      })
      .catch((err) => {
        console.error("Failed to convert challenge to funded:", err);
        // Rollback optimistic flag so the button reappears
        setChallenges((prev) =>
          prev.map((c) => (c.id === challengeId ? { ...c, convertedToFunded: false } : c))
        );
      });
  };

  const getFundingRateStats = (): FundingRateStats => {
    // A Step 2 row is a continuation of its parent challenge, not a
    // separate purchase — only root challenges count toward these totals,
    // and a root's pass/fail/convert outcome is taken from its Step 2 row
    // (if one exists) so the two steps are never counted separately.
    const rootChallenges = getRootChallenges(challenges);
    const totalChallengesPurchased = rootChallenges.length;
    const activeChallenges = rootChallenges.filter(
      (c) => getEffectiveStatus(c, challenges) === "active"
    ).length;
    const failedChallenges = rootChallenges.filter(
      (c) => getEffectiveStatus(c, challenges) === "failed"
    ).length;
    const passedChallenges = rootChallenges.filter(
      (c) => getEffectiveStatus(c, challenges) === "passed"
    ).length;
    const convertedToFunded = rootChallenges.filter(
      (c) => getEffectiveConvertedToFunded(c, challenges)
    ).length;
    const fundingRatePercentage =
      totalChallengesPurchased > 0
        ? (convertedToFunded / totalChallengesPurchased) * 100
        : 0;
    const totalChallengeCost = rootChallenges.reduce(
      (sum, c) => sum + c.purchaseCost,
      0
    );

    return {
      totalChallengesPurchased,
      activeChallenges,
      failedChallenges,
      passedChallenges,
      convertedToFunded,
      fundingRatePercentage,
      totalChallengeCost,
    };
  };

  const getROIStats = (): ROIStats => {
    // Step 2 rows are a continuation of their root challenge, not a
    // separate purchase, so only root challenges count toward cost/ROI.
    const challengeCosts = getRootChallenges(challenges).reduce(
      (sum, c) => sum + c.purchaseCost,
      0
    );
    // A converted account's cost already lives on its source Challenge row
    // above — only non-evaluation-path funded accounts (Instant Funded,
    // giveaway, etc.) have their own purchaseCost, since they never had one.
    const instantFundedCosts = fundedAccounts
      .filter((a) => a.fundingPath !== "evaluation")
      .reduce((sum, a) => sum + (a.purchaseCost ?? 0), 0);
    const totalChallengeCosts = challengeCosts + instantFundedCosts;
    const totalPayoutsReceived = payouts
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + p.receivedPayoutAmount, 0);
    const netProfit = totalPayoutsReceived - totalChallengeCosts;
    const roiPercentage =
      totalChallengeCosts > 0 ? (netProfit / totalChallengeCosts) * 100 : 0;

    return {
      totalChallengeCosts,
      totalPayoutsReceived,
      netProfit,
      roiPercentage,
    };
  };

  const getDashboardKPIs = (): DashboardKPIs => {
    const fundingStats = getFundingRateStats();
    const roiStats = getROIStats();
    const totalFundedCapital = fundedAccounts.reduce(
      (sum, a) => sum + a.accountSize,
      0
    );
    const activeFundedAccounts = fundedAccounts.filter(
      (a) => a.status === "active"
    ).length;
    const breachedFundedAccounts = fundedAccounts.filter(
      (a) => a.status === "breached"
    ).length;
    const activeChallengeAccounts = fundingStats.activeChallenges;

    // Average Time to Funded — root challenges only, Step 2's outcome (if
    // any) providing the funded date, but the *root's* own dates always
    // providing the lifecycle start (see getEffectiveStartDate).
    const fundedDurationsDays = getRootChallenges(challenges)
      .map((root) => {
        const fundedDate = getEffectiveFundedDate(root, challenges);
        const startDate = getEffectiveStartDate(root, trades);
        if (!fundedDate || !startDate) return null;
        const days = (new Date(fundedDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24);
        return days >= 0 ? days : null;
      })
      .filter((d): d is number => d !== null);
    const averageTimeToFundedDays =
      fundedDurationsDays.length > 0
        ? fundedDurationsDays.reduce((sum, d) => sum + d, 0) / fundedDurationsDays.length
        : null;

    return {
      totalChallengeCosts: roiStats.totalChallengeCosts,
      totalPayoutsReceived: roiStats.totalPayoutsReceived,
      netROI: roiStats.netProfit,
      roiPercentage: roiStats.roiPercentage,
      fundingRate: fundingStats.fundingRatePercentage,
      totalFundedCapital,
      activeFundedAccounts,
      breachedFundedAccounts,
      activeChallengeAccounts,
      averageTimeToFundedDays,
      timeToFundedSampleSize: fundedDurationsDays.length,
    };
  };

  return (
    <AccountsContext.Provider
      value={{
        challenges,
        challengesLoading,
        fundedAccounts,
        fundedAccountsLoading,
        payouts,
        payoutsLoading,
        trades,
        tradesLoading,
        personalAccounts,
        personalAccountsLoading,
        addChallenge,
        updateChallenge,
        deleteChallenge,
        addFundedAccount,
        updateFundedAccount,
        deleteFundedAccount,
        addPersonalAccount,
        updatePersonalAccount,
        deletePersonalAccount,
        addPayout,
        updatePayout,
        deletePayout,
        addTrade,
        addTradesBatch,
        deleteTrade,
        deleteTradesForAccount,
        getAccountPnL,
        convertChallengeToFunded,
        getFundingRateStats,
        getROIStats,
        getDashboardKPIs,
      }}
    >
      {children}
    </AccountsContext.Provider>
  );
}

export function useAccounts() {
  const context = useContext(AccountsContext);
  if (context === undefined) {
    throw new Error("useAccounts must be used within an AccountsProvider");
  }
  return context;
}
