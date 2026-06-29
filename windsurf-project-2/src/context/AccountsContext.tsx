"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
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

interface AccountsContextType {
  challenges: Challenge[];
  fundedAccounts: FundedAccount[];
  payouts: Payout[];
  trades: Trade[];
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
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [fundedAccounts, setFundedAccounts] = useState<FundedAccount[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);

  const addChallenge = (challenge: Omit<Challenge, "id">) => {
    const newChallenge: Challenge = {
      ...challenge,
      id: Date.now().toString(),
    };
    setChallenges([...challenges, newChallenge]);
  };

  const updateChallenge = (id: string, updates: Partial<Challenge>) => {
    setChallenges(
      challenges.map((challenge) =>
        challenge.id === id ? { ...challenge, ...updates } : challenge
      )
    );
  };

  const deleteChallenge = (id: string) => {
    setChallenges(challenges.filter((challenge) => challenge.id !== id));
  };

  const addFundedAccount = (account: Omit<FundedAccount, "id">) => {
    const newAccount: FundedAccount = {
      ...account,
      id: Date.now().toString(),
    };
    setFundedAccounts([...fundedAccounts, newAccount]);
  };

  const updateFundedAccount = (id: string, updates: Partial<FundedAccount>) => {
    setFundedAccounts(
      fundedAccounts.map((account) =>
        account.id === id ? { ...account, ...updates } : account
      )
    );
  };

  const deleteFundedAccount = (id: string) => {
    setFundedAccounts(fundedAccounts.filter((account) => account.id !== id));
  };

  const addPayout = (payout: Omit<Payout, "id">) => {
    const newPayout: Payout = {
      ...payout,
      id: Date.now().toString(),
    };
    setPayouts([...payouts, newPayout]);
  };

  const updatePayout = (id: string, updates: Partial<Payout>) => {
    setPayouts(
      payouts.map((payout) =>
        payout.id === id ? { ...payout, ...updates } : payout
      )
    );
  };

  const deletePayout = (id: string) => {
    setPayouts(payouts.filter((payout) => payout.id !== id));
  };

  const addTrade = (trade: Omit<Trade, "id">) => {
    const newTrade: Trade = {
      ...trade,
      id: Date.now().toString(),
    };
    setTrades([...trades, newTrade]);
  };

  const deleteTrade = (id: string) => {
    setTrades(trades.filter((trade) => trade.id !== id));
  };

  const getAccountPnL = (accountId: string, accountType: "challenge" | "funded") => {
    const accountTrades = trades.filter(
      (t) => t.accountId === accountId && t.accountType === accountType
    );
    return accountTrades.reduce((sum, t) => sum + t.pnl, 0);
  };

  const convertChallengeToFunded = (
    challengeId: string,
    fundedAccount: Omit<FundedAccount, "id">
  ) => {
    const newAccount: FundedAccount = {
      ...fundedAccount,
      id: Date.now().toString(),
    };
    setFundedAccounts([...fundedAccounts, newAccount]);
    updateChallenge(challengeId, {
      status: "passed",
      convertedToFunded: true,
      fundedAccountId: newAccount.id,
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
        fundedAccounts,
        payouts,
        trades,
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
