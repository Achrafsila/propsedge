"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { AccountBriefing } from "@/lib/analytics/aiCoach";
import { DailyContractDraft } from "@/lib/analytics/dailyContract";
import { fmt$ } from "./formatters";

// ============================================================
// PropEdge — Trading Protocol step (EdgePilot V2: Daily Trading Contract)
// ============================================================
// V1 of this step only showed EdgePilot's own numbers read-only, gated by
// seven generic agree/disagree checkboxes that were discarded the moment
// the modal closed — nothing the trader "committed to" ever persisted or
// got checked against later (see MorningBriefing.tsx's old handleStart).
// This version replaces that with the real thing: per-account editable
// numbers, seeded from the same recommendation (buildContractDraft in
// src/lib/analytics/dailyContract.ts), that the parent persists via
// DailyContractsContext when "I Commit" is pressed — this is what the
// Accountability Engine audits against for the rest of the day.

const SESSIONS: ("London" | "New York" | "Asian")[] = ["London", "New York", "Asian"];

export function accountKey(briefing: AccountBriefing): string {
  return `${briefing.account.type}-${briefing.account.id}`;
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-semibold pointer-events-auto transition-colors"
      style={{
        background: active ? "rgba(41,141,255,0.16)" : "rgba(148,163,184,0.06)",
        border: active ? "1px solid rgba(41,141,255,0.5)" : "1px solid rgba(148,163,184,0.15)",
        color: active ? "#298DFF" : "#94A3B8",
      }}
    >
      {label}
    </button>
  );
}

function NumberField({
  label,
  value,
  onChange,
  prefix,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  prefix?: string;
}) {
  return (
    <label className="block">
      <span className="text-[#64748B] uppercase block mb-1" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
        {label}
      </span>
      <div className="flex items-center rounded-lg" style={{ background: "rgba(148,163,184,0.04)", border: "1px solid rgba(148,163,184,0.15)" }}>
        {prefix && <span className="pl-3 text-[#64748B] text-sm">{prefix}</span>}
        <input
          type="number"
          min={0}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className="w-full bg-transparent px-3 py-2 text-sm text-[#F8FAFC] outline-none pointer-events-auto"
        />
      </div>
    </label>
  );
}

function AccountContractCard({
  briefing,
  draft,
  onChange,
  instrumentOptions,
}: {
  briefing: AccountBriefing;
  draft: DailyContractDraft;
  onChange: (patch: Partial<DailyContractDraft>) => void;
  instrumentOptions: string[];
}) {
  const [customInstrument, setCustomInstrument] = useState("");

  const toggleSession = (session: "London" | "New York" | "Asian") => {
    const has = draft.allowedSessions.includes(session);
    onChange({ allowedSessions: has ? draft.allowedSessions.filter((s) => s !== session) : [...draft.allowedSessions, session] });
  };

  const toggleInstrument = (symbol: string) => {
    const has = draft.allowedInstruments.includes(symbol);
    onChange({ allowedInstruments: has ? draft.allowedInstruments.filter((s) => s !== symbol) : [...draft.allowedInstruments, symbol] });
  };

  const addCustomInstrument = () => {
    const symbol = customInstrument.trim().toUpperCase();
    if (!symbol || draft.allowedInstruments.includes(symbol)) return;
    onChange({ allowedInstruments: [...draft.allowedInstruments, symbol] });
    setCustomInstrument("");
  };

  const allInstrumentOptions = Array.from(new Set([...instrumentOptions, ...draft.allowedInstruments]));

  return (
    <div
      className="rounded-xl p-4 space-y-4"
      style={{
        background: glassmorphism.card.background,
        backdropFilter: glassmorphism.card.backdropBlur,
        border: "1px solid rgba(148,163,184,0.08)",
        borderRadius: borderRadius.xl,
      }}
    >
      <p className="text-[#F8FAFC] font-semibold text-sm">{briefing.account.name}</p>

      <div className="grid grid-cols-3 gap-3">
        <NumberField label="Max Risk / Trade" value={draft.maxRiskPerTrade} onChange={(v) => onChange({ maxRiskPerTrade: v })} prefix="$" />
        <NumberField label="Max Trades" value={draft.maxTrades} onChange={(v) => onChange({ maxTrades: v })} />
        <NumberField label="Stop After N Losses" value={draft.stopAfterLosses} onChange={(v) => onChange({ stopAfterLosses: v })} />
      </div>

      <div>
        <span className="text-[#64748B] uppercase block mb-1.5" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
          Allowed Session{draft.allowedSessions.length === 0 ? " — Any" : ""}
        </span>
        <div className="flex flex-wrap gap-2">
          {SESSIONS.map((s) => (
            <Pill key={s} label={s} active={draft.allowedSessions.includes(s)} onClick={() => toggleSession(s)} />
          ))}
        </div>
      </div>

      <div>
        <span className="text-[#64748B] uppercase block mb-1.5" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
          Allowed Instruments{draft.allowedInstruments.length === 0 ? " — Any" : ""}
        </span>
        <div className="flex flex-wrap gap-2 mb-2">
          {allInstrumentOptions.map((symbol) => (
            <Pill key={symbol} label={symbol} active={draft.allowedInstruments.includes(symbol)} onClick={() => toggleInstrument(symbol)} />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customInstrument}
            onChange={(e) => setCustomInstrument(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomInstrument())}
            placeholder="Add instrument…"
            className="flex-1 rounded-lg px-3 py-1.5 text-xs text-[#F8FAFC] outline-none pointer-events-auto"
            style={{ background: "rgba(148,163,184,0.04)", border: "1px solid rgba(148,163,184,0.15)" }}
          />
          <button
            type="button"
            onClick={addCustomInstrument}
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 pointer-events-auto"
            style={{ background: "rgba(41,141,255,0.16)", border: "1px solid rgba(41,141,255,0.4)" }}
          >
            <Plus className="w-3.5 h-3.5 text-[#298DFF]" />
          </button>
        </div>
      </div>

      <label className="block">
        <span className="text-[#64748B] uppercase block mb-1" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
          Special Personal Rules (optional)
        </span>
        <textarea
          value={draft.specialRules ?? ""}
          onChange={(e) => onChange({ specialRules: e.target.value || null })}
          rows={2}
          placeholder="e.g. No trading during NFP release"
          className="w-full rounded-lg px-3 py-2 text-sm text-[#F8FAFC] outline-none pointer-events-auto resize-none"
          style={{ background: "rgba(148,163,184,0.04)", border: "1px solid rgba(148,163,184,0.15)" }}
        />
      </label>

      <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.xs }}>
        EdgePilot recommends {draft.maxRiskPerTrade !== null ? fmt$(draft.maxRiskPerTrade) : "—"} max risk based on today&apos;s{" "}
        {briefing.modeLabel.toLowerCase()} mode — edit any number above to set your own commitment.
      </p>
    </div>
  );
}

export function TradingProtocolStep({
  briefings,
  drafts,
  onDraftChange,
  instrumentOptions,
}: {
  briefings: AccountBriefing[];
  drafts: Record<string, DailyContractDraft>;
  onDraftChange: (key: string, patch: Partial<DailyContractDraft>) => void;
  instrumentOptions: Record<string, string[]>;
}) {
  return (
    <div className="w-full">
      <h2 className="text-[#F8FAFC] font-bold text-center mb-2" style={{ fontSize: typography.fontSize["2xl"] }}>
        Today&apos;s Trading Contract
      </h2>
      <p className="text-[#94A3B8] text-center mb-6" style={{ fontSize: typography.fontSize.sm }}>
        Set the numbers you&apos;re actually committing to — EdgePilot audits your session against this, not a checklist.
      </p>
      <div className="space-y-4">
        {briefings.map((b) => {
          const key = accountKey(b);
          const draft = drafts[key];
          if (!draft) return null;
          return (
            <AccountContractCard
              key={key}
              briefing={b}
              draft={draft}
              onChange={(patch) => onDraftChange(key, patch)}
              instrumentOptions={instrumentOptions[key] ?? []}
            />
          );
        })}
      </div>
    </div>
  );
}
