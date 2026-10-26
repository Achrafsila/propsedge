import { createClient } from "@/lib/supabase/client";
import { Trade, TradeStatus } from "@/types";

// ─── DB row shape ──────────────────────────────────────────────────────────────
interface TradeRow {
  id: string;
  user_id: string;
  account_id: string;
  account_type: string;
  entry_date: string;
  exit_date: string | null;
  entry_time: string | null;
  exit_time: string | null;
  session: string | null;
  symbol: string;
  direction: string;
  entry_price: number;
  exit_price: number;
  quantity: number;
  pnl: number;
  status: string;
  notes: string | null;
  picture: string | null;
  created_at: string;
  updated_at: string;
}

// ─── DB → TypeScript ──────────────────────────────────────────────────────────
function rowToTrade(row: TradeRow): Trade {
  return {
    id:          row.id,
    accountId:   row.account_id,
    accountType: row.account_type as "challenge" | "funded",
    entryDate:   row.entry_date,
    exitDate:    row.exit_date ?? row.entry_date,
    entryTime:   row.entry_time ?? undefined,
    exitTime:    row.exit_time ?? undefined,
    session:     (row.session as Trade["session"]) ?? undefined,
    symbol:      row.symbol,
    direction:   row.direction as "long" | "short",
    entryPrice:  row.entry_price,
    exitPrice:   row.exit_price,
    quantity:    row.quantity,
    pnl:         row.pnl,
    status:      row.status as TradeStatus,
    notes:       row.notes ?? undefined,
    picture:     row.picture ?? undefined,
  };
}

// ─── TypeScript → DB insert row ───────────────────────────────────────────────
function tradeToInsertRow(trade: Omit<Trade, "id">, userId: string) {
  return {
    user_id:      userId,
    account_id:   trade.accountId,
    account_type: trade.accountType,
    entry_date:   trade.entryDate,
    exit_date:    trade.exitDate ?? null,
    entry_time:   trade.entryTime ?? null,
    exit_time:    trade.exitTime ?? null,
    session:      trade.session ?? null,
    symbol:       trade.symbol,
    direction:    trade.direction,
    entry_price:  trade.entryPrice,
    exit_price:   trade.exitPrice,
    quantity:     trade.quantity,
    pnl:          trade.pnl,
    status:       trade.status,
    notes:        trade.notes ?? null,
    picture:      trade.picture ?? null,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchTrades(userId: string): Promise<Trade[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .eq("user_id", userId)
    .order("entry_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data as TradeRow[]).map(rowToTrade);
}

export async function insertTrade(
  userId: string,
  trade: Omit<Trade, "id">
): Promise<Trade> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("trades")
    .insert(tradeToInsertRow(trade, userId))
    .select()
    .single();

  if (error) throw error;
  return rowToTrade(data as TradeRow);
}

// Inserts many trades in a single request — one bulk INSERT instead of one
// request per row. Used by bulk CSV import (see addTradesBatch in
// AccountsContext), which chunks a large import into batches and calls
// this once per chunk, so a 2000-row file becomes ~8 requests instead of
// ~2000. Every row is stamped with the same userId, matching the
// single-row insertTrade()'s behavior.
export async function insertTradesBatch(
  userId: string,
  trades: Omit<Trade, "id">[]
): Promise<Trade[]> {
  if (trades.length === 0) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("trades")
    .insert(trades.map((t) => tradeToInsertRow(t, userId)))
    .select();

  if (error) throw error;
  return (data as TradeRow[]).map(rowToTrade);
}

export async function updateTradeDb(id: string, accountId: string, accountType: "challenge" | "funded", patch: Partial<Trade>): Promise<Trade> {
  const fields: Record<string, unknown> = {};
  if (patch.entryDate !== undefined) fields.entry_date = patch.entryDate;
  if (patch.exitDate !== undefined) fields.exit_date = patch.exitDate;
  if (patch.symbol !== undefined) fields.symbol = patch.symbol;
  if (patch.direction !== undefined) fields.direction = patch.direction;
  if (patch.entryPrice !== undefined) fields.entry_price = patch.entryPrice;
  if (patch.exitPrice !== undefined) fields.exit_price = patch.exitPrice;
  if (patch.quantity !== undefined) fields.quantity = patch.quantity;
  if (patch.pnl !== undefined) { fields.pnl = patch.pnl; fields.status = patch.pnl > 0 ? "win" : patch.pnl < 0 ? "loss" : "breakeven"; }
  if (patch.notes !== undefined) fields.notes = patch.notes;
  const { data, error } = await createClient().from("trades").update(fields)
    .eq("id", id).eq("account_id", accountId).eq("account_type", accountType).select().single();
  if (error) throw error;
  return rowToTrade(data as TradeRow);
}

export async function deleteTradeDb(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("trades")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// Deletes every trade linked to a given account. Used to clear an account's
// trades before the account itself is deleted (see AccountsContext), so no
// trade is ever left pointing at an account that no longer exists.
export async function deleteTradesByAccountDb(
  accountId: string,
  accountType: "challenge" | "funded"
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("trades")
    .delete()
    .eq("account_id", accountId)
    .eq("account_type", accountType);

  if (error) throw error;
}

// Bulk-deletes trades by id. Used for the orphan-trade cleanup on app
// initialization (trades whose account was deleted before this cascade
// existed) — an arbitrary set of ids, potentially spanning several
// now-missing accounts.
export async function deleteTradesByIdsDb(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase
    .from("trades")
    .delete()
    .in("id", ids);

  if (error) throw error;
}
