"use client";

import { useState } from "react";
import { useTeams } from "@/lib/teams/useTeams";

export default function TeamsPage() {
  const { teams, loading, error, createTeam } = useTeams();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

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
            {teams.map(team => <li key={team.id} className="rounded-lg bg-white/5 p-3">{team.name}</li>)}
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
    </main>
  );
}
