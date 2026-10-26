"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DollarSign, TrendingUp, TrendingDown, Target, Activity,
  Clock, CheckCircle, AlertCircle, Award, BarChart3,
  ArrowUpRight, Trophy, AlertTriangle, Zap, ArrowRight, Trash2
} from "lucide-react";
import { motion } from "framer-motion";
import {
  PieChart, Pie, Cell,
} from "recharts";
import { useAccounts } from "@/context/AccountsContext";
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
    getDashboardKPIs, deleteChallenge, deleteFundedAccount,
  } = useAccounts();

  const [accountFilter, setAccountFilter] = useState<"all" | "challenge" | "funded" | "instant" | "archived">("all");
  const [openChallenge, setOpenChallenge] = useState(false);
  const [openTrade, setOpenTrade]         = useState(false);
  const [openPayout, setOpenPayout]       = useState(false);
  const [openFunded, setOpenFunded]       = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<{id:string;name:string;kind:"challenge"|"funded"} | null>(null);
  const [deleteText, setDeleteText] = useState("");

  const isLoading = challengesLoading || fundedAccountsLoading || tradesLoading || payoutsLoading;
  const kpis = getDashboardKPIs();

  // ── Extra KPIs not in DashboardKPIs ───────────────────────────────────────
  const netTradingProfit = useMemo(
    () => fundedAccounts.reduce((s, a) => s + a.currentProfit, 0),
    [fundedAccounts]
  );

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

  const currentAccounts = useMemo(() => [
    ...challenges.filter(c => !c.parentChallengeId && !c.convertedToFunded).map(data => ({ kind: "challenge" as const, data })),
    ...fundedAccounts.map(data => ({ kind: "funded" as const, data })),
  ].sort((a, b) => {
    const priority = (s: string) => s === "active" ? 0 : s === "step1_completed" ? 1 : s === "passed" ? 2 : 3;
    return priority(a.data.status) - priority(b.data.status);
  }), [challenges, fundedAccounts]);


  const filteredAccounts = currentAccounts.filter((account) => {
    const archived = account.kind === "challenge"
      ? ["failed", "refunded"].includes(account.data.status)
      : ["breached", "closed"].includes(account.data.status);
    if (accountFilter === "archived") return archived;
    if (archived) return accountFilter === "all";
    if (accountFilter === "challenge") return account.kind === "challenge" && account.data.challengeKind !== "instant";
    if (accountFilter === "funded") return account.kind === "funded" && account.data.fundingPath !== "instant";
    if (accountFilter === "instant") return account.kind === "funded" && account.data.fundingPath === "instant" || account.kind === "challenge" && account.data.challengeKind === "instant";
    return true;
  });

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

      {/* ── SECTION 2 — Account command center ── */}
      <section id="your-accounts" className="space-y-3 sm:space-y-5 scroll-mt-20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-[#298DFF]" />
              <h2 className="text-xl font-bold text-[#F8FAFC]">Your Accounts</h2>
              <span className="rounded-full bg-white/[0.07] px-2.5 py-1 text-xs text-[#94A3B8]">{currentAccounts.length}</span>
            </div>
            <p className="mt-1 text-sm text-[#94A3B8]">Your challenges and funded accounts, ready to manage.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setOpenChallenge(true)} className="rounded-lg bg-[#298DFF] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1D74D9]">+ Add Challenge</button>
            <button type="button" onClick={() => setOpenFunded(true)} className="rounded-lg border border-[#298DFF]/40 bg-[#298DFF]/10 px-3 py-2 text-xs font-semibold text-[#91C5FF] hover:bg-[#298DFF]/20">+ Add Funded</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Account filters">
          {([
            ["all", "All Accounts"], ["challenge", "Challenges"], ["funded", "Funded"],
            ["instant", "Instant"], ["archived", "Archived"],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setAccountFilter(id)}
              aria-pressed={accountFilter === id}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${accountFilter === id ? "border-[#298DFF]/60 bg-[#298DFF]/20 text-[#91C5FF]" : "border-white/10 text-[#94A3B8] hover:bg-white/5 hover:text-white"}`}>
              {label}
            </button>
          ))}
        </div>
        {filteredAccounts.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-[#0B111D] px-6 py-14 text-center">
            <Target className="mb-4 h-10 w-10 text-[#64748B]" />
            <h3 className="text-lg font-semibold text-white">{currentAccounts.length ? "No accounts in this category" : "Your account journey starts here"}</h3>
            <p className="mt-2 max-w-md text-sm text-[#94A3B8]">Add a challenge or funded account to see its progress and risk position at a glance.</p>
            <button type="button" onClick={() => setOpenChallenge(true)}
              className="mt-5 rounded-xl bg-[#298DFF] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1D74D9]">+ New Challenge</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-3">
            {filteredAccounts.map((account, index) => {
              const isChallenge = account.kind === "challenge";
              const name = account.data.accountName;
              const firm = account.data.propFirmName;
              const size = account.data.accountSize;
              const profit = account.data.currentProfit;
              const remaining = account.data.remainingDrawdown;
              const status = account.data.status;
              const statusColor = status === "active" ? "#10B981" : status === "passed" || status === "step1_completed" ? "#60A5FA" : status === "failed" || status === "breached" ? "#EF4444" : "#94A3B8";
              const phase = isChallenge ? (account.data.challengeKind === "instant" ? "Instant" : account.data.challengeStep === "2" ? "Phase 2" : account.data.challengeKind === "2-step" ? "Phase 1" : "Challenge") : (account.data.fundingPath === "instant" ? "Instant Funded" : "Funded");
              const equity = isChallenge ? size + profit : account.data.currentBalance;
              return (
                <motion.article key={account.kind + account.data.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.05, 0.3) }}
                  className="group min-w-0 rounded-2xl border border-white/[0.09] bg-[#0D121C] p-2.5 sm:p-4 transition-all duration-200 hover:bg-[#101925]" style={{ borderTop: "3px solid " + (phase.toLowerCase().includes("instant") ? "#A78BFA" : isChallenge ? "#E7AD4E" : "#20B99B") }}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wider text-[#64748B]">{firm}</p>
                      <h3 className="mt-1 truncate text-sm sm:text-base font-semibold text-[#F8FAFC]">{name}</h3>
                      <p className="mt-1 text-[10px] sm:text-xs font-semibold" style={{color:phase.toLowerCase().includes("instant") ? "#A78BFA" : isChallenge ? "#E7AD4E" : "#20B99B"}}>{phase} · {isChallenge ? "Evaluation" : "Funded Account"}</p>
                    </div>
                    <span className="rounded-full px-3 py-1 text-xs font-semibold capitalize" style={{ color: statusColor, background: statusColor + "19", border: "1px solid " + statusColor + "35" }}>{status.replaceAll("_", " ")}</span>
                  </div>
                  <div className="my-3 h-px bg-white/[0.07]" />
                  <div className="grid grid-cols-3 gap-x-1.5 gap-y-2 sm:gap-x-3 sm:gap-y-3">
                    <div><p className="text-[9px] sm:text-xs text-[#94A3B8]">Starting Capital</p><p className="mt-1 text-xs sm:text-base font-bold tabular-nums text-white">{fmt$(size)}</p></div>
                    <div><p className="text-[9px] sm:text-xs text-[#94A3B8]">Current Balance</p><p className="mt-1 text-xs sm:text-base font-bold tabular-nums text-white">{fmt$(equity)}</p></div>
                    <div><p className="text-[9px] sm:text-xs text-[#94A3B8]">Net P&L</p><p className="mt-1 text-xs sm:text-base font-bold tabular-nums" style={{ color: profit >= 0 ? "#10B981" : "#EF4444" }}>{profit > 0 ? "+" : ""}{fmt$(profit)}</p></div>
                    <div className="col-span-3">
                      <div className="flex justify-between gap-3 text-xs"><span className="text-[#94A3B8]">Remaining drawdown</span><span className="font-semibold tabular-nums" style={{ color: remaining <= 0 ? "#EF4444" : remaining < size * 0.02 ? "#F59E0B" : "#CBD5E1" }}>{fmt$(remaining)}</span></div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full" style={{ width: Math.max(0, Math.min(100, remaining / (account.data.maxDrawdown || 1) * 100)) + "%", background: remaining <= 0 ? "#EF4444" : remaining < size * 0.02 ? "#F59E0B" : "#10B981" }} /></div>
                    </div>
                  </div>
                  <button type="button" onClick={() => router.push(isChallenge ? `/challenges/${account.data.id}` : `/funded/${account.data.id}`)}
                    className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-xl border border-[#298DFF]/30 bg-[#298DFF]/15 px-2 py-2.5 text-xs sm:text-sm font-semibold text-[#8FC2FF] transition group-hover:bg-[#298DFF] group-hover:text-white">
                    Manage Account <ArrowRight className="h-4 w-4" />
                  </button>
                  <button type="button"
                    onClick={() => {setDeleteCandidate({id:account.data.id,name,kind:account.kind});setDeleteText("");}}
                    aria-label={`Delete ${name}`}
                    className="mt-1.5 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg text-[11px] font-medium text-rose-300/80 transition hover:bg-rose-500/10 hover:text-rose-200">
                    <Trash2 className="h-3.5 w-3.5" /> Delete Account
                  </button>
                </motion.article>
              );
            })}
          </div>
        )}
      </section>

      {deleteCandidate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3" role="alertdialog" aria-modal="true" aria-labelledby="delete-account-title">
          <div className="w-full max-w-sm rounded-2xl border border-rose-500/25 bg-[#101A2B] p-4 text-white shadow-2xl sm:p-5">
            <h3 id="delete-account-title" className="text-lg font-bold">Delete account?</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Permanently delete <strong className="text-white">{deleteCandidate.name}</strong> and its linked trade history.
              This action cannot be undone.
            </p>
            <label className="mt-4 block text-xs text-slate-300">
              Type <strong>DELETE</strong> to confirm
              <input autoFocus value={deleteText} onChange={e=>setDeleteText(e.target.value)} placeholder="DELETE"
                className="mt-2 min-h-11 w-full rounded-lg border border-white/15 bg-[#080D1B] px-3 text-base text-white outline-none focus:border-rose-400" />
            </label>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" className="min-h-11 rounded-xl border border-white/15 text-sm font-semibold" onClick={()=>setDeleteCandidate(null)}>Cancel</button>
              <button type="button" disabled={deleteText !== "DELETE"} onClick={()=>{
                if(!deleteCandidate || deleteText !== "DELETE") return;
                if(deleteCandidate.kind==="challenge") deleteChallenge(deleteCandidate.id);
                else deleteFundedAccount(deleteCandidate.id);
                setDeleteCandidate(null);setDeleteText("");
              }} className="min-h-11 rounded-xl bg-rose-600 px-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">Delete permanently</button>
            </div>
          </div>
        </div>
      )}

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
                { label: "Your Accounts",       color: "#10B981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.25)",  Icon: TrendingUp, action: () => document.getElementById("your-accounts")?.scrollIntoView({behavior:"smooth"}) },
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
