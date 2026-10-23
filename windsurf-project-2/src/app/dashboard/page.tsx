"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DollarSign, TrendingUp, TrendingDown, Target, Activity,
  Clock, CheckCircle, AlertCircle, Award, BarChart3,
  ArrowUpRight, Trophy, AlertTriangle, Zap, ArrowRight
} from "lucide-react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell,
} from "recharts";
import { useAccounts } from "@/context/AccountsContext";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { getRootChallenges } from "@/lib/challenges";
import { groupByNormalizedFirm } from "@/lib/propFirms";
import { AddChallengeDialog } from "@/components/AddChallengeDialog";
import { AddTradeDialog } from "@/components/AddTradeDialog";
import { AddPayoutDialog } from "@/components/AddPayoutDialog";
import { AddFundedAccountDialog } from "@/components/AddFundedAccountDialog";
import { glassmorphism, borderRadius, typography, gradientText } from "@/design-system";

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt$ = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

const fmtShort = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${v < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${v < 0 ? "-" : ""}$${(abs / 1_000).toFixed(0)}K`;
  return fmt$(v);
};

// ─── Shared card style ────────────────────────────────────────────────────────
import type { CSSProperties } from "react";
const CARD: CSSProperties = {
  background: glassmorphism.card.background,
  backdropFilter: glassmorphism.card.backdropBlur,
  border: "1px solid rgba(148, 163, 184, 0.08)",
  borderRadius: borderRadius.xl,
};

// ─── Count-up animated number ─────────────────────────────────────────────────
function AnimatedNumber({ value, format, duration = 1200 }: { value: number; format: (v: number) => string; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const frame = useRef<number>(0);

  useEffect(() => {
    let t0: number | null = null;
    const tick = (ts: number) => {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(value * e);
      if (p < 1) frame.current = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value, duration]);

  return <>{format(display)}</>;
}

// ─── KPI card ────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: number;
  format: (v: number) => string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  dotColor: string;
  sublabel?: string;
  delay?: number;
  signed?: boolean;
}

function KpiCard({ label, value, format, icon: Icon, iconColor, iconBg, dotColor, sublabel, delay = 0, signed = false }: KpiCardProps) {
  const isNeg = signed && value < 0;
  const valColor = signed ? (isNeg ? "#EF4444" : "#10B981") : iconColor;
  const activeDot = signed ? (isNeg ? "#EF4444" : "#10B981") : dotColor;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="relative rounded-xl p-5"
      style={CARD}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: signed && isNeg ? "rgba(239,68,68,0.1)" : iconBg }}>
          <Icon className="w-5 h-5" style={{ color: valColor }} />
        </div>
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: activeDot }} />
      </div>
      <p className="text-[#94A3B8] mb-1.5 uppercase" style={{ fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium, letterSpacing: typography.letterSpacing.label }}>
        {label}
      </p>
      <p className="font-extrabold tabular-nums leading-none" style={{ fontSize: "1.75rem", letterSpacing: "-0.04em", color: valColor }}>
        <AnimatedNumber value={value} format={format} duration={1200} />
      </p>
      {sublabel && <p className="text-[#64748B] mt-1.5" style={{ fontSize: typography.fontSize.xs }}>{sublabel}</p>}
    </motion.div>
  );
}

// ─── Donut chart ──────────────────────────────────────────────────────────────
const DONUT_COLORS = ["#298DFF", "#10B981", "#F59E0B", "#EF4444", "#A855F7", "#EC4899"];

function DonutChart({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative rounded-xl p-5" style={CARD}>
      <p className="text-[#94A3B8] uppercase mb-4" style={{ fontSize: typography.fontSize.xs, letterSpacing: typography.letterSpacing.label }}>
        {title}
      </p>
      {total === 0 ? (
        <div className="h-28 flex items-center justify-center text-[#475569] text-sm">No data</div>
      ) : (
        <div className="flex items-center gap-4">
          <PieChart width={88} height={88}>
            <Pie data={data} innerRadius={25} outerRadius={40} paddingAngle={3} dataKey="value" stroke="none">
              {data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
            </Pie>
          </PieChart>
          <div className="space-y-1.5 flex-1 min-w-0">
            {data.slice(0, 5).map((d, i) => (
              <div key={d.name} className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                  <span className="text-[#94A3B8] truncate" style={{ fontSize: "0.68rem" }}>{d.name}</span>
                </div>
                <span className="text-[#F8FAFC] font-medium flex-shrink-0" style={{ fontSize: "0.68rem" }}>
                  {((d.value / total) * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Chart types ──────────────────────────────────────────────────────────────
// Three business views only — no generic Equity/Cumulative Profit/ROI. Each
// tracks the combined equity (or withdrawals) of a single account family, so
// this reads as a portfolio dashboard rather than a trading analytics report.
type ChartMetric = "challengeCapital" | "fundedCapital" | "payouts";

const METRIC_META: Record<ChartMetric, { label: string; color: string; format: (v: number) => string }> = {
  challengeCapital: { label: "Challenge Capital",   color: "#298DFF", format: fmt$ },
  fundedCapital:    { label: "Funded Capital",       color: "#10B981", format: fmt$ },
  payouts:          { label: "Cumulative Payouts",   color: "#F59E0B", format: fmt$ },
};

// ─── Activity event ───────────────────────────────────────────────────────────
interface ActivityEvent {
  id: string;
  date: string;
  label: string;
  desc: string;
  color: string;
  Icon: React.ElementType;
}

// ─── Skeleton loading ─────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="relative -mx-6 -mt-6 px-6 pt-12 pb-8 overflow-hidden">
        <div className="h-14 w-64 rounded-2xl animate-pulse" style={{ background: "rgba(148,163,184,0.08)" }} />
        <div className="h-4 w-48 rounded-xl animate-pulse mt-3" style={{ background: "rgba(148,163,184,0.06)" }} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="relative rounded-xl p-5" style={CARD}>
            <div className="w-10 h-10 rounded-xl animate-pulse mb-3" style={{ background: "rgba(148,163,184,0.08)" }} />
            <div className="h-3 w-24 rounded-md animate-pulse mb-2" style={{ background: "rgba(148,163,184,0.06)" }} />
            <div className="h-8 w-28 rounded-md animate-pulse" style={{ background: "rgba(148,163,184,0.08)" }} />
          </div>
        ))}
      </div>
      <div className="h-80 rounded-xl animate-pulse" style={{ background: "rgba(148,163,184,0.05)", borderRadius: borderRadius.xl }} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const {
    challenges, challengesLoading,
    fundedAccounts, fundedAccountsLoading,
    trades, tradesLoading,
    payouts, payoutsLoading,
    getDashboardKPIs,
  } = useAccounts();

  const [metric, setMetric] = useState<ChartMetric>("challengeCapital");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [openChallenge, setOpenChallenge] = useState(false);
  const [openTrade, setOpenTrade]         = useState(false);
  const [openPayout, setOpenPayout]       = useState(false);
  const [openFunded, setOpenFunded]       = useState(false);

  const isLoading = challengesLoading || fundedAccountsLoading || tradesLoading || payoutsLoading;
  const kpis = getDashboardKPIs();

  // ── Extra KPIs not in DashboardKPIs ───────────────────────────────────────
  const netTradingProfit = useMemo(
    () => fundedAccounts.reduce((s, a) => s + a.currentProfit, 0),
    [fundedAccounts]
  );

  // ── Chart series ───────────────────────────────────────────────────────────
  // Three independent equity/withdrawal walks, one per business view — each
  // account family's trades feed only its own series, so Challenge Capital
  // and Funded Capital never mix (unlike the old single "equity" line).
  const allChartData = useMemo(() => {
    const activeChallengeIds = new Set(challenges.filter((c) => c.status === "active").map((c) => c.id));

    const challengePnlByDate: Record<string, number> = {};
    const fundedPnlByDate: Record<string, number> = {};
    trades.forEach((t) => {
      if (t.accountType === "challenge" && activeChallengeIds.has(t.accountId)) {
        challengePnlByDate[t.entryDate] = (challengePnlByDate[t.entryDate] || 0) + t.pnl;
      } else if (t.accountType === "funded") {
        fundedPnlByDate[t.entryDate] = (fundedPnlByDate[t.entryDate] || 0) + t.pnl;
      }
    });

    const paidByDate: Record<string, number> = {};
    payouts.filter((p) => p.status === "paid").forEach((p) => {
      paidByDate[p.payoutDate] = (paidByDate[p.payoutDate] || 0) + p.receivedPayoutAmount;
    });

    const dates = [...new Set([...Object.keys(challengePnlByDate), ...Object.keys(fundedPnlByDate), ...Object.keys(paidByDate)])].sort();

    const challengeBase = challenges.filter((c) => c.status === "active").reduce((s, c) => s + c.accountSize, 0);
    const fundedBase = fundedAccounts.reduce((s, a) => s + a.initialBalance, 0);

    let challengeCapital = challengeBase;
    let fundedCapital = fundedBase;
    let cumPayouts = 0;

    return dates.map((date) => {
      challengeCapital += challengePnlByDate[date] || 0;
      fundedCapital    += fundedPnlByDate[date] || 0;
      cumPayouts       += paidByDate[date] || 0;
      return { date, challengeCapital, fundedCapital, payouts: cumPayouts };
    });
  }, [trades, payouts, fundedAccounts, challenges]);

  const chartData = useMemo(() => {
    if (!dateFrom && !dateTo) return allChartData;
    return allChartData.filter((d) => (!dateFrom || d.date >= dateFrom) && (!dateTo || d.date <= dateTo));
  }, [allChartData, dateFrom, dateTo]);

  // Smart reset: once trades finish loading with zero rows (e.g. right
  // after "Delete All Trades" in the Journal), snap the chart's date range
  // back to "All Time" so this page reads like a brand-new account. See
  // src/app/analytics/page.tsx for why this is done during render rather
  // than in a useEffect.
  const tradesEmpty = !tradesLoading && trades.length === 0;
  const [wasTradesEmpty, setWasTradesEmpty] = useState(false);
  if (tradesEmpty !== wasTradesEmpty) {
    setWasTradesEmpty(tradesEmpty);
    if (tradesEmpty) {
      setDateFrom("");
      setDateTo("");
    }
  }

  // ── Activity feed ──────────────────────────────────────────────────────────
  const activity = useMemo((): ActivityEvent[] => {
    const ev: ActivityEvent[] = [];

    challenges.forEach((c) => {
      ev.push({ id: `ch-${c.id}`, date: c.purchaseDate, label: "Challenge Created", desc: `${c.propFirmName} — ${c.accountName} · ${fmt$(c.accountSize)}`, color: "#298DFF", Icon: Target });
      if (c.status === "passed")
        ev.push({ id: `cp-${c.id}`, date: c.purchaseDate, label: "Challenge Passed", desc: `${c.propFirmName} — ${c.accountName}`, color: "#10B981", Icon: CheckCircle });
      if (c.convertedToFunded)
        ev.push({ id: `cc-${c.id}`, date: c.purchaseDate, label: "Converted to Funded", desc: `${c.propFirmName} — ${c.accountName}`, color: "#10B981", Icon: ArrowUpRight });
    });

    fundedAccounts.forEach((a) => {
      ev.push({ id: `fa-${a.id}`, date: a.fundingDate, label: "Funded Account Opened", desc: `${a.propFirmName} — ${a.accountName} · ${fmt$(a.accountSize)}`, color: "#10B981", Icon: Activity });
    });

    trades.slice(-8).forEach((t) => {
      ev.push({
        id: `tr-${t.id}`, date: t.entryDate,
        label: t.pnl >= 0 ? "Winning Trade" : "Losing Trade",
        desc: `${t.symbol} · ${t.pnl >= 0 ? "+" : ""}${fmt$(t.pnl)}`,
        color: t.pnl >= 0 ? "#10B981" : "#EF4444",
        Icon: t.pnl >= 0 ? TrendingUp : TrendingDown,
      });
    });

    const payoutMeta = {
      pending:  { label: "Payout Requested", color: "#F59E0B", Icon: Clock },
      paid:     { label: "Payout Approved",  color: "#10B981", Icon: CheckCircle },
      rejected: { label: "Payout Rejected",  color: "#EF4444", Icon: AlertCircle },
    };
    payouts.forEach((p) => {
      const m = payoutMeta[p.status];
      ev.push({ id: `py-${p.id}`, date: p.payoutDate, label: m.label, desc: `${fmt$(p.requestedPayoutAmount)} requested`, color: m.color, Icon: m.Icon });
    });

    return ev.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  }, [challenges, fundedAccounts, trades, payouts]);

  // ── Best account ───────────────────────────────────────────────────────────
  const bestAccount = useMemo(() => {
    if (!fundedAccounts.length) return null;
    return fundedAccounts.reduce((best, a) => a.currentProfit > best.currentProfit ? a : best, fundedAccounts[0]);
  }, [fundedAccounts]);

  // ── Portfolio breakdown ────────────────────────────────────────────────────
  // Prop firm names are free text, so the same firm can be saved under
  // slightly different strings across accounts (see propFirms.ts) — group by
  // normalized name so those variants merge into one entry instead of
  // splitting the breakdown across duplicates.
  const byFirmChallenge = useMemo(
    () => groupByNormalizedFirm(getRootChallenges(challenges), (c) => c.propFirmName, () => 1),
    [challenges]
  );

  const byFirmFunded = useMemo(
    () => groupByNormalizedFirm(fundedAccounts, (a) => a.propFirmName, () => 1),
    [fundedAccounts]
  );

  const capitalAlloc = useMemo(
    () => groupByNormalizedFirm(fundedAccounts, (a) => a.propFirmName, (a) => a.initialBalance),
    [fundedAccounts]
  );

  const payoutDist = useMemo(() => [
    { name: "Paid",     value: payouts.filter((p) => p.status === "paid").reduce((s, p) => s + p.receivedPayoutAmount, 0)  },
    { name: "Pending",  value: payouts.filter((p) => p.status === "pending").reduce((s, p) => s + p.requestedPayoutAmount, 0) },
    { name: "Rejected", value: payouts.filter((p) => p.status === "rejected").reduce((s, p) => s + p.requestedPayoutAmount, 0) },
  ].filter((d) => d.value > 0), [payouts]);

  // ── Pending payouts ────────────────────────────────────────────────────────
  const pendingPayouts = useMemo(
    () => [...payouts.filter((p) => p.status === "pending")].sort((a, b) => a.payoutDate.localeCompare(b.payoutDate)),
    [payouts]
  );

  const cfg = METRIC_META[metric];

  // ─────────────────────────────────────────────────────────────────────────


  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-8">

      {/* ── HERO ── */}
      <div className="relative -mx-6 -mt-6 px-6 pt-12 pb-8 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 120% at 50% 0%, rgba(41,141,255,0.35) 0%, rgba(41,141,255,0.10) 32%, rgba(41,141,255,0) 65%)" }} />
        <div className="relative">
          <motion.h1 initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            style={{ fontSize: "3.5rem", fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 1, background: gradientText.premium, backgroundClip: "text", WebkitBackgroundClip: "text", color: "transparent" }}>
            Dashboard
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.4 }}
            className="text-[#94A3B8] mt-3" style={{ fontSize: typography.fontSize.base }}>
            Your prop trading command center
          </motion.p>
        </div>
      </div>

      {/* ── SECTION 1 — 10 KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Challenge Investment" value={kpis.totalChallengeCosts}    format={fmt$}   icon={DollarSign}      iconColor="#298DFF" iconBg="rgba(41,141,255,0.1)"   dotColor="#298DFF" sublabel="Total spent on challenges" delay={0.05} />
        <KpiCard label="Funded Capital"        value={kpis.totalFundedCapital}     format={fmt$}   icon={Trophy}          iconColor="#10B981" iconBg="rgba(16,185,129,0.1)"   dotColor="#10B981" sublabel="Total funded size"         delay={0.10} />
        <KpiCard label="Payouts Received"      value={kpis.totalPayoutsReceived}   format={fmt$}   icon={CheckCircle}     iconColor="#F59E0B" iconBg="rgba(245,158,11,0.1)"   dotColor="#F59E0B" sublabel="Total paid out"            delay={0.15} />
        <KpiCard label="Net Trading Profit"    value={netTradingProfit}            format={fmt$}   icon={netTradingProfit >= 0 ? TrendingUp : TrendingDown} iconColor={netTradingProfit >= 0 ? "#10B981" : "#EF4444"} iconBg={`rgba(${netTradingProfit >= 0 ? "16,185,129" : "239,68,68"},0.1)`} dotColor={netTradingProfit >= 0 ? "#10B981" : "#EF4444"} sublabel="Across all funded accounts" delay={0.20} signed />
        <KpiCard label="Net ROI $"             value={kpis.netROI}                 format={fmt$}   icon={kpis.netROI >= 0 ? TrendingUp : TrendingDown}      iconColor={kpis.netROI >= 0 ? "#10B981" : "#EF4444"}      iconBg={`rgba(${kpis.netROI >= 0 ? "16,185,129" : "239,68,68"},0.1)`}      dotColor={kpis.netROI >= 0 ? "#10B981" : "#EF4444"}      sublabel="Payouts minus costs"          delay={0.25} signed />
        <KpiCard label="ROI %"                 value={kpis.roiPercentage}          format={fmtPct} icon={Target}          iconColor={kpis.roiPercentage >= 0 ? "#10B981" : "#EF4444"} iconBg={`rgba(${kpis.roiPercentage >= 0 ? "16,185,129" : "239,68,68"},0.1)`} dotColor={kpis.roiPercentage >= 0 ? "#10B981" : "#EF4444"} sublabel="Return on investment"  delay={0.30} signed />
        <KpiCard label="Funding Rate"          value={kpis.fundingRate}            format={fmtPct} icon={Award}           iconColor="#A855F7" iconBg="rgba(168,85,247,0.1)"   dotColor="#A855F7" sublabel="Challenge conversion rate"  delay={0.35} />
        <KpiCard label="Active Challenges"     value={kpis.activeChallengeAccounts}format={(v) => String(Math.round(v))} icon={Target} iconColor="#3B82F6" iconBg="rgba(59,130,246,0.1)" dotColor="#3B82F6" sublabel="In progress" delay={0.40} />
        <KpiCard label="Active Funded"         value={kpis.activeFundedAccounts}   format={(v) => String(Math.round(v))} icon={Activity} iconColor="#10B981" iconBg="rgba(16,185,129,0.1)" dotColor="#10B981" sublabel="Currently trading" delay={0.45} />
        <KpiCard label="Breached Accounts"     value={kpis.breachedFundedAccounts} format={(v) => String(Math.round(v))} icon={AlertTriangle} iconColor="#EF4444" iconBg="rgba(239,68,68,0.1)" dotColor="#EF4444" sublabel="Drawdown breached" delay={0.50} />
        <KpiCard
          label="Average Time to Funded"
          value={kpis.averageTimeToFundedDays ?? 0}
          format={(v) => (kpis.averageTimeToFundedDays === null ? "—" : `${Math.round(v)} days`)}
          icon={Clock}
          iconColor="#F59E0B"
          iconBg="rgba(245,158,11,0.1)"
          dotColor="#F59E0B"
          sublabel={kpis.timeToFundedSampleSize > 0 ? `Across ${kpis.timeToFundedSampleSize} funded challenge${kpis.timeToFundedSampleSize === 1 ? "" : "s"}` : "No funded challenges yet"}
          delay={0.55}
        />
      </div>

      {/* ── SECTION 2 — Performance Chart ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}
        className="relative rounded-xl p-6" style={CARD}>
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#298DFF]" />
            <h3 className="text-[#F8FAFC] font-semibold" style={{ fontSize: typography.fontSize.section }}>Performance</h3>
          </div>
          {/* Metric tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "rgba(148,163,184,0.06)", border: "1px solid rgba(148,163,184,0.12)" }}>
            {(["challengeCapital", "fundedCapital", "payouts"] as ChartMetric[]).map((m) => (
              <button key={m} type="button" onClick={() => setMetric(m)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 pointer-events-auto"
                style={{ color: metric === m ? "#F8FAFC" : "#94A3B8", background: metric === m ? `${METRIC_META[m].color}28` : "transparent" }}>
                {METRIC_META[m].label}
              </button>
            ))}
          </div>
        </div>

        <DateRangeFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onChange={(range) => { setDateFrom(range.dateFrom); setDateTo(range.dateTo); }}
          className="mb-6"
        />

        {/* Chart or empty state */}
        {allChartData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center">
            <BarChart3 className="w-10 h-10 text-[#475569] mb-3" />
            <p className="text-[#94A3B8]">No trade data yet</p>
            <p className="text-[#64748B] text-xs mt-1">Add trades to see performance</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center">
            <BarChart3 className="w-10 h-10 text-[#475569] mb-3" />
            <p className="text-[#94A3B8]">No data in selected period</p>
            <p className="text-[#64748B] text-xs mt-1">Try "All Time" or a wider range</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={cfg.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={cfg.color} stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.07)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={(v: number) => fmtShort(v)} />
              <Tooltip
                contentStyle={{ background: "rgba(11,18,32,0.95)", border: "1px solid rgba(148,163,184,0.15)", borderRadius: "12px", color: "#F8FAFC" }}
                formatter={((value: number) => [cfg.format(value), cfg.label]) as never}
              />
              <ReferenceLine y={0} stroke="rgba(148,163,184,0.2)" strokeDasharray="3 3" />
              <Area type="monotone" dataKey={metric} stroke={cfg.color} strokeWidth={2}
                fill="url(#areaGrad)" dot={false} activeDot={{ r: 4, fill: cfg.color }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* ── SECTION 3+4+5 — Activity | Best Account + Quick Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Activity Feed */}
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35, duration: 0.5 }}
          className="lg:col-span-2 relative rounded-xl p-6" style={CARD}>
          <div className="flex items-center gap-2 mb-5">
            <Zap className="w-5 h-5 text-[#298DFF]" />
            <h3 className="text-[#F8FAFC] font-semibold" style={{ fontSize: typography.fontSize.section }}>Recent Activity</h3>
          </div>
          {activity.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Zap className="w-10 h-10 text-[#475569] mb-3" />
              <p className="text-[#94A3B8]">No activity yet</p>
              <p className="text-[#64748B] text-xs mt-1">Create a challenge to get started</p>
            </div>
          ) : (
            <div className="space-y-0">
              {activity.map((ev, i) => (
                <div key={ev.id} className="flex items-start gap-3 py-2.5">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ background: `${ev.color}18`, border: `1px solid ${ev.color}38` }}>
                      <ev.Icon className="w-3.5 h-3.5" style={{ color: ev.color }} />
                    </div>
                    {i < activity.length - 1 && (
                      <div className="w-px mt-1" style={{ height: 12, background: "rgba(148,163,184,0.1)" }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pb-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#F8FAFC] text-sm font-medium">{ev.label}</span>
                      <span className="text-[#475569] text-xs flex-shrink-0">{ev.date}</span>
                    </div>
                    <p className="text-[#64748B] text-xs mt-0.5 truncate">{ev.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Best Account */}
          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.40, duration: 0.5 }}
            className="relative rounded-xl p-5" style={CARD}>
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-5 h-5 text-[#F59E0B]" />
              <h3 className="text-[#F8FAFC] font-semibold" style={{ fontSize: typography.fontSize.section }}>Best Account</h3>
            </div>
            {!bestAccount ? (
              <div className="text-center py-6">
                <Award className="w-8 h-8 text-[#475569] mx-auto mb-2" />
                <p className="text-[#64748B] text-sm">No funded accounts yet</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[rgba(16,185,129,0.1)] flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-[#10B981]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[#F8FAFC] font-semibold text-sm truncate">{bestAccount.accountName}</p>
                    <p className="text-[#94A3B8] text-xs">{bestAccount.propFirmName}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[
                    { label: "Profit",   value: fmt$(bestAccount.currentProfit),     color: "#10B981", bg: "rgba(16,185,129,0.08)"  },
                    { label: "ROI",      value: bestAccount.initialBalance > 0 ? fmtPct((bestAccount.currentProfit / bestAccount.initialBalance) * 100) : "—", color: "#298DFF", bg: "rgba(41,141,255,0.08)" },
                    { label: "Drawdown", value: fmtPct(bestAccount.remainingDrawdown), color: "#F59E0B", bg: "rgba(245,158,11,0.08)" },
                    { label: "Status",   value: bestAccount.status,                  color: "#10B981", bg: "rgba(16,185,129,0.08)"  },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label} className="rounded-lg p-2.5" style={{ background: bg }}>
                      <p className="text-[#64748B] text-xs mb-0.5">{label}</p>
                      <p className="font-bold text-sm" style={{ color }}>{value}</p>
                    </div>
                  ))}
                </div>
                <Button type="button" className="w-full text-xs rounded-lg h-9 pointer-events-auto"
                  style={{ background: "rgba(16,185,129,0.12)", color: "#10B981", border: "1px solid rgba(16,185,129,0.3)" }}
                  onClick={() => router.push(`/funded/${bestAccount.id}`)}>
                  Open Analytics
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </>
            )}
          </motion.div>

          {/* Quick Actions */}
          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45, duration: 0.5 }}
            className="relative rounded-xl p-5" style={CARD}>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-[#298DFF]" />
              <h3 className="text-[#F8FAFC] font-semibold" style={{ fontSize: typography.fontSize.section }}>Quick Actions</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([
                { label: "+ New Challenge",    color: "#298DFF", bg: "rgba(41,141,255,0.1)",  border: "rgba(41,141,255,0.25)",  Icon: Target,     action: () => setOpenChallenge(true) },
                { label: "+ Add Trade",        color: "#10B981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.25)",  Icon: TrendingUp, action: () => setOpenTrade(true)     },
                { label: "+ Request Payout",   color: "#F59E0B", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.25)",  Icon: DollarSign, action: () => setOpenPayout(true)    },
                { label: "+ Add Funded",       color: "#A855F7", bg: "rgba(168,85,247,0.1)",  border: "rgba(168,85,247,0.25)",  Icon: Activity,   action: () => setOpenFunded(true)    },
              ] as const).map(({ label, color, bg, border, Icon, action }) => (
                <button key={label} type="button" onClick={action}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl text-xs font-medium transition-all duration-200 hover:scale-105 pointer-events-auto"
                  style={{ background: bg, border: `1px solid ${border}`, color }}>
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── SECTION 6 — Portfolio Breakdown ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5 }}>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-[#298DFF]" />
          <h3 className="text-[#F8FAFC] font-semibold" style={{ fontSize: typography.fontSize.section }}>Portfolio Breakdown</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <DonutChart title="Challenges by Firm"    data={byFirmChallenge} />
          <DonutChart title="Funded by Firm"        data={byFirmFunded}    />
          <DonutChart title="Capital Allocation ($)" data={capitalAlloc}    />
          <DonutChart title="Payout Distribution"   data={payoutDist}      />
        </div>
      </motion.div>

      {/* ── SECTION 7 — Upcoming / Pending Payouts ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.5 }}
        className="relative rounded-xl p-6" style={CARD}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#F59E0B]" />
            <h3 className="text-[#F8FAFC] font-semibold" style={{ fontSize: typography.fontSize.section }}>Pending Payouts</h3>
          </div>
          {pendingPayouts.length > 0 && (
            <Badge className="bg-[rgba(245,158,11,0.15)] text-[#F59E0B] border border-[rgba(245,158,11,0.35)] rounded-full text-xs">
              {pendingPayouts.length} pending
            </Badge>
          )}
        </div>
        {pendingPayouts.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle className="w-8 h-8 text-[#10B981] mx-auto mb-2" />
            <p className="text-[#94A3B8] text-sm">No pending payouts</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingPayouts.slice(0, 4).map((p) => {
              const account = fundedAccounts.find((a) => a.id === p.fundedAccountId);
              const today = new Date();
              const payDate = new Date(p.payoutDate);
              const daysAway = Math.ceil((payDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              const dayLabel = daysAway > 0 ? `${daysAway}d away` : daysAway === 0 ? "Today" : "Overdue";
              return (
                <div key={p.id} className="flex items-center justify-between p-4 rounded-xl"
                  style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[rgba(245,158,11,0.12)] flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 text-[#F59E0B]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[#F8FAFC] text-sm font-medium truncate">{account ? account.accountName : "Unknown Account"}</p>
                      <p className="text-[#94A3B8] text-xs">{p.payoutDate} · {dayLabel}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-[#F59E0B] font-bold text-sm">{fmt$(p.requestedPayoutAmount)}</p>
                    <p className="text-[#64748B] text-xs">requested</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* ── Dialogs ── */}
      <AddChallengeDialog    open={openChallenge} onOpenChange={setOpenChallenge} />
      <AddTradeDialog        open={openTrade}     onOpenChange={setOpenTrade}     />
      <AddPayoutDialog       open={openPayout}    onOpenChange={setOpenPayout}    />
      <AddFundedAccountDialog open={openFunded}   onOpenChange={setOpenFunded}    />
    </div>
  );
}
