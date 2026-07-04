"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { AnalysisScope, GlobalFilters } from "@/lib/analytics/globalAnalytics";
import { DateRangeFilter } from "@/components/DateRangeFilter";

interface AccountOption {
  id: string;
  name: string;
}

interface GlobalFilterBarProps {
  filters: GlobalFilters;
  onChange: (patch: Partial<GlobalFilters>) => void;
  onReset: () => void;
  propFirmOptions: string[];
  accountOptions: AccountOption[];
  instrumentOptions: string[];
  sessionOptions: string[];
  isFiltered: boolean;
}

const SCOPE_OPTIONS: { value: AnalysisScope; label: string }[] = [
  { value: "all", label: "All" },
  { value: "challenge", label: "Challenge" },
  { value: "funded", label: "Funded" },
];

const selectClass =
  "w-full bg-[#0D1424] border border-[#1A2942] text-[#F8FAFC] text-sm rounded-lg px-3 py-2 focus:border-[#298DFF] focus:outline-none focus:ring-2 focus:ring-[#298DFF]/20 transition-all";

export function GlobalFilterBar({
  filters,
  onChange,
  onReset,
  propFirmOptions,
  accountOptions,
  instrumentOptions,
  sessionOptions,
  isFiltered,
}: GlobalFilterBarProps) {
  return (
    <div
      className="sticky top-0 z-30 -mx-6 -mt-6 px-6 pt-4 pb-4 mb-6"
      style={{
        background: "rgba(3,7,18,0.85)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(148,163,184,0.08)",
      }}
    >
      <div
        className="rounded-xl p-4 transition-all duration-300"
        style={{
          background: glassmorphism.card.background,
          backdropFilter: glassmorphism.card.backdropBlur,
          border: "1px solid rgba(148,163,184,0.08)",
          borderRadius: borderRadius.xl,
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#298DFF]" />
            <span
              className="text-[#F8FAFC] font-semibold"
              style={{ fontSize: typography.fontSize.sm }}
            >
              Filters
            </span>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "rgba(148,163,184,0.06)", border: "1px solid rgba(148,163,184,0.12)" }}>
            {SCOPE_OPTIONS.map((opt) => {
              const isActive = filters.scope === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange({ scope: opt.value, accountId: "" })}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 pointer-events-auto"
                  style={{
                    color: isActive ? "#F8FAFC" : "#94A3B8",
                    background: isActive ? "rgba(41,141,255,0.2)" : "transparent",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {isFiltered && (
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1 text-xs text-[#94A3B8] hover:text-[#F8FAFC] transition-colors pointer-events-auto"
            >
              <X className="w-3.5 h-3.5" />
              Reset filters
            </button>
          )}
        </div>

        <DateRangeFilter
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          onChange={(range) => onChange(range)}
          className="mb-3"
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-[#64748B] text-[10px] uppercase tracking-wide">Prop Firm</label>
            <select
              value={filters.propFirm}
              onChange={(e) => onChange({ propFirm: e.target.value })}
              className={selectClass}
            >
              <option value="">All Firms</option>
              {propFirmOptions.map((firm) => (
                <option key={firm} value={firm}>
                  {firm}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[#64748B] text-[10px] uppercase tracking-wide">Account</label>
            <select
              value={filters.accountId}
              onChange={(e) => onChange({ accountId: e.target.value })}
              className={selectClass}
            >
              <option value="">All Accounts</option>
              {accountOptions.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[#64748B] text-[10px] uppercase tracking-wide">Instrument</label>
            <select
              value={filters.instrument}
              onChange={(e) => onChange({ instrument: e.target.value })}
              className={selectClass}
            >
              <option value="">All Instruments</option>
              {instrumentOptions.map((sym) => (
                <option key={sym} value={sym}>
                  {sym}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[#64748B] text-[10px] uppercase tracking-wide">Session</label>
            <select
              value={filters.session}
              onChange={(e) => onChange({ session: e.target.value })}
              className={selectClass}
            >
              <option value="">All Sessions</option>
              {sessionOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
