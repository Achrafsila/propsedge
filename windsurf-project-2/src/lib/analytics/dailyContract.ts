import { DailyContract, DailyContractObjective, Trade } from "@/types";
import { AccountBriefing } from "./aiCoach";

// ============================================================
// PropEdge — Daily Trading Contract engine (EdgePilot V2)
// ============================================================
// Builds the editable draft the Morning Briefing's commitment step starts
// from, and validates it before commit. Pure and self-contained, same
// convention as every other file in this folder — no persistence here
// (that's DailyContractsContext), no violation/audit logic here (that's
// accountabilityEngine.ts).

// The trader-editable shape before a contract has an id/committedAt —
// exactly what DailyContractsContext.commitContract() accepts.
export type DailyContractDraft = Omit<DailyContract, "id" | "committedAt">;

// Seeds the draft straight from the account's already-computed
// AccountBriefing (same max risk / max trades / stop-after-losses numbers
// TradingProtocolStep.tsx already renders read-only today) — the trader
// edits from here, never from a blank form. Session/instruments start
// unrestricted ("Any"); special rules start empty.
export function buildContractDraft(briefing: AccountBriefing, contractDate: string): DailyContractDraft {
  return {
    accountId: briefing.account.id,
    accountType: briefing.account.type,
    contractDate,
    primaryObjective: null,
    maxRiskPerTrade: briefing.recommendedRisk.amount,
    maxTrades: briefing.maxTrades,
    stopAfterLosses: briefing.stopAfterLosses,
    allowedSessions: [],
    allowedInstruments: [],
    specialRules: null,
  };
}

// The instruments this account has actually traded before — used to
// populate the "Allowed Instruments" picker with real choices instead of a
// blank free-text box. Deliberately account-scoped (not
// traderIdentity.getTopInstruments, which pools every account and only
// returns the top 2) — sorted by frequency, no cap, since a contract
// picker needs every option, not just the headline ones.
export function getAccountInstrumentOptions(trades: Trade[], accountId: string, accountType: DailyContract["accountType"]): string[] {
  const counts = new Map<string, number>();
  for (const t of trades) {
    if (t.accountId !== accountId || t.accountType !== accountType || !t.symbol) continue;
    counts.set(t.symbol, (counts.get(t.symbol) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([symbol]) => symbol);
}

export interface DailyContractValidation {
  valid: boolean;
  errors: string[];
}

// Every field is optional (empty/unrestricted is a valid contract — a
// trader can commit to "no numeric limits, but only Gold, London session"),
// but whatever IS filled in must be a sane non-negative number. Called
// before commitContract() so a malformed draft never reaches Supabase.
export function validateContractDraft(draft: DailyContractDraft): DailyContractValidation {
  const errors: string[] = [];
  if (draft.maxRiskPerTrade !== null && draft.maxRiskPerTrade < 0) errors.push("Maximum risk per trade cannot be negative.");
  if (draft.maxTrades !== null && (draft.maxTrades < 0 || !Number.isInteger(draft.maxTrades))) {
    errors.push("Maximum trades must be a non-negative whole number.");
  }
  if (draft.stopAfterLosses !== null && (draft.stopAfterLosses < 0 || !Number.isInteger(draft.stopAfterLosses))) {
    errors.push("Stop-after-losses must be a non-negative whole number.");
  }
  return { valid: errors.length === 0, errors };
}

export const DAILY_CONTRACT_OBJECTIVE_LABEL: Record<DailyContractObjective, string> = {
  pass_challenge: "Pass the Challenge",
  protect_funded: "Protect the Funded Account",
  prepare_payout: "Prepare for Payout",
  build_consistency: "Build Consistency",
  focus_discipline: "Focus on Discipline",
  recover_losses: "Recover Losses",
};
