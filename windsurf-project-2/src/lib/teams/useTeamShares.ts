"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TeamAccountType } from "@/lib/teams/types";

export type TeamShareRow = {
  id: string;
  team_id: string;
  account_type: TeamAccountType;
  account_id: string;
  shared_by: string;
  created_at: string;
  revoked_at: string | null;
};

export function useTeamShares(teamId: string | null) {
  const [shares, setShares] = useState<TeamShareRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!teamId) { setShares([]); setError(null); return; }
    const { data, error: queryError } = await createClient()
      .from("team_account_shares").select("*")
      .eq("team_id", teamId).is("revoked_at", null)
      .order("created_at", { ascending: false });
    if (queryError) { setError(queryError.message); setShares([]); return; }
    setShares((data ?? []) as TeamShareRow[]);
    setError(null);
  }, [teamId]);
  useEffect(() => { void refresh(); }, [refresh]);

  const share = useCallback(async (type: TeamAccountType, accountId: string) => {
    if (!teamId) throw new Error("Select a team");
    const { error: rpcError } = await createClient().rpc("share_team_account", {
      p_team_id: teamId, p_type: type, p_account_id: accountId,
    });
    if (rpcError) throw rpcError;
    await refresh();
  }, [teamId, refresh]);

  const revoke = useCallback(async (shareId: string) => {
    const { error: rpcError } = await createClient().rpc("revoke_team_account_share", {
      p_share_id: shareId,
    });
    if (rpcError) throw rpcError;
    await refresh();
  }, [refresh]);

  return { shares, error, refresh, share, revoke };
}
