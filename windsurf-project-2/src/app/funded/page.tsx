"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Wallet, TrendingUp, DollarSign, Calendar, Plus, Trash2, BarChart3, LayoutGrid, List } from "lucide-react";
import { useAccounts } from "@/context/AccountsContext";
import { FundedAccountStatus, FundedAccount, FundingPath } from "@/types";
import { ORIGIN_LABEL, ORIGIN_COLOR } from "@/lib/accountLabels";
import { AddFundedAccountDialog } from "@/components/AddFundedAccountDialog";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { colors, typography, borderRadius, glassmorphism, gradientBorder, gradientText } from "@/design-system";
import { computeDrawdown } from "@/lib/drawdown";

type FundedStatusFilter = "all" | FundedAccountStatus;
type OriginFilter = "all" | FundingPath;
type ViewMode = "cards" | "table";

const FUNDED_STATUS_COLOR: Record<FundedAccountStatus, string> = {
  active: "#10B981",
  breached: "#EF4444",
  closed: "#94A3B8",
};

// Static payout-eligibility rules from a FundedAccount's own PayoutRules —
// "what are the rules", not "is the account currently eligible" (that's
// evaluatePayoutEligibility, used by AI Coach/Risk Center against live
// trade history). A disabled rule is simply omitted, never shown as "off".
function getPayoutRuleLines(account: FundedAccount, formatCurrency: (v: number) => string): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = [];
  const { consistency, minimumTradingDays } = account.payoutRules;
  if (consistency.required && consistency.limitPercent != null) {
    lines.push({ label: "Consistency", value: `${consistency.limitPercent}% maximum` });
  }
  if (minimumTradingDays.required && minimumTradingDays.days != null) {
    lines.push({ label: "Minimum trading days", value: `${minimumTradingDays.days} day${minimumTradingDays.days === 1 ? "" : "s"}` });
    const qualifying = minimumTradingDays.qualifyingDailyProfit;
    if (qualifying) {
      const amount = qualifying.type === "fixed" ? formatCurrency(qualifying.value) : `${qualifying.value}% of initial balance`;
      lines.push({ label: "Qualifying day", value: `≥ ${amount} net profit` });
    }
  }
  return lines;
}

export default function Funded() {
  const router = useRouter();
  const { fundedAccounts, fundedAccountsLoading, challenges, updateFundedAccount, deleteFundedAccount, getAccountPnL } = useAccounts();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getStatusColor = (status: FundedAccountStatus) => {
    switch (status) {
      case 'active': return 'bg-[rgba(16,185,129,0.15)] text-[#10B981] border border-[rgba(16,185,129,0.4)] font-semibold rounded-full';
      case 'breached': return 'bg-[rgba(239,68,68,0.15)] text-[#EF4444] border border-[rgba(239,68,68,0.4)] font-semibold rounded-full';
      case 'closed': return 'bg-[rgba(148,163,184,0.15)] text-[#94A3B8] border border-[rgba(148,163,184,0.4)] font-semibold rounded-full';
      default: return 'bg-[rgba(148,163,184,0.15)] text-[#94A3B8] border border-[rgba(148,163,184,0.4)] font-semibold rounded-full';
    }
  };

  const getStatusBgColor = (status: FundedAccountStatus) => {
    switch (status) {
      case 'active': return 'bg-[rgba(16,185,129,0.1)]';
      case 'breached': return 'bg-[rgba(239,68,68,0.1)]';
      case 'closed': return 'bg-[rgba(148,163,184,0.1)]';
      default: return 'bg-[rgba(148,163,184,0.1)]';
    }
  };

  const getStatusTextColor = (status: FundedAccountStatus) => {
    switch (status) {
      case 'active': return 'text-[#10B981]';
      case 'breached': return 'text-[#EF4444]';
      case 'closed': return 'text-[#94A3B8]';
      default: return 'text-[#94A3B8]';
    }
  };

  const handleStatusChange = (id: string, newStatus: FundedAccountStatus) => {
    updateFundedAccount(id, { status: newStatus });
  };

  const getFundedAccountPnL = (account: any) => {
    const tradePnL = getAccountPnL(account.id, "funded");
    return (account.currentBalance - account.initialBalance) + tradePnL;
  };

  const totalCapital = fundedAccounts.reduce((sum, account) => sum + account.accountSize, 0);
  const totalProfit = fundedAccounts.reduce((sum, account) => sum + getFundedAccountPnL(account), 0);
  const activeAccounts = fundedAccounts.filter(a => a.status === 'active').length;
  const breachedAccounts = fundedAccounts.filter(a => a.status === 'breached').length;

  const [statusFilter, setStatusFilter] = useState<FundedStatusFilter>("all");
  const [originFilter, setOriginFilter] = useState<OriginFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  const statusCounts = useMemo(() => {
    const counts: Record<FundedStatusFilter, number> = { all: fundedAccounts.length, active: 0, breached: 0, closed: 0 };
    fundedAccounts.forEach((a) => { counts[a.status] += 1; });
    return counts;
  }, [fundedAccounts]);

  const originCounts = useMemo(() => {
    const counts: Record<OriginFilter, number> = { all: fundedAccounts.length, evaluation: 0, instant: 0, giveaway: 0, affiliate: 0, internal: 0 };
    fundedAccounts.forEach((a) => { counts[a.fundingPath] += 1; });
    return counts;
  }, [fundedAccounts]);

  const filteredAccounts = useMemo(
    () =>
      fundedAccounts.filter(
        (a) => (statusFilter === "all" || a.status === statusFilter) && (originFilter === "all" || a.fundingPath === originFilter)
      ),
    [fundedAccounts, statusFilter, originFilter]
  );

  const filterOptions: { value: FundedStatusFilter; label: string; color: string }[] = [
    { value: "all", label: "All", color: "#94A3B8" },
    { value: "active", label: "Active", color: FUNDED_STATUS_COLOR.active },
    { value: "breached", label: "Breached", color: FUNDED_STATUS_COLOR.breached },
    { value: "closed", label: "Closed", color: FUNDED_STATUS_COLOR.closed },
  ];

  const originFilterOptions: { value: OriginFilter; label: string; color: string }[] = [
    { value: "all", label: "All origins", color: "#94A3B8" },
    { value: "evaluation", label: ORIGIN_LABEL.evaluation, color: ORIGIN_COLOR.evaluation },
    { value: "instant", label: ORIGIN_LABEL.instant, color: ORIGIN_COLOR.instant },
    { value: "giveaway", label: ORIGIN_LABEL.giveaway, color: ORIGIN_COLOR.giveaway },
    { value: "affiliate", label: ORIGIN_LABEL.affiliate, color: ORIGIN_COLOR.affiliate },
    { value: "internal", label: ORIGIN_LABEL.internal, color: ORIGIN_COLOR.internal },
  ];

  const chartData = useMemo(
    () =>
      filteredAccounts.map((a) => ({
        name: a.accountName.length > 14 ? `${a.accountName.slice(0, 12)}…` : a.accountName,
        pnl: Number(getFundedAccountPnL(a).toFixed(0)),
        status: a.status,
      })),
    [filteredAccounts]
  );

  const cardVariants = {
    hover: {
      y: -4,
      transition: { duration: 0.3 }
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4 }
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 
            className="text-[3rem] font-extrabold text-[#F8FAFC]"
            style={{ 
              fontSize: typography.fontSize.display, 
              fontWeight: typography.fontWeight.extraBold,
              letterSpacing: typography.letterSpacing.display,
              lineHeight: typography.lineHeight.display,
              background: gradientText.premium,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent'
            }}
          >
            Funded Accounts
          </h1>
          <p className="text-[#94A3B8] mt-2" style={{ fontSize: typography.fontSize.base, opacity: typography.opacity.tertiary }}>Manage your funded trading accounts</p>
        </div>
        <Button 
          className="bg-gradient-to-r from-[#10B981] to-[#059669] hover:shadow-lg hover:shadow-[rgba(16,185,129,0.3)] hover:scale-105 transition-all duration-300 text-white rounded-xl pointer-events-auto"
          onClick={() => setIsAddDialogOpen(true)}
          type="button"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Funded Account
        </Button>
      </motion.div>

      {/* Stats Overview */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-4 gap-6"
      >
        <motion.div variants={itemVariants}>
          <motion.div
            variants={cardVariants}
            whileHover="hover"
            className="relative rounded-xl p-6 transition-all duration-300"
            style={{
              background: glassmorphism.card.background,
              backdropFilter: glassmorphism.card.backdropBlur,
              border: '1px solid',
              borderColor: 'rgba(148, 163, 184, 0.08)',
              borderRadius: borderRadius.xl,
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(16, 185, 129, 0.1)' }}
              >
                <Wallet className="w-6 h-6 text-[#10B981]" />
              </div>
              <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            </div>
            <p 
              className="text-[#94A3B8] mb-2 uppercase"
              style={{ 
                fontSize: typography.fontSize.sm, 
                fontWeight: typography.fontWeight.medium,
                letterSpacing: typography.letterSpacing.label,
                opacity: typography.opacity.secondary,
                textTransform: typography.textTransform.uppercase
              }}
            >
              Total Capital
            </p>
            <p 
              className="text-[#F8FAFC]"
              style={{ 
                fontSize: typography.fontSize.kpi, 
                fontWeight: typography.fontWeight.extraBold,
                letterSpacing: typography.letterSpacing.kpi,
                lineHeight: typography.lineHeight.kpi,
                background: gradientText.premium,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent'
              }}
            >
              {formatCurrency(totalCapital)}
            </p>
            <p className="text-[#64748B] mt-2" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}>{fundedAccounts.length} funded accounts</p>
          </motion.div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <motion.div
            variants={cardVariants}
            whileHover="hover"
            className="relative rounded-xl p-6 transition-all duration-300"
            style={{
              background: glassmorphism.card.background,
              backdropFilter: glassmorphism.card.backdropBlur,
              border: '1px solid',
              borderColor: 'rgba(148, 163, 184, 0.08)',
              borderRadius: borderRadius.xl,
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: totalProfit >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}
              >
                <TrendingUp className={`w-6 h-6 ${totalProfit >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`} />
              </div>
              <div className={`w-2 h-2 rounded-full animate-pulse ${totalProfit >= 0 ? 'bg-[#10B981]' : 'bg-[#EF4444]'}`} />
            </div>
            <p 
              className="text-[#94A3B8] mb-2 uppercase"
              style={{ 
                fontSize: typography.fontSize.sm, 
                fontWeight: typography.fontWeight.medium,
                letterSpacing: typography.letterSpacing.label,
                opacity: typography.opacity.secondary,
                textTransform: typography.textTransform.uppercase
              }}
            >
              Total Profit
            </p>
            <p 
              className={totalProfit >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}
              style={{ 
                fontSize: typography.fontSize.kpi, 
                fontWeight: typography.fontWeight.extraBold,
                letterSpacing: typography.letterSpacing.kpi,
                lineHeight: typography.lineHeight.kpi
              }}
            >
              {formatCurrency(totalProfit)}
            </p>
            <p className="text-[#64748B] mt-2" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}>Overall performance</p>
          </motion.div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <motion.div
            variants={cardVariants}
            whileHover="hover"
            className="relative rounded-xl p-6 transition-all duration-300"
            style={{
              background: glassmorphism.card.background,
              backdropFilter: glassmorphism.card.backdropBlur,
              border: '1px solid',
              borderColor: 'rgba(148, 163, 184, 0.08)',
              borderRadius: borderRadius.xl,
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(16, 185, 129, 0.1)' }}
              >
                <Wallet className="w-6 h-6 text-[#10B981]" />
              </div>
              <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            </div>
            <p 
              className="text-[#94A3B8] mb-2 uppercase"
              style={{ 
                fontSize: typography.fontSize.sm, 
                fontWeight: typography.fontWeight.medium,
                letterSpacing: typography.letterSpacing.label,
                opacity: typography.opacity.secondary,
                textTransform: typography.textTransform.uppercase
              }}
            >
              Active Accounts
            </p>
            <p 
              className="text-[#F8FAFC]"
              style={{ 
                fontSize: typography.fontSize.kpi, 
                fontWeight: typography.fontWeight.extraBold,
                letterSpacing: typography.letterSpacing.kpi,
                lineHeight: typography.lineHeight.kpi
              }}
            >
              {activeAccounts}
            </p>
            <p className="text-[#64748B] mt-2" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}>Currently trading</p>
          </motion.div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <motion.div
            variants={cardVariants}
            whileHover="hover"
            className="relative rounded-xl p-6 transition-all duration-300"
            style={{
              background: glassmorphism.card.background,
              backdropFilter: glassmorphism.card.backdropBlur,
              border: '1px solid',
              borderColor: 'rgba(148, 163, 184, 0.08)',
              borderRadius: borderRadius.xl,
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(239, 68, 68, 0.1)' }}
              >
                <Wallet className="w-6 h-6 text-[#EF4444]" />
              </div>
            </div>
            <p 
              className="text-[#94A3B8] mb-2 uppercase"
              style={{ 
                fontSize: typography.fontSize.sm, 
                fontWeight: typography.fontWeight.medium,
                letterSpacing: typography.letterSpacing.label,
                opacity: typography.opacity.secondary,
                textTransform: typography.textTransform.uppercase
              }}
            >
              Breached Accounts
            </p>
            <p 
              className="text-[#F8FAFC]"
              style={{ 
                fontSize: typography.fontSize.kpi, 
                fontWeight: typography.fontWeight.extraBold,
                letterSpacing: typography.letterSpacing.kpi,
                lineHeight: typography.lineHeight.kpi
              }}
            >
              {breachedAccounts}
            </p>
            <p className="text-[#64748B] mt-2" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}>Rules violated</p>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* P&L Chart */}
      <motion.div
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.15 }}
      >
        <div
          className="relative rounded-xl p-6"
          style={{
            background: glassmorphism.card.background,
            backdropFilter: glassmorphism.card.backdropBlur,
            border: '1px solid rgba(148, 163, 184, 0.08)',
            borderRadius: borderRadius.xl,
          }}
        >
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-[#10B981]" />
            <h3
              className="text-[#F8FAFC]"
              style={{ fontSize: typography.fontSize.section, fontWeight: typography.fontWeight.bold, letterSpacing: typography.letterSpacing.section }}
            >
              P&L by Account
            </h3>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.08)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={{ stroke: 'rgba(148, 163, 184, 0.15)' }} tickLine={false} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  cursor={{ fill: 'rgba(16, 185, 129, 0.08)' }}
                  contentStyle={{ background: 'rgba(11, 18, 32, 0.95)', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '12px', color: '#F8FAFC' }}
                  formatter={((value: number) => [formatCurrency(value), 'P&L']) as never}
                />
                <Bar dataKey="pnl" radius={[6, 6, 0, 0]} maxBarSize={64}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={FUNDED_STATUS_COLOR[entry.status as FundedAccountStatus]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex flex-col items-center justify-center text-center">
              <BarChart3 className="w-10 h-10 text-[#475569] mb-3" />
              <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.base }}>No funded accounts to chart yet</p>
              <p className="text-[#64748B] mt-1" style={{ fontSize: typography.fontSize.xs }}>Profit & loss per account will appear here</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Filter Bar + View Toggle */}
      <motion.div
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.2 }}
        className="flex flex-wrap items-start justify-between gap-4"
      >
        <div className="flex flex-col gap-3">
          {/* Status filter — trading state */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-[#64748B] mr-1">Status</span>
            {filterOptions.map((option) => {
              const isActive = statusFilter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatusFilter(option.value)}
                  className="relative px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 pointer-events-auto"
                  style={{
                    color: isActive ? '#F8FAFC' : '#94A3B8',
                    background: isActive ? `${option.color}26` : 'rgba(148, 163, 184, 0.06)',
                    border: `1px solid ${isActive ? `${option.color}66` : 'rgba(148, 163, 184, 0.12)'}`,
                  }}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: option.color }} />
                    {option.label}
                    <span className="px-1.5 py-0.5 rounded-full text-xs" style={{ background: 'rgba(0,0,0,0.25)', color: isActive ? '#F8FAFC' : '#64748B' }}>
                      {statusCounts[option.value]}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Origin filter — how the account was obtained, separate from its trading status */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-[#64748B] mr-1">Origin</span>
            {originFilterOptions.map((option) => {
              const isActive = originFilter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setOriginFilter(option.value)}
                  className="relative px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 pointer-events-auto"
                  style={{
                    color: isActive ? '#F8FAFC' : '#94A3B8',
                    background: isActive ? `${option.color}26` : 'rgba(148, 163, 184, 0.06)',
                    border: `1px solid ${isActive ? `${option.color}66` : 'rgba(148, 163, 184, 0.12)'}`,
                  }}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: option.color }} />
                    {option.label}
                    <span className="px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.25)', color: isActive ? '#F8FAFC' : '#64748B' }}>
                      {originCounts[option.value]}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'rgba(148, 163, 184, 0.06)', border: '1px solid rgba(148, 163, 184, 0.12)' }}>
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 pointer-events-auto"
            style={{ color: viewMode === 'cards' ? '#F8FAFC' : '#94A3B8', background: viewMode === 'cards' ? 'rgba(16, 185, 129, 0.2)' : 'transparent' }}
          >
            <LayoutGrid className="w-4 h-4" />
            Cards
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 pointer-events-auto"
            style={{ color: viewMode === 'table' ? '#F8FAFC' : '#94A3B8', background: viewMode === 'table' ? 'rgba(16, 185, 129, 0.2)' : 'transparent' }}
          >
            <List className="w-4 h-4" />
            Table
          </button>
        </div>
      </motion.div>

      {/* Loading / Empty State */}
      {filteredAccounts.length === 0 && (
        fundedAccountsLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-12 flex flex-col items-center justify-center text-center"
            style={{ background: glassmorphism.card.background, backdropFilter: glassmorphism.card.backdropBlur, border: '1px solid rgba(148, 163, 184, 0.08)', borderRadius: borderRadius.xl }}
          >
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
              <Wallet className="w-7 h-7 text-[#10B981]" />
            </div>
            <p className="text-[#F8FAFC] text-lg font-semibold">
              {statusFilter === 'all' ? 'No funded accounts yet' : `No ${statusFilter} accounts`}
            </p>
            <p className="text-[#94A3B8] mt-1" style={{ fontSize: typography.fontSize.sm }}>
              {statusFilter === 'all' ? 'Add a funded account to get started' : 'Try a different filter'}
            </p>
          </motion.div>
        )
      )}

      {/* Funded Account Cards */}
      {viewMode === "cards" && filteredAccounts.length > 0 && (
      <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
        {filteredAccounts.map((account) => {
          const sourceChallenge = challenges.find(c => c.id === account.sourceChallengeId);
          const accountPnL = getFundedAccountPnL(account);
          // Drawdown only ever grows from realized losses (never from the
          // account's own possibly-stale persisted remainingDrawdown field).
          const drawdown = computeDrawdown(account.maxDrawdown, account.accountSize, accountPnL);
          const drawdownProgress = drawdown.maxDrawdownDollars > 0
            ? (drawdown.remainingDrawdownDollars / drawdown.maxDrawdownDollars) * 100
            : 100;

          return (
            <motion.div
              key={account.id}
              layout
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <motion.div
                variants={cardVariants}
                whileHover="hover"
                className="relative rounded-xl p-6 transition-all duration-300"
                style={{
                  background: glassmorphism.card.background,
                  backdropFilter: glassmorphism.card.backdropBlur,
                  border: '1px solid',
                  borderColor: 'rgba(148, 163, 184, 0.08)',
                  borderRadius: borderRadius.xl,
                }}
              >
                {/* Status Badge */}
                <div className="absolute top-4 right-4">
                  <Badge variant="default" className={getStatusColor(account.status)}>
                    {account.status}
                  </Badge>
                </div>

                {/* Account Info */}
                <div className="flex items-start gap-4 mb-6">
                  <div className={`w-14 h-14 ${getStatusBgColor(account.status)} rounded-xl flex items-center justify-center`}>
                    <Wallet className={`w-7 h-7 ${getStatusTextColor(account.status)}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-[#F8FAFC]">{account.accountName}</h3>
                    <p className="text-sm text-[#94A3B8]">{account.propFirmName}</p>
                    {sourceChallenge && (
                      <p className="text-xs text-[#64748B] mt-1">From: {sourceChallenge.accountName}</p>
                    )}
                    {account.fundingPath !== 'evaluation' && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{
                            background: `${ORIGIN_COLOR[account.fundingPath]}26`,
                            color: ORIGIN_COLOR[account.fundingPath],
                            border: `1px solid ${ORIGIN_COLOR[account.fundingPath]}66`,
                          }}
                        >
                          {ORIGIN_LABEL[account.fundingPath]}
                        </span>
                        {account.tradingEnvironment === 'cfd' && (
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                            style={{ background: 'rgba(41,141,255,0.15)', color: '#298DFF', border: '1px solid rgba(41,141,255,0.4)' }}
                          >
                            CFD
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Account Size */}
                <div className="mb-6">
                  <p className="text-sm text-[#94A3B8] mb-1">Account Size</p>
                  <p 
                    className="text-2xl font-bold text-[#F8FAFC]"
                    style={{ fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold }}
                  >
                    {formatCurrency(account.accountSize)}
                  </p>
                </div>

                {/* Drawdown Progress */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-[#94A3B8]">Drawdown Remaining</p>
                    <p className="text-sm font-medium text-[#F8FAFC]">{formatPercentage(drawdown.remainingDrawdownPercent)} ({formatCurrency(drawdown.remainingDrawdownDollars)})</p>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(148, 163, 184, 0.1)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${drawdownProgress}%` }}
                      transition={{ duration: 0.8 }}
                      className="h-full rounded-full"
                      style={{
                        background: account.status === 'active' ? gradientBorder.success :
                               account.status === 'breached' ? gradientBorder.danger :
                               gradientBorder.warning,
                      }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-xs text-[#94A3B8] mb-1">Current Balance</p>
                    <p className="text-sm font-medium text-[#F8FAFC]">{formatCurrency(account.currentBalance)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#94A3B8] mb-1">Total P&L</p>
                    <p className={`text-sm font-medium ${accountPnL >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {formatCurrency(accountPnL)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#94A3B8] mb-1">Funding Date</p>
                    <p className="text-sm font-medium text-[#F8FAFC]">{new Date(account.fundingDate).toLocaleDateString('en-US', { timeZone: 'UTC' })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#94A3B8] mb-1">Max Drawdown</p>
                    <p className="text-sm font-medium text-[#F8FAFC]">{formatPercentage(drawdown.maxDrawdownPercent)}</p>
                  </div>
                </div>

                {/* Trading requirements — static payout-eligibility rules,
                    shown for non-evaluation accounts (their rules live here
                    natively rather than on a linked Challenge). */}
                {account.fundingPath !== 'evaluation' && (() => {
                  const ruleLines = getPayoutRuleLines(account, formatCurrency);
                  return (
                    <div
                      className="mb-6 rounded-lg px-3 py-2.5 space-y-1.5"
                      style={{ background: 'rgba(148, 163, 184, 0.06)', border: '1px solid rgba(148, 163, 184, 0.1)' }}
                    >
                      <p className="text-[11px] uppercase tracking-wider text-[#64748B]">Trading requirements</p>
                      {ruleLines.length === 0 ? (
                        <p className="text-xs text-[#94A3B8]">No minimum trading-day or consistency requirement</p>
                      ) : (
                        ruleLines.map((line) => (
                          <div key={line.label} className="flex items-center justify-between text-xs">
                            <span className="text-[#94A3B8]">{line.label}</span>
                            <span className="text-[#F8FAFC] font-medium">{line.value}</span>
                          </div>
                        ))
                      )}
                    </div>
                  );
                })()}

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/funded/${account.id}`)}
                    className="flex-1 border-[rgba(148,163,184,0.2)] text-[#F8FAFC] hover:bg-[rgba(16,185,129,0.1)] hover:border-[#10B981] rounded-xl pointer-events-auto transition-all duration-300"
                    type="button"
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Analytics
                  </Button>
                  <select
                    value={account.status}
                    onChange={(e) => handleStatusChange(account.id, e.target.value as FundedAccountStatus)}
                    className="bg-[rgba(11,18,32,0.5)] text-[#F8FAFC] text-sm rounded-lg px-3 py-2 border border-[rgba(148,163,184,0.2)] focus:border-[#10B981] focus:outline-none focus:ring-2 focus:ring-[rgba(16,185,129,0.2)] transition-all"
                  >
                    <option value="active">Active</option>
                    <option value="breached">Breached</option>
                    <option value="closed">Closed</option>
                  </select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteFundedAccount(account.id)}
                    className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[rgba(239,68,68,0.1)] transition-all duration-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          );
        })}
        </AnimatePresence>
      </motion.div>
      )}

      {/* Funded Account Table */}
      {viewMode === "table" && filteredAccounts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="rounded-xl overflow-hidden"
          style={{ background: glassmorphism.card.background, backdropFilter: glassmorphism.card.backdropBlur, border: '1px solid rgba(148, 163, 184, 0.08)', borderRadius: borderRadius.xl }}
        >
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[rgba(148,163,184,0.1)] hover:bg-transparent">
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider">Account</TableHead>
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider">Prop Firm</TableHead>
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider text-right">Size</TableHead>
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider text-right">Balance</TableHead>
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider text-right">P&L</TableHead>
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider">Status</TableHead>
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.map((account) => {
                const accountPnL = getFundedAccountPnL(account);
                return (
                  <TableRow key={account.id} className="border-b border-[rgba(148,163,184,0.06)] hover:bg-[rgba(16,185,129,0.06)] transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 ${getStatusBgColor(account.status)} rounded-lg flex items-center justify-center`}>
                          <Wallet className={`w-4 h-4 ${getStatusTextColor(account.status)}`} />
                        </div>
                        <span className="font-medium text-[#F8FAFC]">{account.accountName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[#94A3B8]">{account.propFirmName}</TableCell>
                    <TableCell className="text-right text-[#F8FAFC] font-medium">{formatCurrency(account.accountSize)}</TableCell>
                    <TableCell className="text-right text-[#F8FAFC] font-medium">{formatCurrency(account.currentBalance)}</TableCell>
                    <TableCell className={`text-right font-medium ${accountPnL >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>{formatCurrency(accountPnL)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="default" className={getStatusColor(account.status)}>{account.status}</Badge>
                        {account.fundingPath !== 'evaluation' && (
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                            style={{
                              background: `${ORIGIN_COLOR[account.fundingPath]}26`,
                              color: ORIGIN_COLOR[account.fundingPath],
                              border: `1px solid ${ORIGIN_COLOR[account.fundingPath]}66`,
                            }}
                          >
                            {ORIGIN_LABEL[account.fundingPath]}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => router.push(`/funded/${account.id}`)}
                          className="text-[#94A3B8] hover:text-[#10B981] hover:bg-[rgba(16,185,129,0.1)] transition-all duration-300"
                          type="button"
                        >
                          <BarChart3 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteFundedAccount(account.id)}
                          className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[rgba(239,68,68,0.1)] transition-all duration-300"
                          type="button"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </motion.div>
      )}

      <AddFundedAccountDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
    </div>
  );
}
