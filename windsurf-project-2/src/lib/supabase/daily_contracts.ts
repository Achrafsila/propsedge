import { createClient } from "@/lib/supabase/client";
import { DailyContract, DailyContractObjective } from "@/types";

// ─── DB row shape ──────────────────────────────────────────────────────────────
interface DailyContractRow {
  id: string;
  user_id: string;
  account_id: string;
  account_type: string;
  contract_date: string;
  primary_objective: string | null;
  max_risk_per_trade: number | null;
  max_trades: number | null;
  stop_after_losses: number | null;
  allowed_sessions: string[];
  allowed_instruments: string[];
  special_rules: string | null;
  committed_at: string;
  created_at: string;
}

// ─── DB → TypeScript ──────────────────────────────────────────────────────────
function rowToDailyContract(row: DailyContractRow): DailyContract {
  return {
    id: row.id,
    accountId: row.account_id,
    accountType: row.account_type as DailyContract["accountType"],
    contractDate: row.contract_date,
    primaryObjective: (row.primary_objective as DailyContractObjective | null) ?? null,
    maxRiskPerTrade: row.max_risk_per_trade,
    maxTrades: row.max_trades,
    stopAfterLosses: row.stop_after_losses,
    allowedSessions: (row.allowed_sessions ?? []) as DailyContract["allowedSessions"],
    allowedInstruments: row.allowed_instruments ?? [],
    specialRules: row.special_rules,
    committedAt: row.committed_at,
  };
}

// ─── TypeScript → DB insert/upsert row ─────────────────────────────────────────
function dailyContractToRow(contract: Omit<DailyContract, "id" | "committedAt">, userId: string) {
  return {
    user_id: userId,
    account_id: contract.accountId,
    account_type: contract.accountType,
    contract_date: contract.contractDate,
    primary_objective: contract.primaryObjective,
    max_risk_per_trade: contract.maxRiskPerTrade,
    max_trades: contract.maxTrades,
    stop_after_losses: contract.stopAfterLosses,
    allowed_sessions: contract.allowedSessions,
    allowed_instruments: contract.allowedInstruments,
    special_rules: contract.specialRules,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchDailyContracts(userId: string): Promise<DailyContract[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("daily_contracts")
    .select("*")
    .eq("user_id", userId)
    .order("contract_date", { ascending: true });

  if (error) throw error;
  return (data as DailyContractRow[]).map(rowToDailyContract);
}

// One commit per (account, day) — relies on the unique(user_id, account_type,
// account_id, contract_date) constraint from migration 009, so re-committing
// the same account on the same day overwrites rather than duplicating.
export async function upsertDailyContract(
  userId: string,
  contract: Omit<DailyContract, "id" | "committedAt">
): Promise<DailyContract> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("daily_contracts")
    .upsert(dailyContractToRow(contract, userId), {
      onConflict: "user_id,account_type,account_id,contract_date",
    })
    .select()
    .single();

  if (error) throw error;
  return rowToDailyContract(data as DailyContractRow);
}
