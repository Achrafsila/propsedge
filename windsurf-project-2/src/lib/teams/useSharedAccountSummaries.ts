"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TeamShareRow } from "./useTeamShares";

export type SharedAccountSummary = {
  id: string;
  ownerId: string;
  type: "challenge" | "funded";
  name: string;
  status: string;
  size: number;
  currentBalance: number | null;
  tradeCount: number;
  trades: { id: string; symbol: string; date: string; pnl: number; status: string }[];
  payouts: { id: string; requested: number; received: number; status: string; date: string }[];
};

type AccountRow = {
  id: string; user_id: string; account_name: string; status: string;
  account_size: number; current_balance?: number | null;
};
type TradeRow = { id: string; account_id: string; user_id: string; account_type: string; symbol: string; entry_date: string; pnl: number; status: string };
type PayoutRow = {
  id: string; funded_account_id: string; user_id: string;
  requested_amount: number; received_amount: number; status: string; payout_date: string;
};

/** Read-only, team-scoped view. Never mix into the private AccountsContext. */
export function useSharedAccountSummaries(shares: TeamShareRow[]) {
  const [accounts, setAccounts] = useState<SharedAccountSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!shares.length) { setAccounts([]); setError(null); return; }
      const client = createClient();
      const challengeIds = shares.filter(s => s.account_type === "challenge").map(s => s.account_id);
      const fundedIds = shares.filter(s => s.account_type === "funded").map(s => s.account_id);
      const ids = shares.map(s => s.account_id);
      const [challenges, funded, trades, payouts] = await Promise.all([
        challengeIds.length ? client.from("challenge_accounts").select("id,user_id,account_name,status,account_size").in("id", challengeIds) : Promise.resolve({ data: [] as AccountRow[], error: null }),
        fundedIds.length ? client.from("funded_accounts").select("id,user_id,account_name,status,account_size,current_balance").in("id", fundedIds) : Promise.resolve({ data: [] as AccountRow[], error: null }),
        client.from("trades").select("id,account_id,user_id,account_type,symbol,entry_date,pnl,status").in("account_id", ids),
        fundedIds.length ? client.from("payouts").select("id,funded_account_id,user_id,requested_amount,received_amount,status,payout_date").in("funded_account_id", fundedIds) : Promise.resolve({ data: [] as PayoutRow[], error: null }),
      ]);
      const firstError = [challenges.error, funded.error, trades.error, payouts.error].find(Boolean);
      if (!active) return;
      if (firstError) { setError(firstError.message); setAccounts([]); return; }
      const accountRows = [...((challenges.data ?? []) as AccountRow[]), ...((funded.data ?? []) as AccountRow[])];
      const tradeRows = (trades.data ?? []) as TradeRow[];
      const payoutRows = (payouts.data ?? []) as PayoutRow[];
      setAccounts(shares.flatMap(share => {
        const row = accountRows.find(a => a.id === share.account_id && a.user_id === share.shared_by);
        if (!row) return [];
        return [{
          id: row.id, ownerId: share.shared_by, type: share.account_type,
          name: row.account_name, status: row.status, size: Number(row.account_size),
          currentBalance: row.current_balance == null ? null : Number(row.current_balance),
          tradeCount: tradeRows.filter(t => t.account_id === row.id && t.user_id === share.shared_by && t.account_type === share.account_type).length,
          trades: tradeRows.filter(t => t.account_id === row.id && t.user_id === share.shared_by && t.account_type === share.account_type)
            .map(t => ({ id: t.id, symbol: t.symbol, date: t.entry_date, pnl: Number(t.pnl), status: t.status })),
          payouts: share.account_type === "funded"
            ? payoutRows.filter(p => p.funded_account_id === row.id && p.user_id === share.shared_by)
                .map(p => ({ id: p.id, requested: Number(p.requested_amount), received: Number(p.received_amount), status: p.status, date: p.payout_date }))
            : [],
        }];
      }));
      setError(null);
    };
    void load();
    return () => { active = false; };
  }, [shares]);

  return { accounts, error };
}
