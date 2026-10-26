"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type TeamInvitation = {
  id: string;
  invited_email: string;
  role: "admin" | "member";
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};

export type IncomingInvitation = {
  id: string;
  team_id: string;
  team_name: string;
  role: "admin" | "member";
  expires_at: string;
};

export function useTeamInvitations(teamId: string | null, canManage: boolean) {
  const [outgoing, setOutgoing] = useState<TeamInvitation[]>([]);
  const [incoming, setIncoming] = useState<IncomingInvitation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const client = createClient();
    const pending = await client.rpc("list_my_team_invitations");
    if (pending.error) { setError(pending.error.message); return; }
    setIncoming((pending.data ?? []) as IncomingInvitation[]);
    if (!teamId || !canManage) { setOutgoing([]); return; }
    const result = await client.rpc("list_team_invitations", { p_team_id: teamId });
    if (result.error) { setError(result.error.message); return; }
    setOutgoing((result.data ?? []) as TeamInvitation[]);
    setError(null);
  }, [teamId, canManage]);

  useEffect(() => { void refresh(); }, [refresh]);

  const invite = useCallback(async (email: string, role: "admin" | "member") => {
    if (!teamId) throw new Error("Select a team");
    const { error: rpcError } = await createClient().rpc("invite_team_member", {
      p_team_id: teamId, p_email: email.trim(), p_role: role,
    });
    if (rpcError) throw rpcError;
    await refresh();
  }, [teamId, refresh]);

  const accept = useCallback(async (id: string) => {
    const { error: rpcError } = await createClient().rpc("accept_team_invitation", {
      p_invitation_id: id,
    });
    if (rpcError) throw rpcError;
    await refresh();
  }, [refresh]);

  const revoke = useCallback(async (id: string) => {
    const { error: rpcError } = await createClient().rpc("revoke_team_invitation", {
      p_invitation_id: id,
    });
    if (rpcError) throw rpcError;
    await refresh();
  }, [refresh]);

  return { outgoing, incoming, error, refresh, invite, accept, revoke };
}
