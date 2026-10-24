"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TeamAccountType } from "@/lib/teams/types";

type Note = { id: string; author_user_id: string; body: string; created_at: string };

export function TeamAccountNotes({ teamId, accountType, accountId, userId }: {
  teamId: string; accountType: TeamAccountType; accountId: string; userId: string | null;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error: queryError } = await createClient().from("team_notes")
      .select("id,author_user_id,body,created_at")
      .eq("team_id", teamId).eq("account_type", accountType).eq("account_id", accountId)
      .order("created_at", { ascending: false });
    if (queryError) { setError(queryError.message); return; }
    setNotes((data ?? []) as Note[]);
    setError(null);
  }, [teamId, accountType, accountId]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function addNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !body.trim()) return;
    setBusy(true);
    const { error: insertError } = await createClient().from("team_notes").insert({
      team_id: teamId, account_type: accountType, account_id: accountId,
      author_user_id: userId, body: body.trim(),
    });
    if (insertError) setError(insertError.message);
    else { setBody(""); await refresh(); }
    setBusy(false);
  }

  async function deleteNote(id: string) {
    if (!window.confirm("Delete this note?")) return;
    const { error: deleteError } = await createClient().from("team_notes").delete().eq("id", id);
    if (deleteError) setError(deleteError.message);
    else await refresh();
  }

  return <div className="mt-4 border-t border-white/10 pt-4">
    <h3 className="text-sm font-semibold">Team notes</h3>
    <form onSubmit={addNote} className="mt-2 flex flex-col gap-2">
      <textarea value={body} maxLength={2000} rows={2} onChange={event => setBody(event.target.value)}
        placeholder="Add a collaboration note…" aria-label="New team note"
        className="w-full rounded-lg border border-white/20 bg-slate-950 p-3 text-sm" />
      <button type="submit" disabled={!userId || busy || !body.trim()}
        className="self-end rounded-lg bg-blue-600 px-4 py-2 text-sm disabled:opacity-50">Add note</button>
    </form>
    {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
    <ul className="mt-3 space-y-2">
      {notes.map(note => <li key={note.id} className="rounded-lg bg-white/5 p-3 text-sm">
        <p className="whitespace-pre-wrap break-words">{note.body}</p>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-400">
          <span>{new Date(note.created_at).toLocaleString()} · {note.author_user_id === userId ? "You" : "Team member"}</span>
          {note.author_user_id === userId && <button type="button" onClick={() => void deleteNote(note.id)}
            className="text-red-300">Delete</button>}
        </div>
      </li>)}
    </ul>
  </div>;
}
