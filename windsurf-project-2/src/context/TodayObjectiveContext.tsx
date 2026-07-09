"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { TodaysObjective } from "@/lib/analytics/aiCoach";
import { todayDateString } from "@/lib/dateKey";

interface TodayObjectiveContextType {
  objective: TodaysObjective | null;
  setObjective: (objective: TodaysObjective) => void;
}

const TodayObjectiveContext = createContext<TodayObjectiveContextType | undefined>(undefined);

const TODAY_OBJECTIVE_STORAGE_KEY = "pe_today_objective";

interface StoredObjective {
  date: string;
  objective: TodaysObjective;
}

function isStoredObjective(value: unknown): value is StoredObjective {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as StoredObjective).date === "string" &&
    typeof (value as StoredObjective).objective === "string"
  );
}

// Session-only by design (the ticket explicitly forbids a Supabase schema
// change for this) — resets every calendar day since it's only ever read as
// "today's" objective, same "default first, hydrate from localStorage on
// mount" pattern as TradingModeContext, just with an extra same-day check so
// yesterday's stored objective never leaks into today.
export function TodayObjectiveProvider({ children }: { children: ReactNode }) {
  const [objective, setObjectiveState] = useState<TodaysObjective | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(TODAY_OBJECTIVE_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isStoredObjective(parsed) && parsed.date === todayDateString()) {
        setObjectiveState(parsed.objective);
      }
    } catch {
      // Malformed/legacy value — treat as "not set yet", same as absent.
    }
  }, []);

  const setObjective = (next: TodaysObjective) => {
    setObjectiveState(next);
    const stored: StoredObjective = { date: todayDateString(), objective: next };
    localStorage.setItem(TODAY_OBJECTIVE_STORAGE_KEY, JSON.stringify(stored));
  };

  return (
    <TodayObjectiveContext.Provider value={{ objective, setObjective }}>
      {children}
    </TodayObjectiveContext.Provider>
  );
}

export function useTodayObjective() {
  const context = useContext(TodayObjectiveContext);
  if (context === undefined) {
    throw new Error("useTodayObjective must be used within a TodayObjectiveProvider");
  }
  return context;
}
