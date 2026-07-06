"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAccounts } from "@/context/AccountsContext";
import { getTradesForTradingMode } from "@/lib/tradingMode";

// ============================================================
// PropEdge — Personal Portfolio context (Personal Capital Block 2)
// ============================================================
// V1 storage: localStorage only, mirroring AdminContext/TradingModeContext's
// "default first, hydrate on mount" pattern — no Supabase schema yet. A
// user has at most one portfolio for now (a single object, not a list).
//
// Trading Profit reads trades from AccountsContext, but only ever through
// getTradesForTradingMode(trades, "personal-capital") — the same choke
// point Trader DNA/Journal use — so this context can never sum Prop Firm
// pnl into a Personal Capital number. Today that trade set is always
// empty (no personal trading accounts exist yet), so Trading Profit is 0
// until a later block wires those up.

export interface PersonalPortfolio {
  id: string;
  name: string;
  currency: string;
  initialDeposit: number;
  createdAt: string; // ISO timestamp
}

export type CashTransactionType = "deposit" | "withdrawal";

export interface CashTransaction {
  id: string;
  type: CashTransactionType;
  amount: number;
  date: string; // "YYYY-MM-DD"
  note?: string;
}

interface CreatePortfolioInput {
  name: string;
  currency: string;
  initialDeposit: number;
}

interface PersonalPortfolioContextType {
  portfolio: PersonalPortfolio | null;
  cashTransactions: CashTransaction[];
  createPortfolio: (input: CreatePortfolioInput) => void;
  addDeposit: (amount: number, date: string, note?: string) => void;
  addWithdrawal: (amount: number, date: string, note?: string) => void;
  getNetDeposits: () => number;
  getNetWithdrawals: () => number;
  getTradingProfit: () => number;
  getPortfolioValue: () => number;
}

const PersonalPortfolioContext = createContext<PersonalPortfolioContextType | undefined>(undefined);

const PORTFOLIO_STORAGE_KEY = "prop_firm_personal_portfolio";
const CASH_TRANSACTIONS_STORAGE_KEY = "prop_firm_personal_cash_transactions";

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `pc_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function PersonalPortfolioProvider({ children }: { children: ReactNode }) {
  const { trades } = useAccounts();
  const [portfolio, setPortfolio] = useState<PersonalPortfolio | null>(null);
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>([]);

  // Same "default first, hydrate from localStorage on mount" pattern as
  // AdminContext/TradingModeContext — no SSR/client markup mismatch.
  useEffect(() => {
    const storedPortfolio = localStorage.getItem(PORTFOLIO_STORAGE_KEY);
    if (storedPortfolio) {
      try {
        setPortfolio(JSON.parse(storedPortfolio));
      } catch {
        // Corrupt/legacy value — ignore, behave as if no portfolio exists.
      }
    }

    const storedTransactions = localStorage.getItem(CASH_TRANSACTIONS_STORAGE_KEY);
    if (storedTransactions) {
      try {
        setCashTransactions(JSON.parse(storedTransactions));
      } catch {
        // Corrupt/legacy value — ignore, behave as if no transactions exist.
      }
    }
  }, []);

  const createPortfolio = (input: CreatePortfolioInput) => {
    const next: PersonalPortfolio = {
      id: generateId(),
      name: input.name,
      currency: input.currency,
      initialDeposit: input.initialDeposit,
      createdAt: new Date().toISOString(),
    };
    setPortfolio(next);
    localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(next));
  };

  const addTransaction = (type: CashTransactionType, amount: number, date: string, note?: string) => {
    const next: CashTransaction = { id: generateId(), type, amount, date, note };
    setCashTransactions((prev) => {
      const updated = [...prev, next];
      localStorage.setItem(CASH_TRANSACTIONS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const addDeposit = (amount: number, date: string, note?: string) => addTransaction("deposit", amount, date, note);
  const addWithdrawal = (amount: number, date: string, note?: string) =>
    addTransaction("withdrawal", amount, date, note);

  // Net Deposits = initialDeposit + sum(deposits)
  const getNetDeposits = () => {
    const depositsSum = cashTransactions
      .filter((t) => t.type === "deposit")
      .reduce((sum, t) => sum + t.amount, 0);
    return (portfolio?.initialDeposit ?? 0) + depositsSum;
  };

  // Net Withdrawals = sum(withdrawals)
  const getNetWithdrawals = () =>
    cashTransactions.filter((t) => t.type === "withdrawal").reduce((sum, t) => sum + t.amount, 0);

  // Trading Profit = sum(pnl) over Personal Capital trades only — never
  // Prop Firm trades, enforced by routing through getTradesForTradingMode.
  const getTradingProfit = () => {
    const personalTrades = getTradesForTradingMode(trades, "personal-capital");
    return personalTrades.reduce((sum, t) => sum + t.pnl, 0);
  };

  // Portfolio Value = Net Deposits - Net Withdrawals + Trading Profit
  const getPortfolioValue = () => getNetDeposits() - getNetWithdrawals() + getTradingProfit();

  return (
    <PersonalPortfolioContext.Provider
      value={{
        portfolio,
        cashTransactions,
        createPortfolio,
        addDeposit,
        addWithdrawal,
        getNetDeposits,
        getNetWithdrawals,
        getTradingProfit,
        getPortfolioValue,
      }}
    >
      {children}
    </PersonalPortfolioContext.Provider>
  );
}

export function usePersonalPortfolio() {
  const context = useContext(PersonalPortfolioContext);
  if (context === undefined) {
    throw new Error("usePersonalPortfolio must be used within a PersonalPortfolioProvider");
  }
  return context;
}
