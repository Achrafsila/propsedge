import { createClient } from "@/lib/supabase/client";
import { Payout, PayoutStatus } from "@/types";

// ─── DB row shape ──────────────────────────────────────────────────────────────
interface PayoutRow {
  id: string;
  user_id: string;
  funded_account_id: string;
  payout_date: string;
  generated_profit: number;
  requested_amount: number;
  received_amount: number;
  prop_firm_split: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── DB → TypeScript ──────────────────────────────────────────────────────────
function rowToPayout(row: PayoutRow): Payout {
  return {
    id:                     row.id,
    fundedAccountId:        row.funded_account_id,
    payoutDate:             row.payout_date,
    generatedProfit:        row.generated_profit,
    requestedPayoutAmount:  row.requested_amount,
    receivedPayoutAmount:   row.received_amount,
    propFirmSplitPercentage: row.prop_firm_split,
    status:                 row.status as PayoutStatus,
    notes:                  row.notes ?? undefined,
  };
}

// ─── TypeScript → DB insert row ───────────────────────────────────────────────
function payoutToInsertRow(payout: Omit<Payout, "id">, userId: string) {
  return {
    user_id:           userId,
    funded_account_id: payout.fundedAccountId,
    payout_date:       payout.payoutDate,
    generated_profit:  payout.generatedProfit,
    requested_amount:  payout.requestedPayoutAmount,
    received_amount:   payout.receivedPayoutAmount,
    prop_firm_split:   payout.propFirmSplitPercentage,
    status:            payout.status,
    notes:             payout.notes ?? null,
  };
}

// ─── TypeScript (partial) → DB update row ────────────────────────────────────
function payoutToUpdateRow(updates: Partial<Payout>): Record<string, unknown> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (updates.fundedAccountId        !== undefined) row.funded_account_id = updates.fundedAccountId;
  if (updates.payoutDate             !== undefined) row.payout_date       = updates.payoutDate;
  if (updates.generatedProfit        !== undefined) row.generated_profit  = updates.generatedProfit;
  if (updates.requestedPayoutAmount  !== undefined) row.requested_amount  = updates.requestedPayoutAmount;
  if (updates.receivedPayoutAmount   !== undefined) row.received_amount   = updates.receivedPayoutAmount;
  if (updates.propFirmSplitPercentage !== undefined) row.prop_firm_split  = updates.propFirmSplitPercentage;
  if (updates.status                 !== undefined) row.status            = updates.status;
  if (updates.notes                  !== undefined) row.notes             = updates.notes ?? null;

  return row;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchPayouts(userId: string): Promise<Payout[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("payouts")
    .select("*")
    .eq("user_id", userId)
    .order("payout_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as PayoutRow[]).map(rowToPayout);
}

export async function insertPayout(
  userId: string,
  payout: Omit<Payout, "id">
): Promise<Payout> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("payouts")
    .insert(payoutToInsertRow(payout, userId))
    .select()
    .single();

  if (error) throw error;
  return rowToPayout(data as PayoutRow);
}

export async function updatePayoutDb(
  id: string,
  updates: Partial<Payout>
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("payouts")
    .update(payoutToUpdateRow(updates))
    .eq("id", id);

  if (error) throw error;
}

export async function deletePayoutDb(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("payouts")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
