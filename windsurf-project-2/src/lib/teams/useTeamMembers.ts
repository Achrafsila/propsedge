"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TeamMembership, TeamRole } from "@/lib/teams/types";

type MembershipRow = {
  team_id: string;
  user_id: string;
  role: TeamRole;
  joined_at: string;
};

export function useTeamMembers(teamId: string | null) {
  const [members, setMembers] = useState<TeamMembership[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!teamId) {
      setMembers([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await createClient()
      .from("team_members")
      .select("team_id,user_id,role,joined_at")
      .eq("team_id", teamId)
      .order("joined_at", { ascending: true });
    if (queryError) {
      setMembers([]);
      setError(queryError.message);
    } else {
      setMembers(((data ?? []) as MembershipRow[]).map(row => ({
        teamId: row.team_id,
        userId: row.user_id,
        role: row.role,
        joinedAt: row.joined_at,
      })));
    }
    setLoading(false);
  }, [teamId]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { members, loading, error, refresh };
}
