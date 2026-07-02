"use client";

import { useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { CalendarDayData } from "@/lib/analytics/globalAnalytics";

const fmt$ = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function GlobalCalendar({ dailyPnL }: { dailyPnL: Record<string, CalendarDayData> }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const navigateMonth = (dir: "prev" | "next") =>
    setCurrentMonth((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + (dir === "prev" ? -1 : 1));
      return d;
    });

  const monthDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const days: (Date | null)[] = [];
    for (let i = 0; i < new Date(year, month, 1).getDay(); i++) days.push(null);
    for (let i = 1; i <= new Date(year, month + 1, 0).getDate(); i++) days.push(new Date(year, month, i));
    return days;
  }, [currentMonth]);

  const getDayData = (date: Date) => dailyPnL[toDateKey(date)] ?? null;
  const isToday = (date: Date) => date.toDateString() === new Date().toDateString();

  return (
    <div
      className="rounded-xl p-6 transition-all duration-300"
      style={{
        background: glassmorphism.card.background,
        backdropFilter: glassmorphism.card.backdropBlur,
        border: "1px solid rgba(148,163,184,0.08)",
        borderRadius: borderRadius.xl,
      }}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(212,175,55,0.1)" }}>
            <Calendar className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <div>
            <h3 className="text-[#F8FAFC] font-bold" style={{ fontSize: typography.fontSize.section }}>
              Global Trading Calendar
            </h3>
            <p className="text-[#94A3B8] text-xs mt-0.5">Daily P&L across all matching trades</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigateMonth("prev")}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[rgba(148,163,184,0.1)] transition-all pointer-events-auto"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[#F8FAFC] font-medium min-w-[160px] text-center" style={{ fontSize: typography.fontSize.sm }}>
            {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </span>
          <button
            type="button"
            onClick={() => navigateMonth("next")}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[rgba(148,163,184,0.1)] transition-all pointer-events-auto"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center py-2 text-[#64748B] uppercase" style={{ fontSize: "10px", letterSpacing: "0.06em", fontWeight: 600 }}>
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {monthDays.map((date, idx) => {
          if (!date) return <div key={idx} className="aspect-square" />;
          const data = getDayData(date);
          const today = isToday(date);
          return (
            <div
              key={idx}
              className="aspect-square rounded-lg p-1.5 flex flex-col transition-all duration-200 hover:scale-[1.04]"
              style={{
                background: data ? (data.pnl >= 0 ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)") : "rgba(11,18,32,0.5)",
                border: `1px solid ${
                  today ? "#D4AF37" : data ? (data.pnl >= 0 ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)") : "rgba(148,163,184,0.08)"
                }`,
                boxShadow: today ? "0 0 0 1px rgba(212,175,55,0.3)" : undefined,
              }}
            >
              <span className="font-medium" style={{ fontSize: "10px", color: today ? "#D4AF37" : "#94A3B8" }}>
                {date.getDate()}
              </span>
              {data && (
                <>
                  <span className="font-semibold leading-tight mt-auto" style={{ fontSize: "9px", color: data.pnl >= 0 ? "#10B981" : "#EF4444" }}>
                    {data.pnl >= 0 ? "+" : ""}
                    {fmt$(data.pnl)}
                  </span>
                  <span style={{ fontSize: "8px", color: "#64748B" }}>{data.trades}t</span>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-4 mt-4 text-xs text-[#64748B]">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-[rgba(16,185,129,0.3)]" /> Profitable day
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-[rgba(239,68,68,0.3)]" /> Losing day
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-[rgba(11,18,32,0.5)] border border-[rgba(148,163,184,0.08)]" /> Inactive day
        </span>
      </div>
    </div>
  );
}
