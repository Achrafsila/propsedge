"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TeamRole } from "@/lib/teams/types";

export function useTeamMemberActions(teamId: string | null) {
  const [busy, setBusy] = useState(false);

  const changeRole = useCallback(async (userId: string, role: Exclude<TeamRole, "owner">) => {
    if (!teamId) throw new Error("Select a team");
    setBusy(true);
    try {
      const { error } = await createClient().rpc("change_team_member_role", {
        p_team_id: teamId, p_user_id: userId, p_role: role,
      });
      if (error) throw error;
    } finally {
      setBusy(false);
    }
  }, [teamId]);

  const removeMember = useCallback(async (userId: string) => {
    if (!teamId) throw new Error("Select a team");
    setBusy(true);
    try {
      const { error } = await createClient().rpc("remove_team_member", {
        p_team_id: teamId, p_user_id: userId,
      });
      if (error) throw error;
    } finally {
      setBusy(false);
    }
  }, [teamId]);

  return { changeRole, removeMember, busy };
}
