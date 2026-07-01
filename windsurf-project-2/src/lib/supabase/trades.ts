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

export async function deleteTradeDb(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("trades")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
