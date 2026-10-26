"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type TradingMode = "prop-firm" | "personal-capital";

interface TradingModeContextType {
  tradingMode: TradingMode;
  setTradingMode: (mode: TradingMode) => void;
  isPropFirmMode: boolean;
  isPersonalCapitalMode: boolean;
}

const TradingModeContext = createContext<TradingModeContextType | undefined>(undefined);

// Same "prop_firm_" storage-key prefix AdminContext already uses for
// app-wide persisted preferences (ADMIN_STORAGE_KEY, CHALLENGE_TYPES_STORAGE_KEY).
const TRADING_MODE_STORAGE_KEY = "prop_firm_trading_mode";
const DEFAULT_TRADING_MODE: TradingMode = "prop-firm";

function isTradingMode(value: string | null): value is TradingMode {
  return value === "prop-firm" || value === "personal-capital";
}

export function TradingModeProvider({ children }: { children: ReactNode }) {
  const [tradingMode, setTradingModeState] = useState<TradingMode>(DEFAULT_TRADING_MODE);

  // Same "default first, hydrate from localStorage on mount" pattern as
  // AdminContext — server render and first client render both start on
  // Prop Firm, so there's no SSR/client markup mismatch.
  useEffect(() => {
    const stored = localStorage.getItem(TRADING_MODE_STORAGE_KEY);
    if (isTradingMode(stored)) {
      setTradingModeState(stored);
    }
  }, []);

  const setTradingMode = (mode: TradingMode) => {
    setTradingModeState(mode);
    localStorage.setItem(TRADING_MODE_STORAGE_KEY, mode);
  };

  return (
    <TradingModeContext.Provider
      value={{
        tradingMode,
        setTradingMode,
        isPropFirmMode: tradingMode === "prop-firm",
        isPersonalCapitalMode: tradingMode === "personal-capital",
      }}
    >
      {children}
    </TradingModeContext.Provider>
  );
}

export function useTradingMode() {
  const context = useContext(TradingModeContext);
  if (context === undefined) {
    throw new Error("useTradingMode must be used within a TradingModeProvider");
  }
  return context;
}
