"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PayoutRules, FundingPath } from "@/types";
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
  Pencil, Trash2, X, Save,
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
import { useAccounts } from "@/context/AccountsContext";
import { toast } from "sonner";
import { AddTradeDialog } from "@/components/AddTradeDialog";
import { ImportTradesDialog } from "@/components/ImportTradesDialog";
import { AddPayoutDialog } from "@/components/AddPayoutDialog";
import { glassmorphism, borderRadius, typography, gradientText } from "@/design-system";
import { EditAccountRulesDialog } from "@/components/account/EditAccountRulesDialog";
import { ConsistencySimulator } from "@/components/account/ConsistencySimulator";
import { updatePayoutDb } from "@/lib/supabase/payouts";
import { parseConsistencyLimitPercent } from "@/lib/analytics/payoutEligibility";
import { getAccountOptionLabel, ORIGIN_LABEL, ORIGIN_COLOR } from "@/lib/accountLabels";

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
  const [editRulesOpen,setEditRulesOpen] = useState(false);
  const [editingPayout,setEditingPayout]=useState<{id:string;payoutDate:string}|null>(null);
  const [savingPayoutDate,setSavingPayoutDate]=useState(false);
  const [isAddTradeDialogOpen, setIsAddTradeDialogOpen] = useState(false);
  const [isImportTradeDialogOpen, setIsImportTradeDialogOpen] = useState(false);
  const [isAddPayoutDialogOpen, setIsAddPayoutDialogOpen] = useState(false);
  const { updateTrade, deleteTrade, challenges, updatePayout } = useAccounts();
  const [editingTrade, setEditingTrade] = useState<any | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<any | null>(null);
  const [isSavingTrade, setIsSavingTrade] = useState(false);
  const saveTrade = async () => {
    if (!editingTrade || isSavingTrade) return;
    if (!editingTrade.symbol?.trim() || !editingTrade.entryDate || !editingTrade.exitDate || editingTrade.exitDate < editingTrade.entryDate
      || ![editingTrade.entryPrice, editingTrade.exitPrice, editingTrade.quantity, editingTrade.pnl].every((v:number)=>Number.isFinite(v))
      || editingTrade.quantity <= 0) {
      toast.error("Check dates, prices, quantity and P&L");
      return;
    }
    setIsSavingTrade(true);
    try {
      await updateTrade(editingTrade.id, {
        symbol: editingTrade.symbol.trim(), direction: editingTrade.direction,
        entryDate: editingTrade.entryDate, exitDate: editingTrade.exitDate,
        entryPrice: editingTrade.entryPrice, exitPrice: editingTrade.exitPrice,
        quantity: editingTrade.quantity, pnl: editingTrade.pnl,
        notes: editingTrade.notes ?? ""
      });
      toast.success("Trade updated"); setEditingTrade(null);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to update trade"); }
    finally { setIsSavingTrade(false); }
  };


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
  const grossWin = winningTrades.reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, trade) => sum + trade.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : null;

  // Trading history is immutable across payouts. Only the current payout
  // cycle resets; historical strategy and risk insights still use all trades.
  const paidPayouts = useMemo(() => accountType === "funded"
    ? payouts.filter(p => p.status === "paid")
    : [], [payouts, accountType]);
  const lastPaidDate = paidPayouts.reduce((latest, p) =>
    p.payoutDate > latest ? p.payoutDate : latest, "");
  const cycleTrades = trades.filter(t => !lastPaidDate || (t.exitDate || t.entryDate) > lastPaidDate);
  const cyclePnL = cycleTrades.reduce((sum,t)=>sum+t.pnl,0);
  const savePayoutDate=async()=>{
    if(!editingPayout || savingPayoutDate || !/^\d{4}-\d{2}-\d{2}$/.test(editingPayout.payoutDate))return;
    const payout=payouts.find(p=>p.id===editingPayout.id && p.fundedAccountId===account.id);
    if(!payout)return;
    if(editingPayout.payoutDate===payout.payoutDate){setEditingPayout(null);return;}
    setSavingPayoutDate(true);
    try{
      // Write first, then update the context, so UI and consistency cycle
      // cannot claim the corrected payout date before persistence succeeds.
      await updatePayoutDb(payout.id,{payoutDate:editingPayout.payoutDate});
      updatePayout(payout.id,{payoutDate:editingPayout.payoutDate});
      toast.success("Payout date updated · consistency cycle recalculated");
      setEditingPayout(null);
    }catch(e){toast.error("Failed to update payout date: "+(e instanceof Error?e.message:String(e)))}
    finally{setSavingPayoutDate(false)}
  };
  const paidPayoutByDate = paidPayouts.reduce<Record<string,number>>((acc,p)=>{
    acc[p.payoutDate]=(acc[p.payoutDate]??0)+p.requestedPayoutAmount;
    return acc;
  }, {});

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
        // Daily realised P&L belongs to the closing day, not the opening day.
        const d = trade.exitDate || trade.entryDate;
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
      { date: "Start", balance: startBalance },
    ];
    let running = startBalance;
    for (const [date, data] of sorted) {
      running += data.pnl;
      points.push({ date, balance: running });
    }
    return points;
  }, [dailyPnL, startBalance]);

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
  const worstDay = losingDays.length > 0 ? losingDays.reduce((a, b) => (b[1].pnl < a[1].pnl ? b : a)) : null;
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
          setIsImportTradeDialogOpen={setIsImportTradeDialogOpen}
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
            onClick={() => setIsImportTradeDialogOpen(true)}
            type="button"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add First Trade from Screenshot
          </Button>
        </div>
        <AddTradeDialog open={isAddTradeDialogOpen} onOpenChange={setIsAddTradeDialogOpen} defaultAccountType={accountType} defaultAccountId={account.id} />
        <ImportTradesDialog open={isImportTradeDialogOpen} onOpenChange={setIsImportTradeDialogOpen} defaultAccountType={accountType} defaultAccountId={account.id} lockAccount />
        {accountType === "funded" && (
          <AddPayoutDialog open={isAddPayoutDialogOpen} onOpenChange={setIsAddPayoutDialogOpen} defaultFundedAccountId={account.id} />
        )}
      </div>
    );
  }

  // ─── Main view ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <Header
        account={account}
        accountType={accountType}
        allAccounts={allAccounts}
        onAccountChange={onAccountChange}
        router={router}
        setIsImportTradeDialogOpen={setIsImportTradeDialogOpen}
        setIsAddPayoutDialogOpen={setIsAddPayoutDialogOpen}
      />

      <div className="flex justify-end"><button type="button" onClick={()=>setEditRulesOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-cyan-400/25 bg-cyan-400/[.07] px-3 text-xs font-semibold text-cyan-200"><Pencil size={14}/> Edit Account Rules</button></div>
      <EditAccountRulesDialog open={editRulesOpen} onOpenChange={setEditRulesOpen} account={account} accountType={accountType}/>
      
      {/* Premium account cockpit: primary decision metrics above secondary analytics. */}
      <section className="relative overflow-hidden rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-[#13263a] via-[#101b2d] to-[#0b1423] p-4 sm:p-5">
        <div className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl"/>
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-[10px] font-bold uppercase tracking-[.19em] text-cyan-300">Account command center</p>
            <h2 className="mt-1 text-lg font-bold text-white sm:text-xl">{account.accountName} <span className="text-xs font-medium text-slate-400">· {accountType==="funded"?"Funded":"Challenge"}</span></h2>
            <p className="mt-1 text-xs text-slate-400">Realized P&L · account records, not broker-live equity</p>
          </div>
          <span className="rounded-full border border-white/15 bg-white/[.05] px-3 py-1 text-xs font-bold text-slate-200">{account.propFirmName}</span>
        </div>
        {/* Consistency: best positive closing day / net P&L for the current payout cycle. */}
        {(() => {
        const challengeOrigin = accountType === "funded" && account.sourceChallengeId
          ? challenges.find(c=>c.id===account.sourceChallengeId) : null;
        const ruleValue = accountType === "funded"
          ? (account.payoutRules?.consistency?.required ? account.payoutRules.consistency.limitPercent : parseConsistencyLimitPercent(challengeOrigin?.consistencyRule))
          : parseConsistencyLimitPercent(account.consistencyRule);
        const limit = Number(ruleValue);
        const hasLimit=ruleValue!=null && Number.isFinite(limit) && limit>0 && limit<100;
        const days=new Map<string,number>();
        for(const t of cycleTrades){const day=String(t.exitDate||t.entryDate).slice(0,10);days.set(day,(days.get(day)??0)+t.pnl);}
        const net=cycleTrades.reduce((a,t)=>a+t.pnl,0);
        const best=Math.max(0,...days.values());
        const ratio=net>0 && days.size>0?Math.min(100,days.size===1?100:100*best/net):null;
        const state=ratio===null?"Not measurable":!hasLimit?"Limit not configured":ratio<=limit?`Within ${limit}% limit`:`Above ${limit}% limit`;
        return <div className="relative mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {[
            {label:"Recorded balance",value:fmt$(accountType==="funded"?account.currentBalance:startBalance+totalPnL),sub:"Not live equity",tone:"text-white"},
            {label:"Current cycle P&L",value:fmt$(accountType==="funded"?cyclePnL:totalPnL),sub:accountType==="funded"?(lastPaidDate?"Since "+lastPaidDate:"Since funding"):"Evaluation",tone:(accountType==="funded"?cyclePnL:totalPnL)>=0?"text-emerald-300":"text-rose-300"},
            {label:"Estimated DD buffer",value:fmt$(remainingDDDollars),sub:"Simplified · check broker",tone:remainingDDDollars<=0?"text-rose-300":"text-amber-200"},
            {label:"Win rate",value:fmtPct(winRate),sub:`${trades.length} recorded trades`,tone:"text-cyan-200"},
            {label:"Consistency",value:ratio===null?"—":`${ratio.toFixed(1)}%`,sub:state,tone:ratio!==null&&hasLimit&&ratio>limit?"text-rose-300":"text-cyan-200"},
          ].map(item=><div key={item.label} className="min-w-0 rounded-xl border border-white/[.08] bg-[#0b1422]/70 p-3">
            <p className="text-[10px] text-slate-400">{item.label}</p><p className={`mt-1 break-words text-lg font-extrabold tabular-nums sm:text-2xl ${item.tone}`}>{item.value}</p><p className="mt-1 text-[10px] text-slate-500">{item.sub}</p>
          </div>)}
        </div>;
      })()}
        <div className="relative mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[.08] pt-3">
          <p className="text-xs text-slate-300">{remainingDDDollars<=0?"Review risk limits before placing another trade.":trades.length<5?"Early sample · focus on rule compliance and clean execution.":"Review drawdown and consistency limits before setting today's risk."}</p>
          <button type="button" onClick={()=>document.getElementById("account-intelligence")?.scrollIntoView({behavior:"smooth",block:"start"})} className="min-h-9 rounded-lg border border-cyan-400/25 px-3 text-xs font-semibold text-cyan-200">Risk & consistency ↓</button>
        </div>
      </section>

      {/* ── Secondary account data ────────────────────────────────────────── */}
      <details className="group rounded-xl border border-white/[.08] bg-[#0d1728] p-3 sm:p-4">
        <summary className="cursor-pointer text-xs font-semibold text-slate-300">Account details <span className="ml-1 font-normal text-slate-500">· firm, dates, targets and configuration</span></summary>
      <div
        className="mt-3 rounded-xl p-3 transition-all duration-300"
        style={{
          background: glassmorphism.card.background,
          backdropFilter: glassmorphism.card.backdropBlur,
          border: "1px solid rgba(148,163,184,0.08)",
          borderRadius: borderRadius.xl,
        }}
      >
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3 xl:grid-cols-6">
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
            label={accountType === "funded" ? "Current Cycle P&L" : "Net P&L"}
            value={fmt$(accountType === "funded" ? cyclePnL : totalPnL)}
            colored={(accountType === "funded" ? cyclePnL : totalPnL) >= 0 ? "#10B981" : "#EF4444"}
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

      </details>
      <div id="account-intelligence" className="flex flex-wrap items-center justify-between gap-2 pt-1"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-cyan-300">Risk & rules</p><h3 className="text-lg font-bold text-white">Account Intelligence</h3></div><span className="text-[10px] text-slate-500">Calculated from recorded trades</span></div>
      {(() => {
        const sourceChallenge = accountType === "funded" && account.sourceChallengeId
          ? challenges.find(c => c.id === account.sourceChallengeId) : null;
        const nativeRule = account.payoutRules?.consistency?.required
          ? account.payoutRules.consistency.limitPercent : null;
        const rule = accountType === "funded"
          ? (nativeRule ?? parseConsistencyLimitPercent(sourceChallenge?.consistencyRule))
          : parseConsistencyLimitPercent(account.consistencyRule);
        const pct = Number(rule);

        const cycleDaily = cycleTrades.reduce((acc:Record<string,{pnl:number;trades:number}>,t)=>{
          const d=String(t.exitDate||t.entryDate).slice(0,10);
          if(!acc[d])acc[d]={pnl:0,trades:0};
          acc[d].pnl+=t.pnl;acc[d].trades++;return acc;
        },{});
        const target=accountType==="challenge" && account.profitTarget>0?Number(account.profitTarget):null;
        return <div className="space-y-1">{accountType==="funded"&&<p className="text-xs text-slate-400">Current consistency cycle: {lastPaidDate?`after paid payout on ${lastPaidDate}`:"from account funding · no paid payout yet"}. Closing dates determine inclusion.</p>}<ConsistencySimulator daily={cycleDaily} limit={rule!=null && pct>0 && pct<100?pct:null} target={target}/></div>;
      })()}

      <div className="grid gap-4 lg:grid-cols-2">
      {/* ── Trading Requirements ──────────────────────────────────────────── */}
      {/* Static payout-eligibility rules from PayoutRules — funded accounts
          with their own native rules only (Instant Funded, etc.); a
          converted account's rules live on its source Challenge instead and
          are surfaced through AI Coach's payout-readiness checks, not here. */}
      {accountType === "funded" && account.fundingPath && account.fundingPath !== "evaluation" && (() => {
        const fundingPath = account.fundingPath as FundingPath;
        return (
        <div
          className="rounded-xl p-5 transition-all duration-300"
          style={{
            background: glassmorphism.card.background,
            backdropFilter: glassmorphism.card.backdropBlur,
            border: "1px solid rgba(148,163,184,0.08)",
            borderRadius: borderRadius.xl,
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <p className="text-[#F8FAFC] font-bold" style={{ fontSize: typography.fontSize.section }}>
              Trading Requirements
            </p>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{
                background: `${ORIGIN_COLOR[fundingPath]}26`,
                color: ORIGIN_COLOR[fundingPath],
                border: `1px solid ${ORIGIN_COLOR[fundingPath]}66`,
              }}
            >
              {ORIGIN_LABEL[fundingPath]}
            </span>
          </div>
          {(() => {
            const rules = account.payoutRules as PayoutRules | undefined;
            const lines: { label: string; value: string }[] = [];
            if (rules?.consistency.required && rules.consistency.limitPercent != null) {
              lines.push({ label: "Consistency", value: `${rules.consistency.limitPercent}% maximum` });
            }
            if (rules?.minimumTradingDays.required && rules.minimumTradingDays.days != null) {
              lines.push({
                label: "Minimum trading days",
                value: `${rules.minimumTradingDays.days} day${rules.minimumTradingDays.days === 1 ? "" : "s"}`,
              });
              const qualifying = rules.minimumTradingDays.qualifyingDailyProfit;
              if (qualifying) {
                const amount = qualifying.type === "fixed" ? fmt$(qualifying.value) : `${qualifying.value}% of initial balance`;
                lines.push({ label: "Qualifying day", value: `≥ ${amount} net profit` });
              }
            }
            if (lines.length === 0) {
              return <p className="text-xs text-[#94A3B8]">No minimum trading-day or consistency requirement</p>;
            }
            return (
              <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                {lines.map((line) => (
                  <div key={line.label}>
                    <p className="text-[#64748B] text-xs mb-0.5">{line.label}</p>
                    <p className="text-[#F8FAFC] font-medium">{line.value}</p>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
        );
      })()}

        <div className="rounded-xl border border-white/10 bg-[#0D1420] p-5 text-sm text-[#94A3B8]">
          <h3 className="mb-3 font-semibold text-white">Risk guardrails</h3>
          <p>Maximum drawdown: <strong className="text-white">{fmt$(maxDDDollars)}</strong></p>
          <p className="mt-2">Remaining buffer: <strong className={remainingDDDollars > 0 ? "text-emerald-400" : "text-red-400"}>{fmt$(remainingDDDollars)}</strong></p>
          <p className="mt-2">Drawdown floor: <strong className="text-white">{fmt$(drawdownFloor)}</strong></p>
          <p className="mt-3 text-xs">Verify daily-loss, trailing and consistency rules in your prop firm agreement before placing trades.</p>
        </div>
      <div className="relative flex h-full min-w-0 flex-col justify-between overflow-hidden rounded-xl border border-[#298DFF]/20 bg-[#0B1422] p-5">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#298DFF]/10 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#298DFF]/15"><Activity className="h-5 w-5 text-[#68B5FF]" /></div>
              <div><p className="text-sm font-bold tracking-tight text-white">EdgePilot <span className="text-[#7ABEFF]">Insights</span></p><p className="text-[10px] text-[#94A3B8]">ACCOUNT INTELLIGENCE · RULE-BASED</p></div>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${remainingDDDollars <= 0 ? "border-red-500/30 bg-red-500/10 text-red-400" : remainingDDDollars < maxDDDollars * 0.3 ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"}`}>
              {remainingDDDollars <= 0 ? "Buffer exhausted" : remainingDDDollars < maxDDDollars * 0.3 ? "Buffer low" : "Buffer available"}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.035] p-2.5"><p className="text-[10px] text-[#94A3B8]">DD buffer*</p><p className="mt-1 text-lg font-bold tabular-nums text-white">{fmt$(remainingDDDollars)}</p></div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.035] p-2.5"><p className="text-[10px] text-[#94A3B8]">{accountType === "challenge" ? "Target progress" : "Lifetime Trade P&L"}</p><p className="mt-1 text-lg font-bold tabular-nums text-[#7ABEFF]">{accountType === "challenge" ? fmtPct(targetProgress) : fmt$(totalPnL)}</p></div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.035] p-2.5"><p className="text-[10px] text-[#94A3B8]">Trade sample</p><p className="mt-1 text-lg font-bold tabular-nums text-white">{trades.length} <span className="text-xs font-normal text-[#94A3B8]">trades</span></p></div>
          </div>
          <div className="mt-4 border-l-2 border-[#298DFF] pl-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#75B8FF]">Trading desk brief</p>
            <p className="mt-1 text-sm font-medium leading-relaxed text-[#E2E8F0]">
              {remainingDDDollars <= 0
                ? "Estimated drawdown buffer is exhausted. Review account rules and balances before trading."
                : remainingDDDollars < maxDDDollars * 0.3
                ? "Drawdown buffer is limited. Prioritize capital preservation before new exposure."
                : trades.length < 10
                ? "Early trading sample. Protect the available drawdown buffer and build a consistent track record."
                : "Keep position sizing aligned with the remaining drawdown buffer and account objectives."}
            </p>
          </div>
        </div>
        <div className="relative mt-4 flex flex-wrap items-end justify-between gap-2 border-t border-white/[0.08] pt-3">
          <p className="max-w-[230px] text-[10px] leading-relaxed text-[#64748B]">*Simplified estimate, not a live daily or trailing drawdown check.</p>
          <button type="button" onClick={() => router.push("/edgepilot")} className="rounded-lg bg-[#298DFF] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#1D74D9]">Ask EdgePilot →</button>
        </div>
      </div>
      </div>
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
      {/* ── Equity Curve ──────────────────────────────────────────────────── */}
      <div
        className="min-w-0 rounded-xl p-4 transition-all duration-300"
        style={{
          background: glassmorphism.card.background,
          backdropFilter: glassmorphism.card.backdropBlur,
          border: "1px solid rgba(148,163,184,0.08)",
          borderRadius: borderRadius.xl,
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
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
          <div className="flex flex-wrap gap-3 text-xs">
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

        <div className="h-[260px]">
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
                  if (v === "Start") return "Start";
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
        className="min-w-0 rounded-xl p-4 transition-all duration-300"
        style={{
          background: glassmorphism.card.background,
          backdropFilter: glassmorphism.card.backdropBlur,
          border: "1px solid rgba(148,163,184,0.08)",
          borderRadius: borderRadius.xl,
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
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
              className="text-[#F8FAFC] font-medium min-w-[115px] text-center"
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
        <div className="grid grid-cols-7 gap-1 mb-1.5">
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
        <div className="grid grid-cols-7 gap-1">
          {monthDays.map((date, idx) => {
            if (!date) return <div key={idx} className="h-11 sm:h-12" />;
            const data = getDayData(date);
            const payoutAmount = paidPayoutByDate[toDateKey(date)] ?? 0;
            const today = isToday(date);
            return (
              <div
                key={idx}
                className="h-11 sm:h-12 min-w-0 rounded-lg p-1.5 flex flex-col transition-colors duration-200 hover:bg-white/[0.06]"
                style={{
                  background: payoutAmount && !data ? "rgba(212,175,55,0.13)" : data
                    ? data.pnl >= 0
                      ? "rgba(16,185,129,0.12)"
                      : "rgba(239,68,68,0.12)"
                    : "rgba(11,18,32,0.5)",
                  border: `1px solid ${
                    today
                      ? "#D4AF37"
                      : payoutAmount && !data ? "rgba(212,175,55,0.45)" : data
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
                {payoutAmount > 0 && (
                  <span title={`Paid payout: ${fmt$(payoutAmount)} withdrawn`} className="mt-auto truncate text-[9px] font-semibold text-[#D4AF37]">＄{fmt$(payoutAmount)}</span>
                )}
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
        <div className="flex flex-wrap gap-2 mt-3 text-[10px] text-[#64748B]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-[rgba(16,185,129,0.3)]" /> Profitable day
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-[rgba(239,68,68,0.3)]" /> Losing day
          </span>
          <span className="flex items-center gap-1.5">
            <span className="font-bold text-[#D4AF37]">$</span> Paid payout
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded border border-[#D4AF37]" /> Today
          </span>
        </div>
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
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
            value={worstDay ? fmt$(worstDay[1].pnl) : "—"}
            color="#EF4444"
            sub={worstDay ? worstDay[0] : "—"}
          />
          <StatCard icon={DollarSign} label="Avg Daily P&L" value={fmt$(avgDailyPnL)} color={avgDailyPnL >= 0 ? "#10B981" : "#EF4444"} sub="Per trading day" />
          <StatCard icon={Target} label="Profit Factor" value={profitFactor === null ? "—" : Number.isFinite(profitFactor) ? profitFactor.toFixed(2) : "∞"} color="#D4AF37" sub={`${fmt$(avgWin)} avg win`} />
          <StatCard icon={TrendingUp} label="Best Trade" value={winningTrades.length > 0 ? fmt$(Math.max(...winningTrades.map((t) => t.pnl))) : "$0"} color="#10B981" />
          <StatCard icon={TrendingDown} label="Worst Trade" value={losingTrades.length > 0 ? fmt$(Math.min(...losingTrades.map((t) => t.pnl))) : "$0"} color="#EF4444" />
          <StatCard icon={TrendingUp} label="Avg Win" value={fmt$(avgWin)} color="#10B981" sub={`${winningTrades.length} trades`} />
          <StatCard icon={TrendingDown} label="Avg Loss" value={fmt$(avgLoss)} color="#EF4444" sub={`${losingTrades.length} trades`} />
        </div>
      </div>

      {accountType==="funded"&&<details className="rounded-2xl border border-white/10 bg-[#0D121C] p-3 sm:p-5">
        <summary className="cursor-pointer text-sm font-semibold text-white">Payout History · {payouts.length} <span className="ml-2 text-xs font-normal text-slate-400">Edit payout date</span></summary>
        <div className="mt-3 space-y-2">{payouts.length?payouts.map(p=><div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.03] p-3">
          <div><p className="text-sm font-semibold text-white">{fmt$(p.requestedPayoutAmount)} · {p.status}</p><p className="text-xs text-slate-400">{p.payoutDate}</p></div>
          <button type="button" onClick={()=>setEditingPayout({id:p.id,payoutDate:p.payoutDate})} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-white/20 px-3 text-xs text-cyan-200"><Pencil size={14}/> Edit date</button>
        </div>):<p className="text-xs text-slate-400">No payouts recorded.</p>}</div>
      </details>}
      {editingPayout&&<div role="dialog" aria-modal="true" aria-label="Edit payout date" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-3">
        <div className="w-full max-w-sm rounded-xl border border-white/20 bg-[#101a2b] p-5 text-white"><h3 className="font-semibold">Edit payout date</h3>
          <p className="mt-1 text-xs text-slate-400">For paid payouts, this date defines the beginning of the next funded consistency cycle. Amounts and status are unchanged.</p>
          <input type="date" value={editingPayout.payoutDate} onChange={e=>setEditingPayout(v=>v?{...v,payoutDate:e.target.value}:null)} className="mt-3 min-h-11 w-full rounded-lg border border-white/15 bg-[#080d1b] p-2 text-white [color-scheme:dark]"/>
          <div className="mt-4 flex gap-2"><button type="button" onClick={()=>setEditingPayout(null)} className="min-h-10 flex-1 rounded-lg border border-white/20">Cancel</button>
          <button type="button" onClick={()=>void savePayoutDate()} disabled={savingPayoutDate||!editingPayout.payoutDate} className="min-h-10 flex-1 rounded-lg bg-cyan-600 font-semibold disabled:opacity-40">Save date</button></div>
        </div>
      </div>}
      {/* Account-scoped trade history; journal is no longer a primary navigation destination. */}
      <details className="rounded-2xl border border-white/10 bg-[#0D121C] p-3 sm:p-5">
        <summary className="cursor-pointer select-none text-sm font-semibold text-white">Trade History · {trades.length} trades <span className="ml-2 text-xs font-normal text-slate-400">View account journal</span></summary>
        <div className="mt-4 max-h-[55dvh] space-y-2 overflow-y-auto overscroll-contain">
          {trades.length === 0 ? <p className="py-5 text-sm text-slate-400">No trades recorded for this account.</p> :
            [...trades].sort((a,b) => String(b.exitDate || b.entryDate).localeCompare(String(a.exitDate || a.entryDate))).map(trade => (
              <div key={trade.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <div className="min-w-0"><p className="truncate text-sm font-medium text-white">{trade.symbol || "Trade"}</p><p className="text-[11px] text-slate-400">{trade.direction || "—"}</p></div>
                <p className="hidden text-xs text-slate-400 sm:block">{trade.exitDate || trade.entryDate}</p>
                <p className="hidden text-xs text-slate-400 sm:block">{trade.status || "—"}</p>
                <div className="text-right"><p className={`text-sm font-semibold ${trade.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{fmt$(trade.pnl)}</p><p className="text-[11px] text-slate-400 sm:hidden">{trade.exitDate || trade.entryDate}</p></div>
                <div className="col-span-2 flex justify-end gap-2 sm:col-span-4">
                  <button type="button" onClick={() => setEditingTrade({...trade})} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-white/15 px-3 text-xs text-slate-200"><Pencil className="h-3.5 w-3.5"/> Edit</button>
                  <button type="button" onClick={() => setDeleteCandidate(trade)} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-rose-500/30 px-3 text-xs text-rose-300"><Trash2 className="h-3.5 w-3.5"/> Delete</button>
                </div>
              </div>
            ))}
        </div>
      </details>

      {editingTrade && (
        <div role="dialog" aria-modal="true" aria-label="Edit trade" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-3">
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-[#101A2B] p-4 text-white">
            <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">Edit trade</h3><button aria-label="Close" onClick={()=>setEditingTrade(null)}><X className="h-5 w-5"/></button></div>
            <div className="grid grid-cols-2 gap-3">
              {(["symbol","entryDate","exitDate","entryPrice","exitPrice","quantity","pnl"] as const).map(field => (
                <label key={field} className={field==="symbol"?"col-span-2 text-xs text-slate-300":"min-w-0 text-xs text-slate-300"}>{field.replace(/([A-Z])/g," $1")}
                  <input type={field.toLowerCase().includes("date")?"date":["symbol"].includes(field)?"text":"number"} step="any"
                    value={editingTrade[field] ?? ""} onChange={e=>setEditingTrade((current:any)=>({...current,[field]:["entryPrice","exitPrice","quantity","pnl"].includes(field)?Number(e.target.value):e.target.value}))}
                    className="mt-1 block w-full min-w-0 rounded-lg border border-white/20 bg-[#080D1B] px-2 py-2.5 text-sm text-white [color-scheme:dark]" />
                </label>
              ))}
              <label className="col-span-2 text-xs text-slate-300">Direction
                <select value={editingTrade.direction} onChange={e=>setEditingTrade((t:any)=>({...t,direction:e.target.value}))} className="mt-1 w-full rounded-lg bg-[#080D1B] p-2.5"><option value="long">Buy / Long</option><option value="short">Sell / Short</option></select>
              </label>
              <label className="col-span-2 text-xs text-slate-300">Notes
                <textarea value={editingTrade.notes ?? ""} onChange={e=>setEditingTrade((t:any)=>({...t,notes:e.target.value}))} className="mt-1 w-full rounded-lg bg-[#080D1B] p-2.5" rows={2}/>
              </label>
            </div>
            <button onClick={saveTrade} disabled={isSavingTrade} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-semibold disabled:opacity-50"><Save className="h-4 w-4"/> Save changes</button>
          </div>
        </div>
      )}
      {deleteCandidate && (
        <div role="alertdialog" aria-modal="true" aria-label="Delete trade confirmation" className="fixed inset-0 z-[95] flex items-center justify-center bg-black/75 p-3">
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#101A2B] p-5 text-white">
            <h3 className="font-semibold">Delete this trade?</h3>
            <p className="my-3 text-sm text-slate-300">{deleteCandidate.symbol} · {deleteCandidate.entryDate} · {fmt$(deleteCandidate.pnl)}. This action cannot be undone.</p>
            <div className="flex gap-2">
              <button className="min-h-11 flex-1 rounded-xl border border-white/20" onClick={()=>setDeleteCandidate(null)}>Cancel</button>
              <button className="min-h-11 flex-1 rounded-xl bg-rose-600 font-semibold" onClick={()=>{deleteTrade(deleteCandidate.id);setDeleteCandidate(null);toast.success("Trade deletion requested");}}>Delete trade</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dialogs ───────────────────────────────────────────────────────── */}
      <AddTradeDialog open={isAddTradeDialogOpen} onOpenChange={setIsAddTradeDialogOpen} defaultAccountType={accountType} defaultAccountId={account.id} />
        <ImportTradesDialog open={isImportTradeDialogOpen} onOpenChange={setIsImportTradeDialogOpen} defaultAccountType={accountType} defaultAccountId={account.id} lockAccount />
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
  setIsImportTradeDialogOpen,
  setIsAddPayoutDialogOpen,
}: {
  account: any;
  accountType: "challenge" | "funded";
  allAccounts: any[];
  onAccountChange: (id: string) => void;
  router: any;
  setIsImportTradeDialogOpen: (v: boolean) => void;
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
              Manage Account
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
          {accountType === "funded" && account.fundingPath && account.fundingPath !== "evaluation" && (() => {
            const fundingPath = account.fundingPath as FundingPath;
            return (
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{ background: `${ORIGIN_COLOR[fundingPath]}26`, color: ORIGIN_COLOR[fundingPath], border: `1px solid ${ORIGIN_COLOR[fundingPath]}66` }}
              >
                {ORIGIN_LABEL[fundingPath]}
              </span>
            );
          })()}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className="border-[rgba(148,163,184,0.2)] text-[#F8FAFC] hover:bg-[rgba(41,141,255,0.1)] hover:border-[#298DFF] rounded-xl pointer-events-auto transition-all duration-300"
          onClick={() => setIsImportTradeDialogOpen(true)}
          type="button"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Trade from Screenshot
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
