"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTeamInvitations } from "@/lib/teams/useTeamInvitations";
import { useTeamMemberActions } from "@/lib/teams/useTeamMemberActions";
import { TeamAccounts } from "./TeamAccounts";
import { useTeams } from "@/lib/teams/useTeams";
import { useTeamMembers } from "@/lib/teams/useTeamMembers";

export default function TeamsPage() {
  const { teams, loading, error, createTeam, deleteTeam } = useTeams();
  const [name, setName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{id:string;name:string}|null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteFailure, setInviteFailure] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void createClient().auth.getUser().then(({ data }) => {
      if (active) setUserId(data.user?.id ?? null);
    });
    return () => { active = false; };
  }, []);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectionDismissed, setSelectionDismissed] = useState(false);
  useEffect(() => {
    if (!loading && !selectionDismissed && teams.length > 0 && !teams.some(team => team.id === selectedTeamId)) {
      setSelectedTeamId(teams[0].id);
    }
  }, [loading, teams, selectedTeamId, selectionDismissed]);
  const { members, loading: membersLoading, error: membersError, refresh: refreshMembers } = useTeamMembers(selectedTeamId);
  const selectedTeam = teams.find(team => team.id === selectedTeamId);
  const { changeRole, removeMember, busy: memberBusy } = useTeamMemberActions(selectedTeamId);
  const currentRole = members.find(member => member.userId === userId)?.role;
  const canManage = currentRole === "owner" || currentRole === "admin";
  const { incoming, outgoing, error: invitationsError, invite, accept, revoke, refresh: refreshInvitations } =
    useTeamInvitations(selectedTeamId, canManage);

  async function updateMember(action: "remove" | "promote" | "demote", memberId: string) {
    setInviteFailure(null);
    if (action === "remove" && !window.confirm("Remove this member from the team?")) return;
    try {
      if (action === "remove") await removeMember(memberId);
      else await changeRole(memberId, action === "promote" ? "admin" : "member");
      await refreshMembers();
    } catch (err) {
      setInviteFailure(err instanceof Error ? err.message : "Unable to update member");
    }
  }

  async function sendInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviteBusy(true);
    setInviteFailure(null);
    try {
      await invite(inviteEmail, inviteRole);
      setInviteEmail("");
    } catch (err) {
      setInviteFailure(err instanceof Error ? err.message : "Invitation failed");
    } finally {
      setInviteBusy(false);
    }
  }

  async function acceptInvite(id: string) {
    try {
      await accept(id);
      await refreshInvitations();
      window.location.reload();
    } catch (err) {
      setInviteFailure(err instanceof Error ? err.message : "Unable to accept invitation");
    }
  }
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function confirmDelete() {
    if(!deleteTarget || deleteConfirmation !== deleteTarget.name || deleting) return;
    setDeleting(true); setFailure(null);
    try {
      await deleteTeam(deleteTarget.id);
      if(selectedTeamId === deleteTarget.id) {setSelectedTeamId(null);setSelectionDismissed(false);}
      setDeleteTarget(null);setDeleteConfirmation("");
    } catch(err) {setFailure(err instanceof Error?err.message:"Unable to delete team");}
    finally {setDeleting(false);}
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFailure(null);
    try {
      await createTeam(name);
      setName("");
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Creation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-8 text-slate-100">
      <h1 className="text-3xl font-semibold">Team Workspace</h1>
      <p className="mt-2 text-slate-400">Your trading accounts stay private until you explicitly share them.</p>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-white/10 bg-slate-900 p-6">
          <h2 className="mb-4 text-lg font-semibold">Your teams</h2>
          {loading && <p role="status">Loading…</p>}
          {error && <p role="alert" className="text-red-300">{error}</p>}
          {!loading && !error && teams.length === 0 && <p className="text-slate-400">No teams yet.</p>}
          <ul className="space-y-3">
            {teams.map(team => <li key={team.id} className="flex items-center gap-2">
              <button type="button" onClick={() => { setSelectionDismissed(false); setSelectedTeamId(team.id); }}
                aria-pressed={selectedTeamId === team.id}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedTeamId === team.id ? "border-blue-400 bg-blue-500/15" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
                {team.name}
              </button>
              {team.ownerUserId === userId && <button type="button" aria-label={`Delete team ${team.name}`} title="Delete team" onClick={()=>{setDeleteTarget({id:team.id,name:team.name});setDeleteConfirmation("");}} className="min-h-11 shrink-0 rounded-lg border border-rose-500/25 px-3 text-sm text-rose-300 hover:bg-rose-500/10">Delete</button>}
            </li>)}
          </ul>
        </section>
        <section className="rounded-xl border border-white/10 bg-slate-900 p-6">
          <h2 className="mb-4 text-lg font-semibold">Create a team</h2>
          <form onSubmit={submit} className="space-y-4">
            <label htmlFor="team-name" className="block text-sm">Team name</label>
            <input id="team-name" required minLength={2} maxLength={100}
              value={name} onChange={event => setName(event.target.value)}
              className="w-full rounded-lg border border-white/20 bg-slate-950 p-3" />
            <button disabled={busy || name.trim().length < 2} type="submit"
              className="rounded-lg bg-blue-600 px-5 py-3 disabled:opacity-50">
              {busy ? "Creating…" : "Create team"}
            </button>
            {failure && <p role="alert" className="text-red-300">{failure}</p>}
          </form>
        </section>
      </div>
      {deleteTarget && <div role="alertdialog" aria-modal="true" aria-labelledby="delete-team-title" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3">
        <div className="w-full max-w-sm rounded-2xl border border-rose-500/30 bg-[#111b2d] p-4 shadow-2xl sm:p-6">
          <h2 id="delete-team-title" className="text-lg font-bold">Delete team?</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">Deleting <strong>{deleteTarget.name}</strong> removes memberships, invitations, shared-account access and team notes permanently. Your original trading accounts, trades and payouts remain untouched.</p>
          <label className="mt-4 block text-xs text-slate-300">Type the exact team name to confirm
            <input autoFocus value={deleteConfirmation} onChange={e=>setDeleteConfirmation(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white/20 bg-slate-950 px-3 text-base text-white" placeholder={deleteTarget.name}/>
          </label>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={()=>setDeleteTarget(null)} disabled={deleting} className="min-h-11 rounded-xl border border-white/20 text-sm">Cancel</button>
            <button type="button" onClick={()=>void confirmDelete()} disabled={deleting||deleteConfirmation!==deleteTarget.name} className="min-h-11 rounded-xl bg-rose-600 px-2 text-sm font-bold disabled:opacity-40">{deleting?"Deleting…":"Delete permanently"}</button>
          </div>
        </div>
      </div>}
      {inviteFailure && !canManage && <p role="alert" className="mt-4 text-sm text-red-300">{inviteFailure}</p>}
      {invitationsError && !canManage && <p role="alert" className="mt-4 text-sm text-red-300">{invitationsError}</p>}
      {incoming.length > 0 && (
        <section className="mt-6 rounded-xl border border-blue-400/30 bg-slate-900 p-6">
          <h2 className="text-lg font-semibold">Invitations for you</h2>
          <ul className="mt-4 space-y-3">
            {incoming.map(item => <li key={item.id} className="flex items-center justify-between gap-4 rounded-lg bg-white/5 p-3">
              <span>{item.team_name} <span className="text-sm text-slate-400">({item.role})</span></span>
              <button type="button" onClick={() => void acceptInvite(item.id)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm">Accept</button>
            </li>)}
          </ul>
        </section>
      )}
      {selectedTeam && <TeamAccounts teamId={selectedTeam.id} currentUserId={userId} />}
      {selectedTeam && (
        <section className="mt-6 rounded-xl border border-white/10 bg-slate-900 p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{selectedTeam.name} — Members</h2>
            <button type="button" onClick={() => { setSelectionDismissed(true); setSelectedTeamId(null); }} className="text-sm text-slate-400 hover:text-white">Close</button>
          </div>
          <p className="mt-2 text-sm text-slate-400">Manage access to shared trading accounts. Financial records remain editable only by their owner.</p>
          {membersLoading && <p className="mt-4 text-sm" role="status">Loading members…</p>}
          {membersError && <p className="mt-4 text-sm text-red-300" role="alert">{membersError}</p>}
          {!membersLoading && !membersError && <ul className="mt-4 space-y-2">
            {members.map(member => <li key={member.userId} className="flex justify-between gap-4 rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
              <span className="truncate text-slate-300">{member.userId === userId ? "You" : `Member ${member.userId.slice(0, 8)}`}</span>
              <span className="flex flex-wrap items-center justify-end gap-3">
                <span className="capitalize text-blue-300">{member.role}</span>
                {member.role !== "owner" && (currentRole === "owner" || (currentRole === "admin" && member.role === "member")) && (
                  <button type="button" disabled={memberBusy} onClick={() => void updateMember("remove", member.userId)}
                    className="text-red-300 hover:text-red-200 disabled:opacity-50">Remove</button>
                )}
                {currentRole === "owner" && member.role !== "owner" && (
                  <button type="button" disabled={memberBusy}
                    onClick={() => void updateMember(member.role === "admin" ? "demote" : "promote", member.userId)}
                    className="text-blue-300 hover:text-blue-200 disabled:opacity-50">
                    {member.role === "admin" ? "Make member" : "Make admin"}
                  </button>
                )}
              </span>
            </li>)}
          </ul>}
          {canManage && (
            <div className="mt-6 border-t border-white/10 pt-5">
              <h3 className="font-semibold">Invite a member</h3>
              <p className="mt-1 text-sm text-slate-400">The recipient accepts from their verified email account. No email is automatically sent.</p>
              <form onSubmit={sendInvite} className="mt-4 flex flex-wrap gap-3">
                <input type="email" required value={inviteEmail} onChange={event => setInviteEmail(event.target.value)}
                  placeholder="email@example.com" aria-label="Invitee email"
                  className="min-w-48 flex-1 rounded-lg border border-white/20 bg-slate-950 p-3 text-sm" />
                <select value={inviteRole} onChange={event => setInviteRole(event.target.value as "admin" | "member")}
                  aria-label="Invitation role" className="rounded-lg border border-white/20 bg-slate-950 p-3 text-sm">
                  <option value="member">Member</option>
                  {currentRole === "owner" && <option value="admin">Admin</option>}
                </select>
                <button type="submit" disabled={inviteBusy} className="rounded-lg bg-blue-600 px-4 py-3 text-sm disabled:opacity-50">
                  {inviteBusy ? "Inviting…" : "Invite"}
                </button>
              </form>
              {inviteFailure && <p role="alert" className="mt-2 text-sm text-red-300">{inviteFailure}</p>}
              {invitationsError && <p role="alert" className="mt-2 text-sm text-red-300">{invitationsError}</p>}
              {outgoing.filter(item => !item.accepted_at && !item.revoked_at).length > 0 && (
                <ul className="mt-4 space-y-2">
                  {outgoing.filter(item => !item.accepted_at && !item.revoked_at).map(item =>
                    <li key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 p-3 text-sm">
                      <span className="truncate">{item.invited_email} · {item.role}</span>
                      <button type="button" onClick={() => void revoke(item.id).catch(err => setInviteFailure(String(err)))}
                        className="text-red-300 hover:text-red-200">Revoke</button>
                    </li>)}
                </ul>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
