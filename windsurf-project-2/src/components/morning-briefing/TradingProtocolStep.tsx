"use client";

import { Check } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { AccountBriefing } from "@/lib/analytics/aiCoach";
import { fmt$ } from "./formatters";

// Default protocol — a future version may let the trader customize this
// list; V1 always shows the same seven commitments.
const DEFAULT_CHECKLIST_ITEMS = [
  "Economic calendar checked",
  "Key levels marked",
  "News reviewed",
  "Maximum risk accepted",
  "Only A+ setups",
  "No revenge trading",
  "Accept missing opportunities",
];

function accountRowId(briefing: AccountBriefing): string {
  return `account-${briefing.account.type}-${briefing.account.id}`;
}

// The full set of row ids for a given day's briefings — the parent
// orchestrator uses this (not a hardcoded count) to know when every row is
// checked, since the account rows depend on how many active accounts exist.
export function getProtocolRowIds(briefings: AccountBriefing[]): string[] {
  return [...briefings.map(accountRowId), ...DEFAULT_CHECKLIST_ITEMS.map((_, i) => `default-${i}`)];
}

function accountRowLabel(briefing: AccountBriefing): string {
  const riskLabel =
    briefing.mode === "near_breach" || briefing.mode === "no_trading"
      ? "no trading today"
      : `max risk ${briefing.recommendedRisk.amount !== null ? fmt$(briefing.recommendedRisk.amount) : "—"}`;
  const stopLabel = briefing.stopAfterLosses !== null ? `stop after ${briefing.stopAfterLosses} loss${briefing.stopAfterLosses === 1 ? "" : "es"}` : null;
  const tradesLabel = briefing.maxTrades !== null ? `max ${briefing.maxTrades} trade${briefing.maxTrades === 1 ? "" : "s"}` : null;
  const parts = [riskLabel, stopLabel, tradesLabel].filter((p): p is string => p !== null);
  return `${briefing.account.name} — ${parts.join(", ")}`;
}

function ChecklistRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-left pointer-events-auto"
      style={{
        background: checked ? "rgba(16,185,129,0.08)" : "rgba(148,163,184,0.04)",
        border: checked ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(148,163,184,0.08)",
      }}
    >
      <span
        className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
        style={{
          background: checked ? "#10B981" : "transparent",
          border: checked ? "none" : "1px solid rgba(148,163,184,0.35)",
        }}
      >
        {checked && <Check className="w-3.5 h-3.5 text-black" />}
      </span>
      <span className={checked ? "text-[#F8FAFC]" : "text-[#CBD5E1]"} style={{ fontSize: typography.fontSize.sm }}>
        {label}
      </span>
    </button>
  );
}

export function TradingProtocolStep({
  briefings,
  checked,
  onToggle,
}: {
  briefings: AccountBriefing[];
  checked: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="w-full">
      <h2 className="text-[#F8FAFC] font-bold text-center mb-2" style={{ fontSize: typography.fontSize["2xl"] }}>
        Trading Protocol
      </h2>
      <p className="text-[#94A3B8] text-center mb-6" style={{ fontSize: typography.fontSize.sm }}>
        Check every item to commit to today&apos;s session.
      </p>
      <div
        className="rounded-xl p-4 space-y-2"
        style={{
          background: glassmorphism.card.background,
          backdropFilter: glassmorphism.card.backdropBlur,
          border: "1px solid rgba(148,163,184,0.08)",
          borderRadius: borderRadius.xl,
        }}
      >
        {briefings.map((b) => {
          const id = accountRowId(b);
          return <ChecklistRow key={id} label={accountRowLabel(b)} checked={!!checked[id]} onToggle={() => onToggle(id)} />;
        })}
        {DEFAULT_CHECKLIST_ITEMS.map((item, i) => {
          const id = `default-${i}`;
          return <ChecklistRow key={id} label={item} checked={!!checked[id]} onToggle={() => onToggle(id)} />;
        })}
      </div>
    </div>
  );
}
