"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Plus,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Target,
  Activity,
  Award,
  AlertTriangle,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { AddTradeDialog } from "@/components/AddTradeDialog";
import { AddPayoutDialog } from "@/components/AddPayoutDialog";
import { glassmorphism, borderRadius, typography, gradientText } from "@/design-system";
import { getAccountOptionLabel } from "@/lib/accountLabels";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AccountAnalyticsViewProps {
  account: any;
  trades: any[];
  payouts: any[];
  accountType: "challenge" | "funded";
  allAccounts: any[];
  onAccountChange: (accountId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt$ = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const fmtPct = (value: number) => `${value.toFixed(1)}%`;

// Parses a "YYYY-MM-DD" date-only string as a LOCAL date instead of letting
// `new Date(str)` treat it as UTC midnight. Mixing the two causes the
// calendar/chart to land on the wrong day for any timezone that isn't UTC.
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// maxDrawdown may be stored as a percentage (e.g. 10 = 10%) or, on some
// accounts, as a raw dollar amount. No prop firm draws down more than 100% of
// an account, so any value above 100 can only be a dollar figure.
function resolveDrawdownDollars(maxDrawdown: number, accountSize: number): number {
  const raw = Number(maxDrawdown) || 0;
  return raw <= 100 ? (accountSize * raw) / 100 : raw;
}

const STATUS_BADGE: Record<string, string> = {
  active:   "bg-[rgba(16,185,129,0.15)] text-[#10B981] border border-[rgba(16,185,129,0.4)]",
  passed:   "bg-[rgba(16,185,129,0.15)] text-[#10B981] border border-[rgba(16,185,129,0.4)]",
  failed:   "bg-[rgba(239,68,68,0.15)] text-[#EF4444] border border-[rgba(239,68,68,0.4)]",
  breached: "bg-[rgba(239,68,68,0.15)] text-[#EF4444] border border-[rgba(239,68,68,0.4)]",
  refunded: "bg-[rgba(245,158,11,0.15)] text-[#F59E0B] border border-[rgba(245,158,11,0.4)]",
  closed:   "bg-[rgba(148,163,184,0.15)] text-[#94A3B8] border border-[rgba(148,163,184,0.4)]",
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2 rounded-xl text-xs"
      style={{
        background: "rgba(11,18,32,0.95)",
        border: "1px solid rgba(148,163,184,0.15)",
        backdropFilter: "blur(12px)",
      }}
    >
      <p className="text-[#94A3B8] mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-semibold">
          {fmt$(p.value)}
        </p>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export function AccountAnalyticsView({
  account,
  trades: rawTrades,
  payouts,
  accountType,
  allAccounts,
  onAccountChange,
}: AccountAnalyticsViewProps) {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isAddTradeDialogOpen, setIsAddTradeDialogOpen] = useState(false);
  const [isAddPayoutDialogOpen, setIsAddPayoutDialogOpen] = useState(false);

  // ── Defensive trade filtering ───────────────────────────────────────────────
  // Callers already filter by accountId/accountType, but this view re-verifies
  // it and drops anything malformed (missing date/pnl) instead of letting one
  // bad row silently break the calendar/equity curve/stats below.
  const trades = useMemo(() => {
    const clean: typeof rawTrades = [];
    for (const t of rawTrades) {
      if (t.accountId !== account.id || t.accountType !== accountType) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            "[AccountAnalyticsView] Trade belongs to a different account — skipped",
            t
          );
        }
        continue;
      }
      if (!t.entryDate || typeof t.pnl !== "number" || !isFinite(t.pnl)) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            "[AccountAnalyticsView] Trade missing accountId/accountType/date/pnl — skipped",
            t
          );
        }
        continue;
      }
      clean.push(t);
    }
    return clean;
  }, [rawTrades, account.id, accountType]);

  // ── Derived account fields ─────────────────────────────────────────────────
  const startBalance =
    accountType === "funded" ? account.initialBalance : account.accountSize;
  const startDate =
    accountType === "funded" ? account.fundingDate : account.purchaseDate;

  // ── Trade-level statistics ─────────────────────────────────────────────────
  const totalPnL = trades.reduce((s, t) => s + t.pnl, 0);
  const winningTrades = trades.filter((t) => t.pnl > 0);
  const losingTrades  = trades.filter((t) => t.pnl < 0);
  const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
  const avgWin  = winningTrades.length > 0 ? winningTrades.reduce((s, t) => s + t.pnl, 0) / winningTrades.length : 0;
  const avgLoss = losingTrades.length  > 0 ? losingTrades.reduce((s, t) => s + t.pnl, 0) / losingTrades.length : 0;
  const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;

  // ── Drawdown (dollar figure first, percentages derived from it) ────────────
  const maxDDDollars = resolveDrawdownDollars(account.maxDrawdown, account.accountSize);
  const maxDDPercent = account.accountSize > 0 ? (maxDDDollars / account.accountSize) * 100 : 0;
  const lossAmount = Math.max(0, -totalPnL);
  const remainingDDDollars = Math.max(0, maxDDDollars - lossAmount);
  const remainingDDPercent = account.accountSize > 0 ? (remainingDDDollars / account.accountSize) * 100 : 0;
  const usedDDPercent = Math.max(0, maxDDPercent - remainingDDPercent);
  const drawdownFloor = startBalance - maxDDDollars; // balance at which account breaches
  const targetBalance =
    accountType === "challenge" && account.profitTarget > 0
      ? account.accountSize + account.profitTarget
      : null;

  // ── Daily P&L aggregation ──────────────────────────────────────────────────
  const dailyPnL = useMemo(
    () =>
      trades.reduce((acc: Record<string, { pnl: number; trades: number }>, trade) => {
        const d = trade.entryDate;
        if (!acc[d]) acc[d] = { pnl: 0, trades: 0 };
        acc[d].pnl += trade.pnl;
        acc[d].trades += 1;
        return acc;
      }, {}),
    [trades]
  );

  // ── Equity curve (starts at opening balance) ───────────────────────────────
  const equityCurveData = useMemo(() => {
    const sorted = Object.entries(dailyPnL).sort(
      ([a], [b]) => parseLocalDate(a).getTime() - parseLocalDate(b).getTime()
    );
    const points: { date: string; balance: number }[] = [
      { date: startDate ?? "Start", balance: startBalance },
    ];
    let running = startBalance;
    for (const [date, data] of sorted) {
      running += data.pnl;
      points.push({ date, balance: running });
    }
    return points;
  }, [dailyPnL, startBalance, startDate]);

  // ── Y-axis domain: tight around actual equity range, not forced to 0 ──────
  const yDomain = useMemo((): [number, number] => {
    const values = equityCurveData.map((p) => p.balance);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(max - min, 1);
    const padding = Math.max(range * 0.15, Math.abs(startBalance) * 0.01, 10);
    return [min - padding, max + padding];
  }, [equityCurveData, startBalance]);

  // ── Day-level statistics ───────────────────────────────────────────────────
  const dailyEntries = Object.entries(dailyPnL) as [string, { pnl: number; trades: number }][];
  const winningDays  = dailyEntries.filter(([, d]) => d.pnl > 0);
  const losingDays   = dailyEntries.filter(([, d]) => d.pnl < 0);
  const bestDay  = dailyEntries.length > 0 ? dailyEntries.reduce((a, b) => (b[1].pnl > a[1].pnl ? b : a)) : null;
  const worstDay = dailyEntries.length > 0 ? dailyEntries.reduce((a, b) => (b[1].pnl < a[1].pnl ? b : a)) : null;
  const avgDailyPnL = dailyEntries.length > 0 ? totalPnL / dailyEntries.length : 0;

  // ── Target progress ────────────────────────────────────────────────────────
  const targetProgress =
    accountType === "challenge" && account.profitTarget > 0
      ? Math.min(100, (totalPnL / account.profitTarget) * 100)
      : 0;

  // ── Calendar ───────────────────────────────────────────────────────────────
  const navigateMonth = (dir: "prev" | "next") =>
    setCurrentMonth((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + (dir === "prev" ? -1 : 1));
      return d;
    });

  const monthDays = useMemo(() => {
    const year  = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const days: (Date | null)[] = [];
    for (let i = 0; i < new Date(year, month, 1).getDay(); i++) days.push(null);
    for (let i = 1; i <= new Date(year, month + 1, 0).getDate(); i++)
      days.push(new Date(year, month, i));
    return days;
  }, [currentMonth]);

  const getDayData = (date: Date) => {
    // Use local date components (not toISOString, which converts to UTC and
    // can shift the key to the wrong calendar day depending on timezone).
    const key = toDateKey(date);
    return dailyPnL[key] ?? null;
  };

  const isToday = (date: Date) =>
    date.toDateString() === new Date().toDateString();

  // ── Animation ─────────────────────────────────────────────────────────────
  const cardVariants = { hover: { y: -3, transition: { duration: 0.25 } } };

  // ─── Stat card helper ───────────────────────────────────────────────────────
  const StatCard = ({
    icon: Icon,
    label,
    value,
    color,
    sub,
  }: {
    icon: any;
    label: string;
    value: string;
    color: string;
    sub?: string;
  }) => (
    <motion.div variants={cardVariants} whileHover="hover">
      <div
        className="rounded-xl p-4 transition-all duration-300"
        style={{
          background: glassmorphism.card.background,
          backdropFilter: glassmorphism.card.backdropBlur,
          border: "1px solid rgba(148,163,184,0.08)",
          borderRadius: borderRadius.xl,
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}1A` }}
          >
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
          <div className="min-w-0">
            <p
              className="text-[#94A3B8] uppercase mb-1 truncate"
              style={{
                fontSize: typography.fontSize.xs,
                fontWeight: typography.fontWeight.medium,
                letterSpacing: typography.letterSpacing.label,
              }}
            >
              {label}
            </p>
            <p
              className="font-bold"
              style={{ color, fontSize: typography.fontSize.lg }}
            >
              {value}
            </p>
            {sub && <p className="text-[#64748B] text-xs mt-0.5">{sub}</p>}
          </div>
        </div>
      </div>
    </motion.div>
  );

  // ─── Empty state ────────────────────────────────────────────────────────────
  if (trades.length === 0) {
    return (
      <div className="space-y-6">
        <Header
          account={account}
          accountType={accountType}
          allAccounts={allAccounts}
          onAccountChange={onAccountChange}
          router={router}
          setIsAddTradeDialogOpen={setIsAddTradeDialogOpen}
          setIsAddPayoutDialogOpen={setIsAddPayoutDialogOpen}
        />
        <div
          className="rounded-2xl p-16 flex flex-col items-center justify-center text-center"
          style={{
            background: glassmorphism.card.background,
            backdropFilter: glassmorphism.card.backdropBlur,
            border: "1px solid rgba(148,163,184,0.08)",
          }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
            style={{ background: "rgba(41,141,255,0.1)" }}
          >
            <BarChart3 className="w-8 h-8 text-[#298DFF]" />
          </div>
          <p
            className="text-[#F8FAFC] font-bold mb-2"
            style={{ fontSize: typography.fontSize.xl }}
          >
            No trades recorded yet
          </p>
          <p className="text-[#94A3B8] mb-8" style={{ fontSize: typography.fontSize.sm }}>
            Add your first trade to see your equity curve, calendar, and performance stats.
          </p>
          <Button
            className="bg-gradient-to-r from-[#298DFF] to-[#1E6FE0] hover:shadow-lg hover:shadow-[rgba(41,141,255,0.3)] hover:scale-105 transition-all duration-300 text-white rounded-xl pointer-events-auto"
            onClick={() => setIsAddTradeDialogOpen(true)}
            type="button"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add First Trade
          </Button>
        </div>
        <AddTradeDialog open={isAddTradeDialogOpen} onOpenChange={setIsAddTradeDialogOpen} />
        {accountType === "funded" && (
          <AddPayoutDialog open={isAddPayoutDialogOpen} onOpenChange={setIsAddPayoutDialogOpen} defaultFundedAccountId={account.id} />
        )}
      </div>
    );
  }

  // ─── Main view ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <Header
        account={account}
        accountType={accountType}
        allAccounts={allAccounts}
        onAccountChange={onAccountChange}
        router={router}
        setIsAddTradeDialogOpen={setIsAddTradeDialogOpen}
        setIsAddPayoutDialogOpen={setIsAddPayoutDialogOpen}
      />

      {/* ── Account Data Strip ────────────────────────────────────────────── */}
      <div
        className="rounded-xl p-5 transition-all duration-300"
        style={{
          background: glassmorphism.card.background,
          backdropFilter: glassmorphism.card.backdropBlur,
          border: "1px solid rgba(148,163,184,0.08)",
          borderRadius: borderRadius.xl,
        }}
      >
        <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm">
          <DataField label="Prop Firm" value={account.propFirmName} />
          <DataField
            label="Type"
            value={accountType === "challenge" ? (account.challengeType ?? "Challenge") : "Funded"}
          />
          <DataField
            label="Start Date"
            value={accountType === "challenge" ? account.purchaseDate : account.fundingDate}
          />
          <DataField label="Account Size" value={fmt$(account.accountSize)} />
          <DataField label="Opening Balance" value={fmt$(startBalance)} />
          <DataField
            label="Current Balance"
            value={
              accountType === "funded"
                ? fmt$(account.currentBalance)
                : fmt$(account.accountSize + (account.currentProfit ?? 0))
            }
            colored={(account.currentProfit ?? 0) >= 0 ? "#10B981" : "#EF4444"}
          />
          <DataField
            label="Net P&L"
            value={fmt$(totalPnL)}
            colored={totalPnL >= 0 ? "#10B981" : "#EF4444"}
          />
          {accountType === "challenge" && account.profitTarget > 0 && (
            <DataField
              label="Target"
              value={`${fmt$(account.profitTarget)} (${fmtPct(targetProgress)})`}
              colored="#D4AF37"
            />
          )}
          <DataField
            label="Drawdown Remaining"
            value={`${fmtPct(remainingDDPercent)} · ${fmt$(remainingDDDollars)}`}
            colored={remainingDDPercent < maxDDPercent * 0.3 ? "#EF4444" : "#94A3B8"}
          />
        </div>
      </div>

      {/* ── Equity Curve ──────────────────────────────────────────────────── */}
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
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(41,141,255,0.1)" }}
            >
              <Activity className="w-5 h-5 text-[#298DFF]" />
            </div>
            <div>
              <h3
                className="text-[#F8FAFC] font-bold"
                style={{ fontSize: typography.fontSize.section }}
              >
                Equity Curve
              </h3>
              <p className="text-[#94A3B8] text-xs mt-0.5">Cumulative balance over time</p>
            </div>
          </div>
          <div className="flex gap-6 text-sm">
            <div className="text-right">
              <p className="text-[#64748B] text-xs mb-0.5">Net P&L</p>
              <p className={`font-bold ${totalPnL >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                {fmt$(totalPnL)}
              </p>
            </div>
            {accountType === "challenge" && account.profitTarget > 0 && (
              <div className="text-right">
                <p className="text-[#64748B] text-xs mb-0.5">Target Progress</p>
                <p className="font-bold text-[#D4AF37]">{fmtPct(targetProgress)}</p>
              </div>
            )}
            <div className="text-right">
              <p className="text-[#64748B] text-xs mb-0.5">Drawdown Used</p>
              <p className="font-bold text-[#EF4444]">{fmtPct(usedDDPercent)}</p>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-4 text-xs text-[#94A3B8]">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#298DFF] rounded-full" /> Equity
          </span>
          {targetBalance && (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 rounded-full border-t border-dashed border-[#D4AF37]" /> Target
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded-full border-t border-dashed border-[#EF4444]" /> Drawdown Floor
          </span>
        </div>

        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={equityCurveData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
              <XAxis
                dataKey="date"
                stroke="#475569"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: "rgba(148,163,184,0.15)" }}
                tickFormatter={(v) => {
                  if (v === "Start" || v === startDate) return "Start";
                  try {
                    return parseLocalDate(v).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  } catch { return v; }
                }}
              />
              <YAxis
                stroke="#475569"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => fmt$(v)}
                width={72}
                domain={yDomain}
                allowDataOverflow
              />
              <Tooltip content={<ChartTooltip />} />
              {/* Start line */}
              <ReferenceLine
                y={startBalance}
                stroke="rgba(148,163,184,0.3)"
                strokeDasharray="4 4"
                label={{ value: "Open", fill: "#64748B", fontSize: 10, position: "insideTopLeft" }}
              />
              {/* Target line (challenge only) */}
              {targetBalance && (
                <ReferenceLine
                  y={targetBalance}
                  stroke="#D4AF37"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{ value: "Target", fill: "#D4AF37", fontSize: 10, position: "insideTopLeft" }}
                />
              )}
              {/* Drawdown floor */}
              <ReferenceLine
                y={drawdownFloor}
                stroke="#EF4444"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{ value: "DD Floor", fill: "#EF4444", fontSize: 10, position: "insideBottomLeft" }}
              />
              <Line
                type="monotone"
                dataKey="balance"
                stroke="#298DFF"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#298DFF", stroke: "#0B1220", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Trading Calendar ──────────────────────────────────────────────── */}
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
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(212,175,55,0.1)" }}
            >
              <Calendar className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div>
              <h3
                className="text-[#F8FAFC] font-bold"
                style={{ fontSize: typography.fontSize.section }}
              >
                Trading Calendar
              </h3>
              <p className="text-[#94A3B8] text-xs mt-0.5">Daily P&L by session</p>
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
            <span
              className="text-[#F8FAFC] font-medium min-w-[160px] text-center"
              style={{ fontSize: typography.fontSize.sm }}
            >
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

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div
              key={d}
              className="text-center py-2 text-[#64748B] uppercase"
              style={{ fontSize: "10px", letterSpacing: "0.06em", fontWeight: 600 }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
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
                  background: data
                    ? data.pnl >= 0
                      ? "rgba(16,185,129,0.12)"
                      : "rgba(239,68,68,0.12)"
                    : "rgba(11,18,32,0.5)",
                  border: `1px solid ${
                    today
                      ? "#D4AF37"
                      : data
                      ? data.pnl >= 0
                        ? "rgba(16,185,129,0.3)"
                        : "rgba(239,68,68,0.3)"
                      : "rgba(148,163,184,0.08)"
                  }`,
                  boxShadow: today ? "0 0 0 1px rgba(212,175,55,0.3)" : undefined,
                }}
              >
                <span
                  className="font-medium"
                  style={{
                    fontSize: "10px",
                    color: today ? "#D4AF37" : "#94A3B8",
                  }}
                >
                  {date.getDate()}
                </span>
                {data && (
                  <>
                    <span
                      className="font-semibold leading-tight mt-auto"
                      style={{
                        fontSize: "9px",
                        color: data.pnl >= 0 ? "#10B981" : "#EF4444",
                      }}
                    >
                      {data.pnl >= 0 ? "+" : ""}
                      {fmt$(data.pnl)}
                    </span>
                    <span style={{ fontSize: "8px", color: "#64748B" }}>
                      {data.trades}t
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Calendar legend */}
        <div className="flex gap-4 mt-4 text-xs text-[#64748B]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-[rgba(16,185,129,0.3)]" /> Profitable day
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-[rgba(239,68,68,0.3)]" /> Losing day
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded border border-[#D4AF37]" /> Today
          </span>
        </div>
      </div>

      {/* ── Statistics Grid ───────────────────────────────────────────────── */}
      <div>
        <h3
          className="text-[#F8FAFC] font-bold mb-4"
          style={{ fontSize: typography.fontSize.section }}
        >
          Performance Statistics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={BarChart3} label="Total Trades" value={trades.length.toString()} color="#298DFF" sub={`${winningTrades.length}W · ${losingTrades.length}L`} />
          <StatCard icon={TrendingUp} label="Win Rate" value={fmtPct(winRate)} color="#10B981" sub={`${winningTrades.length} winning trades`} />
          <StatCard icon={Calendar} label="Winning Days" value={winningDays.length.toString()} color="#10B981" sub={`of ${dailyEntries.length} trading days`} />
          <StatCard icon={Calendar} label="Losing Days" value={losingDays.length.toString()} color="#EF4444" sub={`of ${dailyEntries.length} trading days`} />
          <StatCard
            icon={Award}
            label="Best Day"
            value={bestDay ? fmt$(bestDay[1].pnl) : "$0"}
            color="#10B981"
            sub={bestDay ? bestDay[0] : "—"}
          />
          <StatCard
            icon={AlertTriangle}
            label="Worst Day"
            value={worstDay ? fmt$(worstDay[1].pnl) : "$0"}
            color="#EF4444"
            sub={worstDay ? worstDay[0] : "—"}
          />
          <StatCard icon={DollarSign} label="Avg Daily P&L" value={fmt$(avgDailyPnL)} color={avgDailyPnL >= 0 ? "#10B981" : "#EF4444"} sub="Per trading day" />
          <StatCard icon={Target} label="Profit Factor" value={profitFactor.toFixed(2)} color="#D4AF37" sub={`${fmt$(avgWin)} avg win`} />
          <StatCard icon={TrendingUp} label="Best Trade" value={winningTrades.length > 0 ? fmt$(Math.max(...winningTrades.map((t) => t.pnl))) : "$0"} color="#10B981" />
          <StatCard icon={TrendingDown} label="Worst Trade" value={losingTrades.length > 0 ? fmt$(Math.min(...losingTrades.map((t) => t.pnl))) : "$0"} color="#EF4444" />
          <StatCard icon={TrendingUp} label="Avg Win" value={fmt$(avgWin)} color="#10B981" sub={`${winningTrades.length} trades`} />
          <StatCard icon={TrendingDown} label="Avg Loss" value={fmt$(avgLoss)} color="#EF4444" sub={`${losingTrades.length} trades`} />
        </div>
      </div>

      {/* ── Dialogs ───────────────────────────────────────────────────────── */}
      <AddTradeDialog open={isAddTradeDialogOpen} onOpenChange={setIsAddTradeDialogOpen} />
      {accountType === "funded" && (
        <AddPayoutDialog open={isAddPayoutDialogOpen} onOpenChange={setIsAddPayoutDialogOpen} defaultFundedAccountId={account.id} />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Header({
  account,
  accountType,
  allAccounts,
  onAccountChange,
  router,
  setIsAddTradeDialogOpen,
  setIsAddPayoutDialogOpen,
}: {
  account: any;
  accountType: "challenge" | "funded";
  allAccounts: any[];
  onAccountChange: (id: string) => void;
  router: any;
  setIsAddTradeDialogOpen: (v: boolean) => void;
  setIsAddPayoutDialogOpen: (v: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[rgba(148,163,184,0.1)] transition-all pointer-events-auto"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1
              className="font-extrabold"
              style={{
                fontSize: typography.fontSize.display,
                fontWeight: typography.fontWeight.extraBold,
                letterSpacing: typography.letterSpacing.display,
                lineHeight: typography.lineHeight.display,
                background: gradientText.premium,
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              Analytics
            </h1>
            <p className="text-[#94A3B8] mt-0.5" style={{ fontSize: typography.fontSize.sm }}>
              {account.accountName} ·{" "}
              {accountType === "challenge" ? "Challenge Account" : "Funded Account"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {allAccounts.length > 1 && (
            <select
              value={account.id}
              onChange={(e) => onAccountChange(e.target.value)}
              className="bg-[rgba(11,18,32,0.8)] border border-[rgba(148,163,184,0.15)] text-[#F8FAFC] rounded-xl px-3 py-2 text-sm focus:border-[#298DFF] focus:outline-none focus:ring-2 focus:ring-[rgba(41,141,255,0.2)] transition-all"
            >
              {allAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {getAccountOptionLabel(a, accountType)}
                </option>
              ))}
            </select>
          )}
          <Badge
            variant="default"
            className={`rounded-full font-semibold ${STATUS_BADGE[account.status] ?? STATUS_BADGE.closed}`}
          >
            {account.status}
          </Badge>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="border-[rgba(148,163,184,0.2)] text-[#F8FAFC] hover:bg-[rgba(41,141,255,0.1)] hover:border-[#298DFF] rounded-xl pointer-events-auto transition-all duration-300"
          onClick={() => setIsAddTradeDialogOpen(true)}
          type="button"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Trade
        </Button>
        {accountType === "funded" && (
          <Button
            variant="outline"
            size="sm"
            className="border-[rgba(148,163,184,0.2)] text-[#F8FAFC] hover:bg-[rgba(212,175,55,0.1)] hover:border-[#D4AF37] rounded-xl pointer-events-auto transition-all duration-300"
            onClick={() => setIsAddPayoutDialogOpen(true)}
            type="button"
          >
            <DollarSign className="w-4 h-4 mr-2" />
            Request Payout
          </Button>
        )}
      </div>
    </div>
  );
}

function DataField({
  label,
  value,
  colored,
}: {
  label: string;
  value: string;
  colored?: string;
}) {
  return (
    <div>
      <p className="text-[#64748B] text-xs uppercase mb-1" style={{ letterSpacing: "0.06em" }}>
        {label}
      </p>
      <p
        className="text-sm font-semibold"
        style={{ color: colored ?? "#F8FAFC" }}
      >
        {value}
      </p>
    </div>
  );
}
