"use client";

import { useMemo } from "react";

export interface DateRange {
  dateFrom: string; // "YYYY-MM-DD", "" = unbounded
  dateTo: string; // "YYYY-MM-DD", "" = unbounded
}

export interface DateRangeFilterProps {
  dateFrom: string;
  dateTo: string;
  onChange: (range: DateRange) => void;
  className?: string;
}

const inputClass =
  "w-full bg-[#0D1424] border border-[#1A2942] text-[#F8FAFC] text-sm rounded-lg px-3 py-2 focus:border-[#298DFF] focus:outline-none focus:ring-2 focus:ring-[#298DFF]/20 transition-all";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

// Monday-start week, matching the ISO week convention most trading
// journals use for "this week"/"last week".
function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}

interface DatePreset {
  label: string;
  getRange: () => DateRange;
}

// Pure date math against "now" — every preset always overwrites both
// bounds. "All Time" maps to the same "" / "" unbounded convention
// GlobalFilters already uses, so it's also this component's default state.
const PRESETS: DatePreset[] = [
  {
    label: "Today",
    getRange: () => {
      const today = toDateString(new Date());
      return { dateFrom: today, dateTo: today };
    },
  },
  {
    label: "Yesterday",
    getRange: () => {
      const yesterday = toDateString(addDays(new Date(), -1));
      return { dateFrom: yesterday, dateTo: yesterday };
    },
  },
  {
    label: "Current Week",
    getRange: () => {
      const now = new Date();
      return { dateFrom: toDateString(startOfWeek(now)), dateTo: toDateString(now) };
    },
  },
  {
    label: "Last Week",
    getRange: () => {
      const now = new Date();
      const startThisWeek = startOfWeek(now);
      const startLastWeek = addDays(startThisWeek, -7);
      const endLastWeek = addDays(startThisWeek, -1);
      return { dateFrom: toDateString(startLastWeek), dateTo: toDateString(endLastWeek) };
    },
  },
  {
    label: "Current Month",
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { dateFrom: toDateString(start), dateTo: toDateString(now) };
    },
  },
  {
    label: "Last Month",
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { dateFrom: toDateString(start), dateTo: toDateString(end) };
    },
  },
  {
    label: "Last 30 Days",
    getRange: () => {
      const now = new Date();
      return { dateFrom: toDateString(addDays(now, -29)), dateTo: toDateString(now) };
    },
  },
  {
    label: "Last 90 Days",
    getRange: () => {
      const now = new Date();
      return { dateFrom: toDateString(addDays(now, -89)), dateTo: toDateString(now) };
    },
  },
  {
    label: "Year To Date",
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      return { dateFrom: toDateString(start), dateTo: toDateString(now) };
    },
  },
  {
    label: "All Time",
    getRange: () => ({ dateFrom: "", dateTo: "" }),
  },
];

// Shared everywhere a date range is filtered (Dashboard, Trader DNA /
// Analytics, Trade Journal) — one preset row plus manual From/To inputs.
// Selecting a preset overwrites both bounds and lights up that pill;
// editing a bound by hand naturally stops matching any preset, which
// reads as "Custom Range" (no pill lit, the Custom Range tag shows
// instead) without any extra state to track.
export function DateRangeFilter({ dateFrom, dateTo, onChange, className }: DateRangeFilterProps) {
  const activePresetLabel = useMemo(() => {
    for (const preset of PRESETS) {
      const range = preset.getRange();
      if (range.dateFrom === dateFrom && range.dateTo === dateTo) return preset.label;
    }
    return null;
  }, [dateFrom, dateTo]);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {PRESETS.map((preset) => {
          const isActive = activePresetLabel === preset.label;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => onChange(preset.getRange())}
              className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 pointer-events-auto"
              style={{
                color: isActive ? "#F8FAFC" : "#94A3B8",
                background: isActive ? "rgba(41,141,255,0.2)" : "rgba(148,163,184,0.06)",
                border: `1px solid ${isActive ? "rgba(41,141,255,0.4)" : "rgba(148,163,184,0.12)"}`,
              }}
            >
              {preset.label}
            </button>
          );
        })}
        {activePresetLabel === null && (
          <span
            className="px-2.5 py-1 rounded-lg text-xs font-medium"
            style={{ color: "#F8FAFC", background: "rgba(168,85,247,0.2)", border: "1px solid rgba(168,85,247,0.4)" }}
          >
            Custom Range
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div className="space-y-1">
          <label className="text-[#64748B] text-[10px] uppercase tracking-wide">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onChange({ dateFrom: e.target.value, dateTo })}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[#64748B] text-[10px] uppercase tracking-wide">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onChange({ dateFrom, dateTo: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>
    </div>
  );
}
