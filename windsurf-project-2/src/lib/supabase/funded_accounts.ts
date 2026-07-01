import { createClient } from "@/lib/supabase/client";
import { FundedAccount, FundedAccountStatus } from "@/types";

// ─── DB row shape ──────────────────────────────────────────────────────────────
interface FundedAccountRow {
  id: string;
  user_id: string;
  source_challenge_id: string | null;
  prop_firm: string;
  account_name: string;
  account_size: number;
  plan_type: string | null;
  funding_date: string;
  initial_balance: number;
  current_balance: number;
  current_profit: number;
  max_drawdown: number;
  remaining_buffer: number;
  status: string;
  created_at: string;
  updated_at: string;
}

// ─── DB → TypeScript ──────────────────────────────────────────────────────────
function rowToFundedAccount(row: FundedAccountRow): FundedAccount {
  return {
    id:                row.id,
    propFirmName:      row.prop_firm,
    accountName:       row.account_name,
    sourceChallengeId: row.source_challenge_id ?? undefined,
    accountSize:       row.account_size,
    planType:          row.plan_type ?? undefined,
    fundingDate:       row.funding_date,
    initialBalance:    row.initial_balance,
    currentBalance:    row.current_balance,
    currentProfit:     row.current_profit,
    maxDrawdown:       row.max_drawdown,
    remainingDrawdown: row.remaining_buffer,   // DB column: remaining_buffer
    status:            row.status as FundedAccountStatus,
  };
}

// ─── TypeScript (full) → DB insert row ───────────────────────────────────────
function accountToInsertRow(account: Omit<FundedAccount, "id">, userId: string) {
  return {
    user_id:            userId,
    source_challenge_id: account.sourceChallengeId ?? null,
    prop_firm:          account.propFirmName,
    account_name:       account.accountName,
    account_size:       account.accountSize,
    plan_type:          account.planType ?? null,
    funding_date:       account.fundingDate,
    initial_balance:    account.initialBalance,
    current_balance:    account.currentBalance,
    current_profit:     account.currentProfit,
    max_drawdown:       account.maxDrawdown,
    remaining_buffer:   account.remainingDrawdown,  // TS: remainingDrawdown → DB: remaining_buffer
    status:             account.status,
  };
}

// ─── TypeScript (partial) → DB update row ────────────────────────────────────
function accountToUpdateRow(updates: Partial<FundedAccount>): Record<string, unknown> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (updates.propFirmName      !== undefined) row.prop_firm         = updates.propFirmName;
  if (updates.accountName       !== undefined) row.account_name      = updates.accountName;
  if (updates.sourceChallengeId !== undefined) row.source_challenge_id = updates.sourceChallengeId ?? null;
  if (updates.accountSize       !== undefined) row.account_size      = updates.accountSize;
  if (updates.planType          !== undefined) row.plan_type         = updates.planType ?? null;
  if (updates.fundingDate       !== undefined) row.funding_date      = updates.fundingDate;
  if (updates.initialBalance    !== undefined) row.initial_balance   = updates.initialBalance;
  if (updates.currentBalance    !== undefined) row.current_balance   = updates.currentBalance;
  if (updates.currentProfit     !== undefined) row.current_profit    = updates.currentProfit;
  if (updates.maxDrawdown       !== undefined) row.max_drawdown      = updates.maxDrawdown;
  if (updates.remainingDrawdown !== undefined) row.remaining_buffer  = updates.remainingDrawdown;
  if (updates.status            !== undefined) row.status            = updates.status;

  return row;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchFundedAccounts(userId: string): Promise<FundedAccount[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("funded_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as FundedAccountRow[]).map(rowToFundedAccount);
}

export async function insertFundedAccount(
  userId: string,
  account: Omit<FundedAccount, "id">
): Promise<FundedAccount> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("funded_accounts")
    .insert(accountToInsertRow(account, userId))
    .select()
    .single();

  if (error) throw error;
  return rowToFundedAccount(data as FundedAccountRow);
}

export async function updateFundedAccountDb(
  id: string,
  updates: Partial<FundedAccount>
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("funded_accounts")
    .update(accountToUpdateRow(updates))
    .eq("id", id);

  if (error) throw error;
}

export async function deleteFundedAccountDb(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("funded_accounts")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
