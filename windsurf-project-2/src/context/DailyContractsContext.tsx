"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { DailyContract } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { fetchDailyContracts, upsertDailyContract } from "@/lib/supabase/daily_contracts";

// ============================================================
// PropEdge — Daily Trading Contracts context (EdgePilot V2)
// ============================================================
// Supabase-backed (see supabase/migrations/009_daily_contracts.sql and
// src/lib/supabase/daily_contracts.ts) — unlike TodayObjectiveContext,
// this persists across devices and needs to survive as history for the
// Accountability Engine to audit against, so it can't be localStorage-only.
// Loads every contract the user has ever committed to on mount (small
// table, one row per account per day — same "load it all up front" choice
// AccountsContext already makes for trades/challenges/payouts).

interface DailyContractsContextType {
  contracts: DailyContract[];
  contractsLoading: boolean;
  getContract: (accountType: DailyContract["accountType"], accountId: string, date: string) => DailyContract | null;
  commitContract: (contract: Omit<DailyContract, "id" | "committedAt">) => Promise<DailyContract>;
}

const DailyContractsContext = createContext<DailyContractsContextType | undefined>(undefined);

export function DailyContractsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [contracts, setContracts] = useState<DailyContract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setContracts([]);
      setContractsLoading(false);
      return;
    }
    let cancelled = false;
    setContractsLoading(true);
    fetchDailyContracts(user.id)
      .then((rows) => {
        if (!cancelled) setContracts(rows);
      })
      .catch((error) => {
        console.error("[DailyContractsContext] Failed to load daily contracts:", error);
      })
      .finally(() => {
        if (!cancelled) setContractsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const getContract = useCallback(
    (accountType: DailyContract["accountType"], accountId: string, date: string): DailyContract | null => {
      return (
        contracts.find((c) => c.accountType === accountType && c.accountId === accountId && c.contractDate === date) ??
        null
      );
    },
    [contracts]
  );

  const commitContract = useCallback(
    async (contract: Omit<DailyContract, "id" | "committedAt">): Promise<DailyContract> => {
      if (!user) throw new Error("Cannot commit a Daily Contract while signed out.");
      const saved = await upsertDailyContract(user.id, contract);
      setContracts((prev) => [
        ...prev.filter(
          (c) => !(c.accountType === saved.accountType && c.accountId === saved.accountId && c.contractDate === saved.contractDate)
        ),
        saved,
      ]);
      return saved;
    },
    [user]
  );

  return (
    <DailyContractsContext.Provider value={{ contracts, contractsLoading, getContract, commitContract }}>
      {children}
    </DailyContractsContext.Provider>
  );
}

export function useDailyContracts() {
  const context = useContext(DailyContractsContext);
  if (context === undefined) {
    throw new Error("useDailyContracts must be used within a DailyContractsProvider");
  }
  return context;
}
