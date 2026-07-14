"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import { Trophy, Plus, TrendingUp, DollarSign, ArrowRight, Trash2, BarChart3, LayoutGrid, List } from "lucide-react";
import { useAccounts } from "@/context/AccountsContext";
import { ChallengeStatus, Challenge } from "@/types";
import { AddChallengeMarketDialog } from "@/components/AddChallengeMarketDialog";
import { DeleteLifecycleDialog } from "@/components/DeleteLifecycleDialog";
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
import { typography, borderRadius, glassmorphism, gradientBorder, gradientText } from "@/design-system";
import { computeDrawdown } from "@/lib/drawdown";
import {
  is2Step,
  getCurrentStep,
  getStepTarget,
  isChallengeActive,
  endedWithoutProgress,
  getAccountLifecycleBucket,
  groupChallengesIntoLifecycles,
  AccountStatusBucket,
  AccountLifecycleBucket,
  ChallengeLifecycle,
} from "@/lib/lifecycle";
import { LifecycleIndicator } from "@/components/account/LifecycleIndicator";

// Redesigned challenges view: filters, view toggle, progress chart, table
type StatusFilter = "all" | AccountStatusBucket;
type LifecycleFilter = "all" | AccountLifecycleBucket;
type ViewMode = "cards" | "table";

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string; color: string }[] = [
  { value: "all", label: "All", color: "#94A3B8" },
  { value: "active", label: "Active", color: "#298DFF" },
  { value: "failed", label: "Failed", color: "#EF4444" },
  { value: "funded", label: "Funded", color: "#10B981" },
  { value: "refunded", label: "Refunded", color: "#F59E0B" },
];

const STATUS_BUCKET_LABEL: Record<AccountStatusBucket, string> = {
  active: "Active",
  failed: "Failed",
  funded: "Funded",
  refunded: "Refunded",
};

// "Step 2 reached" (not "Step 1 Done") — it names the milestone actually
// crossed (transitioned into Step 2), so it can't be misread as "the whole
// challenge is done".
const LIFECYCLE_FILTER_OPTIONS: { value: LifecycleFilter; label: string; color: string }[] = [
  { value: "all", label: "All stages", color: "#94A3B8" },
  { value: "step1", label: "Step 1", color: "#298DFF" },
  { value: "step2", label: "Step 2 reached", color: "#A855F7" },
  { value: "funded", label: "Funded reached", color: "#10B981" },
];

export default function Challenges() {
  const router = useRouter();
  const { challenges, challengesLoading, trades, getFundingRateStats, addChallenge, updateChallenge, convertChallengeToFunded, deleteChallenge } = useAccounts();
  const stats = getFundingRateStats();
  const [isAddMarketDialogOpen, setIsAddMarketDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [lifecycleToDelete, setLifecycleToDelete] = useState<ChallengeLifecycle | null>(null);

  // Normalized once here — a 2-step evaluation is stored as two linked DB
  // rows (Step 1 parent + Step 2 child), but it's one purchased lifecycle.
  // Every count, filter, chart, card, and table row below reads from this,
  // never from the raw `challenges` row list, so a lifecycle is never
  // double-rendered or double-counted just because it spans two rows.
  const lifecycles = useMemo(() => groupChallengesIntoLifecycles(challenges), [challenges]);

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: lifecycles.length,
      active: 0,
      failed: 0,
      funded: 0,
      refunded: 0,
    };
    lifecycles.forEach((l) => {
      counts[l.statusBucket] += 1;
    });
    return counts;
  }, [lifecycles]);

  const lifecycleCounts = useMemo(() => {
    const counts: Record<LifecycleFilter, number> = {
      all: lifecycles.length,
      step1: 0,
      step2: 0,
      funded: 0,
    };
    lifecycles.forEach((l) => {
      counts[getAccountLifecycleBucket(l.latestRecord)] += 1;
    });
    return counts;
  }, [lifecycles]);

  const filteredLifecycles = useMemo(
    () =>
      lifecycles.filter(
        (l) =>
          (statusFilter === "all" || l.statusBucket === statusFilter) &&
          (lifecycleFilter === "all" || getAccountLifecycleBucket(l.latestRecord) === lifecycleFilter)
      ),
    [lifecycles, statusFilter, lifecycleFilter]
  );

  const activeFilterDescription = [
    statusFilter !== "all" ? STATUS_BUCKET_LABEL[statusFilter].toLowerCase() : null,
    lifecycleFilter !== "all" ? LIFECYCLE_FILTER_OPTIONS.find((o) => o.value === lifecycleFilter)?.label.toLowerCase() : null,
  ]
    .filter(Boolean)
    .join(" · ");

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

  const handleStatusChange = (id: string, newStatus: ChallengeStatus) => {
    updateChallenge(id, { status: newStatus });
  };

  const handleConvertToFunded = (challenge: Challenge) => {
    const fundedAccount = {
      propFirmName: challenge.propFirmName,
      accountName: `${challenge.accountName} (Funded)`,
      sourceChallengeId: challenge.id,
      accountSize: challenge.accountSize,
      fundingDate: new Date().toISOString().split('T')[0],
      initialBalance: challenge.accountSize,
      currentBalance: challenge.accountSize + challenge.currentProfit,
      currentProfit: challenge.currentProfit,
      maxDrawdown: challenge.maxDrawdown,
      remainingDrawdown: challenge.remainingDrawdown,
      status: 'active' as const,
      fundingPath: 'evaluation' as const,
      payoutRules: { consistency: { required: false }, minimumTradingDays: { required: false } },
    };
    convertChallengeToFunded(challenge.id, fundedAccount);
  };

  // A 2-step account can only convert to funded once Step 2 is passed —
  // until then it stays in the Challenges space.
  const isReadyToConvert = (c: Challenge) =>
    (!is2Step(c) || getCurrentStep(c) === "2") &&
    c.status === "passed" &&
    !c.convertedToFunded;

  // A lifecycle card can represent two DB rows — deleting it has to remove
  // both, otherwise the Step 1 row would resurface as its own orphaned card
  // right after the Step 2 row it was grouped with disappears.
  const handleDeleteLifecycle = (lifecycle: ChallengeLifecycle) => {
    if (lifecycle.step2Record) deleteChallenge(lifecycle.step2Record.id);
    deleteChallenge(lifecycle.step1Record.id);
  };

  // Step 1 keeps its own id, trades, and history untouched — it's marked
  // done and a brand-new linked Challenge is created for Step 2 so the two
  // steps never share trades/journal/analytics.
  const handleCompleteStep1 = (c: Challenge) => {
    updateChallenge(c.id, { status: "step1_completed" });
    addChallenge({
      propFirmName: c.propFirmName,
      accountName: `${c.accountName} - Step 2`,
      accountSize: c.accountSize,
      challengeType: c.challengeType,
      challengeKind: "2-step",
      challengeStep: "2",
      step1ProfitTarget: c.step1ProfitTarget,
      step2ProfitTarget: c.step2ProfitTarget,
      purchaseCost: 0,
      purchaseDate: new Date().toISOString().split("T")[0],
      profitTarget: c.step2ProfitTarget ?? c.profitTarget,
      currentProfit: 0,
      maxDrawdown: c.maxDrawdown,
      remainingDrawdown: c.maxDrawdown,
      status: "active",
      parentChallengeId: c.id,
      presetId: c.presetId,
      drawdownMode: c.drawdownMode,
      dailyDrawdown: c.dailyDrawdown,
      maxContracts: c.maxContracts,
      minTradingDays: c.minTradingDays,
      consistencyRule: c.consistencyRule,
      newsTrading: c.newsTrading,
      payoutDays: c.payoutDays,
      minPayout: c.minPayout,
      maxPayoutRequest: c.maxPayoutRequest,
      payoutSplit: c.payoutSplit,
      notes: c.notes,
    });
  };

  // currentProfit is derived directly from the trade list (not the
  // account row's own currentProfit field) so the card can never get stuck
  // showing stale data after a trade/import lands.
  const getChallengeCurrentProfit = useCallback(
    (challenge: Challenge) =>
      trades
        .filter((t) => t.accountId === challenge.id && t.accountType === "challenge")
        .reduce((sum, t) => sum + t.pnl, 0),
    [trades]
  );

  const getChallengeProgress = useCallback(
    (challenge: Challenge) => {
      const currentProfit = getChallengeCurrentProfit(challenge);
      const target = getStepTarget(challenge);
      if (!target) return 0;
      const progress = (currentProfit / target) * 100;
      return Math.max(0, Math.min(progress, 100));
    },
    [getChallengeCurrentProfit]
  );

  const cardVariants = {
    hover: {
      y: -4,
      transition: { duration: 0.3, ease: "easeOut" as const }
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
      transition: { duration: 0.4, ease: "easeOut" as const }
    }
  };

  const chartData = useMemo(
    () =>
      filteredLifecycles.map((l) => ({
        name: l.rootChallenge.accountName.length > 14 ? `${l.rootChallenge.accountName.slice(0, 12)}…` : l.rootChallenge.accountName,
        progress: Number(getChallengeProgress(l.latestRecord).toFixed(1)),
        color: l.outcomeColor,
      })),
    [filteredLifecycles, getChallengeProgress]
  );

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
            Challenge Accounts
          </h1>
          <p className="text-[#94A3B8] mt-2" style={{ fontSize: typography.fontSize.base, opacity: typography.opacity.tertiary }}>Manage your evaluation challenges</p>
        </div>
        <Button
          className="bg-gradient-to-r from-[#298DFF] to-[#1E6FE0] hover:shadow-lg hover:shadow-[rgba(41,141,255,0.3)] hover:scale-105 transition-all duration-300 text-white rounded-xl pointer-events-auto"
          onClick={() => setIsAddMarketDialogOpen(true)}
          type="button"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Challenge
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
                style={{ background: 'rgba(41,141,255, 0.1)' }}
              >
                <Trophy className="w-6 h-6 text-[#298DFF]" />
              </div>
              <div className="w-2 h-2 rounded-full bg-[#298DFF] animate-pulse" />
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
              Total Challenges
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
              {stats.totalChallengesPurchased}
            </p>
            <p className="text-[#64748B] mt-2" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}>All time</p>
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
                style={{ background: 'rgba(59, 130, 246, 0.1)' }}
              >
                <Trophy className="w-6 h-6 text-[#3B82F6]" />
              </div>
              <div className="w-2 h-2 rounded-full bg-[#3B82F6] animate-pulse" />
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
              Active Challenges
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
              {stats.activeChallenges}
            </p>
            <p className="text-[#64748B] mt-2" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}>In progress</p>
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
                <TrendingUp className="w-6 h-6 text-[#10B981]" />
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
              Passed Challenges
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
              {stats.passedChallenges}
            </p>
            <p className="text-[#64748B] mt-2" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}>Successfully completed</p>
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
                style={{ background: 'rgba(245, 158, 11, 0.1)' }}
              >
                <DollarSign className="w-6 h-6 text-[#F59E0B]" />
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
              Total Cost
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
              {formatCurrency(stats.totalChallengeCost)}
            </p>
            <p className="text-[#64748B] mt-2" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}>Invested</p>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Funding Rate */}
      <motion.div
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.2 }}
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
          <h3 
            className="text-[#F8FAFC] mb-4"
            style={{ 
              fontSize: typography.fontSize.section, 
              fontWeight: typography.fontWeight.bold,
              letterSpacing: typography.letterSpacing.section
            }}
          >
            Funding Rate
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <p 
                className="text-[#F8FAFC]"
                style={{ 
                  fontSize: typography.fontSize.kpi, 
                  fontWeight: typography.fontWeight.extraBold,
                  letterSpacing: typography.letterSpacing.kpi,
                  lineHeight: typography.lineHeight.kpi
                }}
              >
                {formatPercentage(stats.fundingRatePercentage)}
              </p>
              <p className="text-[#94A3B8] mt-1" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}>
                {stats.convertedToFunded} of {stats.totalChallengesPurchased} challenges converted to funded
              </p>
            </div>
            <div className="text-right space-y-2">
              <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.secondary }}>Failed: <span className="text-[#EF4444] font-medium">{stats.failedChallenges}</span></p>
              <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.secondary }}>Passed: <span className="text-[#10B981] font-medium">{stats.passedChallenges}</span></p>
              <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.secondary }}>Converted: <span className="text-[#298DFF] font-medium">{stats.convertedToFunded}</span></p>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Progress Chart */}
      <motion.div
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.25 }}
      >
        <div
          className="relative rounded-xl p-6"
          style={{
            background: glassmorphism.card.background,
            backdropFilter: glassmorphism.card.backdropBlur,
            border: '1px solid',
            borderColor: 'rgba(148, 163, 184, 0.08)',
            borderRadius: borderRadius.xl,
          }}
        >
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-[#298DFF]" />
            <h3
              className="text-[#F8FAFC]"
              style={{
                fontSize: typography.fontSize.section,
                fontWeight: typography.fontWeight.bold,
                letterSpacing: typography.letterSpacing.section,
              }}
            >
              Challenge Progress
            </h3>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.08)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#94A3B8', fontSize: 12 }}
                  axisLine={{ stroke: 'rgba(148, 163, 184, 0.15)' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  unit="%"
                  tick={{ fill: '#94A3B8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(41,141,255, 0.08)' }}
                  contentStyle={{
                    background: 'rgba(11, 18, 32, 0.95)',
                    border: '1px solid rgba(148, 163, 184, 0.15)',
                    borderRadius: '12px',
                    color: '#F8FAFC',
                  }}
                  formatter={((value: number) => [`${value}%`, 'Progress']) as never}
                />
                <Bar dataKey="progress" radius={[6, 6, 0, 0]} maxBarSize={64}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex flex-col items-center justify-center text-center">
              <BarChart3 className="w-10 h-10 text-[#475569] mb-3" />
              <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.base }}>No challenges to chart yet</p>
              <p className="text-[#64748B] mt-1" style={{ fontSize: typography.fontSize.xs }}>Progress toward profit target will appear here</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Filter Bar + View Toggle */}
      <motion.div
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.3 }}
        className="flex flex-wrap items-start justify-between gap-4"
      >
        <div className="flex flex-col gap-3">
          {/* Status filter — Active / Failed / Funded / Refunded (terminal outcome) */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-[#64748B] mr-1">Status</span>
            {STATUS_FILTER_OPTIONS.map((option) => {
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
                    <span
                      className="px-1.5 py-0.5 rounded-full text-xs"
                      style={{ background: 'rgba(0,0,0,0.25)', color: isActive ? '#F8FAFC' : '#64748B' }}
                    >
                      {statusCounts[option.value]}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Lifecycle filter — which stage the account has reached, separate from its outcome */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-[#64748B] mr-1">Lifecycle</span>
            {LIFECYCLE_FILTER_OPTIONS.map((option) => {
              const isActive = lifecycleFilter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setLifecycleFilter(option.value)}
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
                    <span
                      className="px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(0,0,0,0.25)', color: isActive ? '#F8FAFC' : '#64748B' }}
                    >
                      {lifecycleCounts[option.value]}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="flex items-center gap-1 p-1 rounded-xl"
          style={{ background: 'rgba(148, 163, 184, 0.06)', border: '1px solid rgba(148, 163, 184, 0.12)' }}
        >
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 pointer-events-auto"
            style={{
              color: viewMode === 'cards' ? '#F8FAFC' : '#94A3B8',
              background: viewMode === 'cards' ? 'rgba(41,141,255, 0.2)' : 'transparent',
            }}
          >
            <LayoutGrid className="w-4 h-4" />
            Cards
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 pointer-events-auto"
            style={{
              color: viewMode === 'table' ? '#F8FAFC' : '#94A3B8',
              background: viewMode === 'table' ? 'rgba(41,141,255, 0.2)' : 'transparent',
            }}
          >
            <List className="w-4 h-4" />
            Table
          </button>
        </div>
      </motion.div>

      {/* Loading / Empty State */}
      {filteredLifecycles.length === 0 && (
        challengesLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#298DFF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-12 flex flex-col items-center justify-center text-center"
            style={{
              background: glassmorphism.card.background,
              backdropFilter: glassmorphism.card.backdropBlur,
              border: '1px solid rgba(148, 163, 184, 0.08)',
              borderRadius: borderRadius.xl,
            }}
          >
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(41,141,255, 0.1)' }}>
              <Trophy className="w-7 h-7 text-[#298DFF]" />
            </div>
            <p className="text-[#F8FAFC] text-lg font-semibold">
              {activeFilterDescription ? `No ${activeFilterDescription} challenges` : 'No challenges yet'}
            </p>
            <p className="text-[#94A3B8] mt-1" style={{ fontSize: typography.fontSize.sm }}>
              {activeFilterDescription ? 'Try a different filter' : 'Create your first challenge to get started'}
            </p>
          </motion.div>
        )
      )}

      {/* Challenge Cards */}
      {viewMode === "cards" && filteredLifecycles.length > 0 && (
      <motion.div
        layout
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        <AnimatePresence mode="popLayout">
        {filteredLifecycles.map((lifecycle) => {
          const { rootChallenge, latestRecord, outcomeColor, outcomeLabel, lifecycleNodes } = lifecycle;
          const currentProfit = getChallengeCurrentProfit(latestRecord);
          const progress = getChallengeProgress(latestRecord);
          const drawdown = computeDrawdown(latestRecord.maxDrawdown, latestRecord.accountSize, currentProfit);
          const active = isChallengeActive(latestRecord);
          const neutralOutcome = endedWithoutProgress(latestRecord);
          return (
          <motion.div
            key={lifecycle.lifecycleId}
            layout
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <motion.div
              variants={cardVariants}
              whileHover="hover"
              className="relative rounded-xl p-6 transition-all duration-300 @container"
              style={{
                background: glassmorphism.card.background,
                backdropFilter: glassmorphism.card.backdropBlur,
                border: '1px solid',
                borderColor: 'rgba(148, 163, 184, 0.08)',
                borderRadius: borderRadius.xl,
              }}
            >
              {/* Status Badge — single outcome phrase (e.g. "Failed at Step 1"),
                  never repeated as text elsewhere on the card. */}
              <div className="absolute top-4 right-4">
                <Badge
                  variant="default"
                  className="font-semibold rounded-full border"
                  style={{
                    background: `${outcomeColor}26`,
                    color: outcomeColor,
                    borderColor: `${outcomeColor}66`,
                  }}
                >
                  {outcomeLabel}
                </Badge>
              </div>

              {/* Account Info — firm / plan / size stay put; the lifecycle
                  chain is the only stage indicator (icons, no repeated text). */}
              <div className="flex items-start gap-4 mb-6 pr-20">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${outcomeColor}1A` }}>
                  <Trophy className="w-7 h-7" style={{ color: outcomeColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-[#F8FAFC] truncate">{rootChallenge.accountName}</h3>
                  <p className="text-sm text-[#94A3B8] truncate">{rootChallenge.propFirmName}</p>
                  <p className="text-xs text-[#64748B] mt-1 truncate">{rootChallenge.challengeType}</p>
                  {lifecycleNodes.length > 0 && (
                    <div className="mt-1.5">
                      <LifecycleIndicator nodes={lifecycleNodes} />
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
                  {formatCurrency(rootChallenge.accountSize)}
                </p>
              </div>

              {/* Progress: live percentage while active, a full completion
                  bar for genuine successes (step completed / funded), and a
                  neutral summary (no bar) for failed/refunded so a loss is
                  never shown as "100% complete". */}
              <div className="mb-6">
                {active ? (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-[#94A3B8]">
                        {lifecycle.is2Step ? `Step ${getCurrentStep(latestRecord)} progress` : "Progress"}
                        <span className="text-[#64748B]"> · {formatCurrency(currentProfit)} / {formatCurrency(getStepTarget(latestRecord))}</span>
                      </p>
                      <p className="text-sm font-medium text-[#F8FAFC]">{formatPercentage(progress)}</p>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(148, 163, 184, 0.1)' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ background: gradientBorder.purpleBlue }}
                      />
                    </div>
                  </>
                ) : neutralOutcome ? (
                  <div className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(148, 163, 184, 0.06)', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
                    <p className="text-[11px] uppercase tracking-wider text-[#64748B]">Challenge ended</p>
                    <p className="text-sm font-medium mt-0.5" style={{ color: outcomeColor }}>{outcomeLabel}</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium mb-2" style={{ color: outcomeColor }}>{outcomeLabel}</p>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(148, 163, 184, 0.1)' }}>
                      <div className="h-full rounded-full" style={{ width: '100%', background: outcomeColor }} />
                    </div>
                  </>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-xs text-[#94A3B8] mb-1">Current Profit</p>
                  <p className="text-sm font-medium text-[#F8FAFC]">{formatCurrency(currentProfit)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#94A3B8] mb-1">Target</p>
                  <p className="text-sm font-medium text-[#F8FAFC]">{formatCurrency(getStepTarget(latestRecord))}</p>
                </div>
                <div>
                  <p className="text-xs text-[#94A3B8] mb-1">Drawdown</p>
                  <p className="text-sm font-medium text-[#F8FAFC]">{formatPercentage(drawdown.remainingDrawdownPercent)} ({formatCurrency(drawdown.remainingDrawdownDollars)})</p>
                </div>
                <div>
                  <p className="text-xs text-[#94A3B8] mb-1">Cost</p>
                  <p className="text-sm font-medium text-[#F8FAFC]">{formatCurrency(lifecycle.totalCost)}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/challenges/${latestRecord.id}`)}
                  className="flex-1 border-[rgba(148,163,184,0.2)] text-[#F8FAFC] hover:bg-[rgba(41,141,255,0.1)] hover:border-[#298DFF] rounded-xl pointer-events-auto transition-all duration-300"
                  type="button"
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Analytics
                </Button>
                <select
                  value={latestRecord.status}
                  onChange={(e) => handleStatusChange(latestRecord.id, e.target.value as ChallengeStatus)}
                  className="bg-[rgba(11,18,32,0.5)] text-[#F8FAFC] text-sm rounded-lg px-3 py-2 border border-[rgba(148,163,184,0.2)] focus:border-[#298DFF] focus:outline-none focus:ring-2 focus:ring-[rgba(41,141,255,0.2)] transition-all"
                >
                  <option value="active">Active</option>
                  <option value="passed">Passed</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
                {lifecycle.is2Step && !lifecycle.step2Record && latestRecord.status === 'active' && !lifecycle.convertedToFunded && (
                  <Button
                    onClick={() => handleCompleteStep1(latestRecord)}
                    className="bg-gradient-to-r from-[#298DFF] to-[#1E6FE0] hover:shadow-lg hover:shadow-[rgba(41,141,255,0.3)] hover:scale-105 transition-all duration-300 text-white rounded-xl text-sm"
                    type="button"
                  >
                    <ArrowRight className="w-4 h-4 mr-1" />
                    Complete Step 1
                  </Button>
                )}
                {isReadyToConvert(latestRecord) && (
                  <Button
                    onClick={() => handleConvertToFunded(latestRecord)}
                    className="bg-gradient-to-r from-[#10B981] to-[#059669] hover:shadow-lg hover:shadow-[rgba(16,185,129,0.3)] hover:scale-105 transition-all duration-300 text-white rounded-xl text-sm"
                    type="button"
                  >
                    <ArrowRight className="w-4 h-4 mr-1" />
                    Convert
                  </Button>
                )}
                {lifecycle.convertedToFunded && (
                  <Badge variant="outline" className="border-[#10B981] text-[#10B981]">Converted</Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLifecycleToDelete(lifecycle)}
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

      {/* Challenge Table */}
      {viewMode === "table" && filteredLifecycles.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="rounded-xl overflow-hidden"
          style={{
            background: glassmorphism.card.background,
            backdropFilter: glassmorphism.card.backdropBlur,
            border: '1px solid rgba(148, 163, 184, 0.08)',
            borderRadius: borderRadius.xl,
          }}
        >
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[rgba(148,163,184,0.1)] hover:bg-transparent">
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider">Account</TableHead>
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider">Firm</TableHead>
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider">Lifecycle</TableHead>
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider text-right">Current P&L</TableHead>
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider text-right">Drawdown</TableHead>
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider text-right">Cost</TableHead>
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider">Outcome</TableHead>
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLifecycles.map((lifecycle) => {
                const { rootChallenge, latestRecord, outcomeColor, lifecycleNodes, statusBucket } = lifecycle;
                const currentProfit = getChallengeCurrentProfit(latestRecord);
                const drawdown = computeDrawdown(latestRecord.maxDrawdown, latestRecord.accountSize, currentProfit);
                return (
                  <TableRow
                    key={lifecycle.lifecycleId}
                    className="border-b border-[rgba(148,163,184,0.06)] hover:bg-[rgba(41,141,255,0.06)] transition-colors"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${outcomeColor}1A` }}>
                          <Trophy className="w-4 h-4" style={{ color: outcomeColor }} />
                        </div>
                        <span className="font-medium text-[#F8FAFC]">{rootChallenge.accountName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[#94A3B8]">{rootChallenge.propFirmName}</TableCell>
                    <TableCell>
                      <LifecycleIndicator nodes={lifecycleNodes} compact />
                    </TableCell>
                    <TableCell className="text-right text-[#F8FAFC] font-medium">{formatCurrency(currentProfit)}</TableCell>
                    <TableCell className="text-right text-[#94A3B8]">
                      {formatPercentage(drawdown.remainingDrawdownPercent)} ({formatCurrency(drawdown.remainingDrawdownDollars)})
                    </TableCell>
                    <TableCell className="text-right text-[#94A3B8]">{formatCurrency(lifecycle.totalCost)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="default"
                        className="font-semibold rounded-full border"
                        style={{
                          background: `${outcomeColor}26`,
                          color: outcomeColor,
                          borderColor: `${outcomeColor}66`,
                        }}
                      >
                        {STATUS_BUCKET_LABEL[statusBucket]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => router.push(`/challenges/${latestRecord.id}`)}
                          className="text-[#94A3B8] hover:text-[#298DFF] hover:bg-[rgba(41,141,255,0.1)] transition-all duration-300"
                          type="button"
                        >
                          <BarChart3 className="w-4 h-4" />
                        </Button>
                        {lifecycle.is2Step && !lifecycle.step2Record && latestRecord.status === 'active' && !lifecycle.convertedToFunded && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCompleteStep1(latestRecord)}
                            className="text-[#298DFF] hover:text-[#298DFF] hover:bg-[rgba(41,141,255,0.1)] transition-all duration-300"
                            type="button"
                            title="Complete Step 1"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                        )}
                        {isReadyToConvert(latestRecord) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleConvertToFunded(latestRecord)}
                            className="text-[#10B981] hover:text-[#10B981] hover:bg-[rgba(16,185,129,0.1)] transition-all duration-300"
                            type="button"
                            title="Convert to Funded"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setLifecycleToDelete(lifecycle)}
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

      <AddChallengeMarketDialog open={isAddMarketDialogOpen} onOpenChange={setIsAddMarketDialogOpen} />
      <DeleteLifecycleDialog
        open={!!lifecycleToDelete}
        onOpenChange={(open) => !open && setLifecycleToDelete(null)}
        onConfirm={() => {
          if (lifecycleToDelete) handleDeleteLifecycle(lifecycleToDelete);
          setLifecycleToDelete(null);
        }}
        accountName={lifecycleToDelete?.rootChallenge.accountName ?? ""}
        propFirmName={lifecycleToDelete?.rootChallenge.propFirmName ?? ""}
        is2Step={lifecycleToDelete?.is2Step ?? false}
      />
    </div>
  );
}
