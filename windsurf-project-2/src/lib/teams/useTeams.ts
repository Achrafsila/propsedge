"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Team } from "@/lib/teams/types";

type TeamRow = {
  id: string;
  name: string;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
};

function mapTeam(row: TeamRow): Team {
  return {
    id: row.id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Read-only membership list plus atomic team creation.
 * This hook is not mounted until the Teams migration and RLS tests pass.
 */
export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createClient();
      const { data, error: queryError } = await client
        .from("teams")
        .select("id,name,owner_user_id,created_at,updated_at")
        .order("created_at", { ascending: false });
      if (queryError) throw queryError;
      setTeams(((data ?? []) as TeamRow[]).map(mapTeam));
    } catch (err) {
      setTeams([]);
      setError(err instanceof Error ? err.message : "Unable to load teams");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const createTeam = useCallback(async (name: string): Promise<string> => {
    const normalized = name.trim();
    if (normalized.length < 2 || normalized.length > 100) {
      throw new Error("Team name must contain 2 to 100 characters");
    }
    const client = createClient();
    const { data, error: rpcError } = await client.rpc("create_team", { p_name: normalized });
    if (rpcError) throw rpcError;
    if (typeof data !== "string") throw new Error("Unexpected team creation response");
    await refresh();
    return data;
  }, [refresh]);

  return { teams, loading, error, refresh, createTeam };
}
