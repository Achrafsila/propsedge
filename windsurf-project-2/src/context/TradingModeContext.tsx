"use client";

import { createContext, useContext, useEffect, ReactNode } from "react";

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

// Compatibility adapter during T0.5: personal-capital is disabled, but the
// existing consumers keep their stable API until the dependency cleanup.
export function TradingModeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Preserve personal portfolio/account storage. Only normalize the mode preference.
    localStorage.setItem(TRADING_MODE_STORAGE_KEY, DEFAULT_TRADING_MODE);
  }, []);

  const setTradingMode = (mode: TradingMode) => {
    void mode;
    // Never activate broker mode while the deprecated UI is being retired.
    localStorage.setItem(TRADING_MODE_STORAGE_KEY, DEFAULT_TRADING_MODE);
  };

  return (
    <TradingModeContext.Provider value={{
      tradingMode: DEFAULT_TRADING_MODE,
      setTradingMode,
      isPropFirmMode: true,
      isPersonalCapitalMode: false,
    }}>
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
