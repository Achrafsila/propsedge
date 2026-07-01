"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { toast } from "sonner";
import {
  Challenge,
  FundedAccount,
  Payout,
  Trade,
  FundingRateStats,
  ROIStats,
  DashboardKPIs,
  ChallengeStatus,
  FundedAccountStatus,
  PayoutStatus,
} from "@/types";
import { useAuth } from "@/context/AuthContext";
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
  deleteTradeDb,
} from "@/lib/supabase/trades";
import {
  fetchPayouts,
  insertPayout,
  updatePayoutDb,
  deletePayoutDb,
} from "@/lib/supabase/payouts";

interface AccountsContextType {
  challenges: Challenge[];
  challengesLoading: boolean;
  fundedAccounts: FundedAccount[];
  fundedAccountsLoading: boolean;
  payouts: Payout[];
  payoutsLoading: boolean;
  trades: Trade[];
  tradesLoading: boolean;
  addChallenge: (challenge: Omit<Challenge, "id">) => void;
  updateChallenge: (id: string, challenge: Partial<Challenge>) => void;
  deleteChallenge: (id: string) => void;
  addFundedAccount: (account: Omit<FundedAccount, "id">) => void;
  updateFundedAccount: (id: string, account: Partial<FundedAccount>) => void;
  deleteFundedAccount: (id: string) => void;
  addPayout: (payout: Omit<Payout, "id">) => void;
  updatePayout: (id: string, payout: Partial<Payout>) => void;
  deletePayout: (id: string) => void;
  addTrade: (trade: Omit<Trade, "id">) => void;
  deleteTrade: (id: string) => void;
  getAccountPnL: (accountId: string, accountType: "challenge" | "funded") => number;
  convertChallengeToFunded: (challengeId: string, fundedAccount: Omit<FundedAccount, "id">) => void;
  getFundingRateStats: () => FundingRateStats;
  getROIStats: () => ROIStats;
  getDashboardKPIs: () => DashboardKPIs;
}

const AccountsContext = createContext<AccountsContextType | undefined>(undefined);

export function AccountsProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [challengesLoading, setChallengesLoading] = useState(true);
  const [fundedAccounts, setFundedAccounts] = useState<FundedAccount[]>([]);
  const [fundedAccountsLoading, setFundedAccountsLoading] = useState(true);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(true);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(true);

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
      setTrades([]);
      setTradesLoading(false);
      return;
    }
    setTradesLoading(true);
    fetchTrades(user.id)
      .then(setTrades)
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
  };

  const deleteChallenge = (id: string) => {
    // Optimistic local removal
    setChallenges((prev) => prev.filter((c) => c.id !== id));
    deleteChallengeDb(id).catch((err) =>
      console.error("Failed to delete challenge:", err)
    );
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
    setFundedAccounts((prev) => prev.filter((a) => a.id !== id));
    deleteFundedAccountDb(id).catch((err) =>
      console.error("Failed to delete funded account:", err)
    );
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

  // Recomputes an account's P&L fields from a given trade list and persists
  // the result to Supabase. Called after every addTrade / deleteTrade.
  const recalcAccount = (
    accountId: string,
    accountType: "challenge" | "funded",
    allTrades: Trade[]
  ) => {
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

  const addTrade = (trade: Omit<Trade, "id">) => {
    if (!user) return;
    insertTrade(user.id, trade)
      .then((saved) => {
        const newTrades = [...trades, saved];
        setTrades(newTrades);
        recalcAccount(saved.accountId, saved.accountType, newTrades);
      })
      .catch((err) => console.error("Failed to add trade:", err));
  };

  const deleteTrade = (id: string) => {
    const tradeToDelete = trades.find((t) => t.id === id);
    if (!tradeToDelete) return;
    const newTrades = trades.filter((t) => t.id !== id);
    setTrades(newTrades); // optimistic removal
    deleteTradeDb(id)
      .then(() => {
        recalcAccount(tradeToDelete.accountId, tradeToDelete.accountType, newTrades);
      })
      .catch((err) => {
        console.error("Failed to delete trade:", err);
        setTrades(trades); // rollback
      });
  };

  // Returns 0 — account fields are the canonical source of truth after M4.
  // UI formulas like `challenge.currentProfit + getAccountPnL()` stay correct.
  const getAccountPnL = (_accountId: string, _accountType: "challenge" | "funded") => {
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
    const totalChallengesPurchased = challenges.length;
    const activeChallenges = challenges.filter(
      (c) => c.status === "active"
    ).length;
    const failedChallenges = challenges.filter(
      (c) => c.status === "failed"
    ).length;
    const passedChallenges = challenges.filter(
      (c) => c.status === "passed"
    ).length;
    const convertedToFunded = challenges.filter(
      (c) => c.convertedToFunded
    ).length;
    const fundingRatePercentage =
      totalChallengesPurchased > 0
        ? (convertedToFunded / totalChallengesPurchased) * 100
        : 0;
    const totalChallengeCost = challenges.reduce(
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
    const totalChallengeCosts = challenges.reduce(
      (sum, c) => sum + c.purchaseCost,
      0
    );
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
        addChallenge,
        updateChallenge,
        deleteChallenge,
        addFundedAccount,
        updateFundedAccount,
        deleteFundedAccount,
        addPayout,
        updatePayout,
        deletePayout,
        addTrade,
        deleteTrade,
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
