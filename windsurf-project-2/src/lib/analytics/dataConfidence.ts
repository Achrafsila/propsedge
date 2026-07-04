import { Trade } from "@/types";

// ============================================================
// PropEdge — Data Confidence engine (Trader DNA V2)
// ============================================================
// Pure, stateless helper over a Trade[] list. Answers one question: "how
// much should a reader trust the Trader DNA insights they're looking at
// right now?" — never whether those insights are good or bad news.
//
// This is informational only. It never blocks, hides, or disables any
// other Trader DNA card or KPI — a brand-new trader with 2 trades still
// sees every card, just alongside a clear signal that the profile is
// still forming. Self-contained by design (no imports from traderDNA.ts,
// traderIdentity.ts, traderHabits.ts, traderEdge.ts, traderBlindSpots.ts,
// or traderDiscipline.ts), same convention as the rest of Trader DNA.

// Score caps out at this many trades — 150+ trades is already
// "Established DNA" (see LEVEL_THRESHOLDS below), so more trades beyond
// that don't make the profile any more "confident" for this purpose.
const SCORE_CAP_TRADES = 150;

export type DataConfidenceLevel =
  | "getting_started"
  | "early_signals"
  | "developing_profile"
  | "reliable_profile"
  | "established_dna";

interface LevelDefinition {
  level: DataConfidenceLevel;
  label: string;
  message: string;
  minTrades: number;
}

// Ordered ascending by minTrades — the classifier below walks this list
// and keeps the last definition whose minTrades the trader has reached.
const LEVEL_DEFINITIONS: LevelDefinition[] = [
  {
    level: "getting_started",
    label: "Getting Started",
    message: "Start importing trades to build your Trader DNA.",
    minTrades: 0,
  },
  {
    level: "early_signals",
    label: "Early Signals",
    message: "Early patterns are visible, but your profile is still forming.",
    minTrades: 10,
  },
  {
    level: "developing_profile",
    label: "Developing Profile",
    message: "Your Trader DNA is becoming more representative.",
    minTrades: 30,
  },
  {
    level: "reliable_profile",
    label: "Reliable Profile",
    message: "Your trading behaviour is now supported by a solid sample.",
    minTrades: 75,
  },
  {
    level: "established_dna",
    label: "Established DNA",
    message: "Your Trader DNA is based on a strong trading history.",
    minTrades: 150,
  },
];

function classifyLevel(totalTrades: number): LevelDefinition {
  let current = LEVEL_DEFINITIONS[0];
  for (const definition of LEVEL_DEFINITIONS) {
    if (totalTrades >= definition.minTrades) current = definition;
  }
  return current;
}

export interface DataConfidence {
  level: DataConfidenceLevel;
  label: string;
  score: number; // 0-100, trade count capped at SCORE_CAP_TRADES
  totalTrades: number;
  activeDays: number;
  message: string;
}

export function getDataConfidence(trades: Trade[]): DataConfidence {
  const dated = trades.filter((t) => !!t.entryDate);
  const totalTrades = dated.length;
  const activeDays = new Set(dated.map((t) => t.entryDate)).size;

  const { level, label, message } = classifyLevel(totalTrades);
  const score = Math.round((Math.min(totalTrades, SCORE_CAP_TRADES) / SCORE_CAP_TRADES) * 100);

  return {
    level,
    label,
    score,
    totalTrades,
    activeDays,
    message,
  };
}
