"use client";

import { useState } from "react";
import { useAccounts } from "@/context/AccountsContext";
import { useTeamShares } from "@/lib/teams/useTeamShares";
import { useSharedAccountSummaries } from "@/lib/teams/useSharedAccountSummaries";
import type { TeamAccountType } from "@/lib/teams/types";

export function TeamAccounts({ teamId, currentUserId }: { teamId: string; currentUserId: string | null }) {
  const { challenges, fundedAccounts } = useAccounts();
  const { shares, error, share, revoke } = useTeamShares(teamId);
  const { accounts, error: readError } = useSharedAccountSummaries(shares);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const owned = [
    ...challenges.map(a => ({ type: "challenge" as TeamAccountType, id: a.id, label: a.accountName })),
    ...fundedAccounts.map(a => ({ type: "funded" as TeamAccountType, id: a.id, label: a.accountName })),
  ].filter(a => !shares.some(s => s.account_id === a.id && s.account_type === a.type));

  async function handleShare() {
    const [type, id] = selected.split(":");
    if ((type !== "challenge" && type !== "funded") || !id) return;
    setBusy(true); setActionError(null);
    try { await share(type, id); setSelected(""); }
    catch (err) { setActionError(err instanceof Error ? err.message : "Unable to share"); }
    finally { setBusy(false); }
  }

  async function handleRevoke(id: string) {
    if (!window.confirm("Stop sharing this account with this team?")) return;
    setBusy(true); setActionError(null);
    try { await revoke(id); }
    catch (err) { setActionError(err instanceof Error ? err.message : "Unable to revoke"); }
    finally { setBusy(false); }
  }

  return (
    <section className="mt-6 rounded-xl border border-white/10 bg-slate-900 p-6">
      <h2 className="text-lg font-semibold">Shared Prop Firm accounts</h2>
      <p className="mt-2 text-sm text-slate-400">Shared accounts, trades and payouts are read-only for other team members.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <select value={selected} onChange={event => setSelected(event.target.value)}
          aria-label="Choose your account to share"
          className="min-w-48 flex-1 rounded-lg border border-white/20 bg-slate-950 p-3 text-sm">
          <option value="">Choose one of your accounts</option>
          {owned.map(a => <option key={a.type + a.id} value={a.type + ":" + a.id}>{a.label} ({a.type})</option>)}
        </select>
        <button type="button" disabled={!selected || busy} onClick={() => void handleShare()}
          className="rounded-lg bg-blue-600 px-4 py-3 text-sm disabled:opacity-50">Share account</button>
      </div>
      {(error || readError || actionError) && <p role="alert" className="mt-3 text-sm text-red-300">{error || readError || actionError}</p>}
      <ul className="mt-5 space-y-3">
        {accounts.map(a => {
          const shareRow = shares.find(s => s.account_id === a.id && s.account_type === a.type && s.shared_by === a.ownerId);
          return <li key={a.type + a.id + a.ownerId} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{a.name}</p>
                <p className="mt-1 text-sm text-slate-400">{a.type} · {a.status} · ${a.size.toLocaleString()} · {a.tradeCount} trades</p>
                {a.currentBalance !== null && <p className="mt-1 text-sm">Balance: ${a.currentBalance.toLocaleString()}</p>}
              </div>
              {shareRow?.shared_by === currentUserId && <button type="button" disabled={busy}
                onClick={() => void handleRevoke(shareRow.id)}
                className="text-sm text-red-300 disabled:opacity-50">Stop sharing</button>}
            </div>
            {a.payouts.length > 0 && <div className="mt-3 border-t border-white/10 pt-3">
              <p className="text-sm font-medium">Payout history</p>
              {a.payouts.map(p => <p key={p.id} className="mt-1 text-sm text-slate-300">
                {p.date} · {p.status} · requested ${p.requested.toLocaleString()} · received ${p.received.toLocaleString()}
              </p>)}
            </div>}
          </li>;
        })}
      </ul>
      {shares.length === 0 && <p className="mt-4 text-sm text-slate-400">No accounts shared with this team yet.</p>}
    </section>
  );
}
