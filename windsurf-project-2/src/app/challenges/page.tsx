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
import { Trophy, Plus, TrendingUp, AlertCircle, DollarSign, ArrowRight, Trash2, BarChart3, LayoutGrid, List } from "lucide-react";
import { useAccounts } from "@/context/AccountsContext";
import { ChallengeStatus, Challenge } from "@/types";
import { AddChallengeDialog } from "@/components/AddChallengeDialog";
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

// Redesigned challenges view: filters, view toggle, progress chart, table
type StatusFilter = "all" | ChallengeStatus;
type ViewMode = "cards" | "table";

const STATUS_COLOR_MAP: Record<ChallengeStatus, string> = {
  active: "#298DFF",
  passed: "#10B981",
  failed: "#EF4444",
  refunded: "#F59E0B",
};

export default function Challenges() {
  const router = useRouter();
  const { challenges, getFundingRateStats, updateChallenge, convertChallengeToFunded, deleteChallenge, getAccountPnL } = useAccounts();
  const stats = getFundingRateStats();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: challenges.length,
      active: 0,
      passed: 0,
      failed: 0,
      refunded: 0,
    };
    challenges.forEach((c) => {
      counts[c.status] += 1;
    });
    return counts;
  }, [challenges]);

  const filteredChallenges = useMemo(
    () =>
      statusFilter === "all"
        ? challenges
        : challenges.filter((c) => c.status === statusFilter),
    [challenges, statusFilter]
  );

  const filterOptions: { value: StatusFilter; label: string; color: string }[] = [
    { value: "all", label: "All", color: "#94A3B8" },
    { value: "active", label: "Active", color: STATUS_COLOR_MAP.active },
    { value: "passed", label: "Passed", color: STATUS_COLOR_MAP.passed },
    { value: "failed", label: "Failed", color: STATUS_COLOR_MAP.failed },
    { value: "refunded", label: "Refunded", color: STATUS_COLOR_MAP.refunded },
  ];

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

  const getStatusColor = (status: ChallengeStatus) => {
    switch (status) {
      case 'active': return 'bg-[rgba(41,141,255,0.15)] text-[#298DFF] border border-[rgba(41,141,255,0.4)] font-semibold rounded-full';
      case 'passed': return 'bg-[rgba(16,185,129,0.15)] text-[#10B981] border border-[rgba(16,185,129,0.4)] font-semibold rounded-full';
      case 'failed': return 'bg-[rgba(239,68,68,0.15)] text-[#EF4444] border border-[rgba(239,68,68,0.4)] font-semibold rounded-full';
      case 'refunded': return 'bg-[rgba(245,158,11,0.15)] text-[#F59E0B] border border-[rgba(245,158,11,0.4)] font-semibold rounded-full';
      default: return 'bg-[rgba(148,163,184,0.15)] text-[#94A3B8] border border-[rgba(148,163,184,0.4)] font-semibold rounded-full';
    }
  };

  const getStatusBgColor = (status: ChallengeStatus) => {
    switch (status) {
      case 'active': return 'bg-[rgba(41,141,255,0.1)]';
      case 'passed': return 'bg-[rgba(16,185,129,0.1)]';
      case 'failed': return 'bg-[rgba(239,68,68,0.1)]';
      case 'refunded': return 'bg-[rgba(245,158,11,0.1)]';
      default: return 'bg-[rgba(148,163,184,0.1)]';
    }
  };

  const getStatusTextColor = (status: ChallengeStatus) => {
    switch (status) {
      case 'active': return 'text-[#298DFF]';
      case 'passed': return 'text-[#10B981]';
      case 'failed': return 'text-[#EF4444]';
      case 'refunded': return 'text-[#F59E0B]';
      default: return 'text-[#94A3B8]';
    }
  };

  const handleStatusChange = (id: string, newStatus: ChallengeStatus) => {
    updateChallenge(id, { status: newStatus });
  };

  const handleConvertToFunded = (challenge: any) => {
    const fundedAccount = {
      propFirmName: challenge.propFirmName,
      accountName: `${challenge.accountName} (Funded)`,
      sourceChallengeId: challenge.id,
      accountSize: challenge.accountSize,
      fundingDate: new Date().toISOString().split('T')[0],
      initialBalance: challenge.accountSize,
      currentBalance: challenge.accountSize * (1 + challenge.currentProfit / 100),
      currentProfit: challenge.currentProfit,
      maxDrawdown: challenge.maxDrawdown,
      remainingDrawdown: challenge.remainingDrawdown,
      status: 'active' as const,
    };
    convertChallengeToFunded(challenge.id, fundedAccount);
  };

  // ── 2-step workflow helpers ──────────────────────────────
  const is2Step = (c: Challenge) => c.challengeKind === "2-step";

  const getCurrentStep = (c: Challenge): "1" | "2" | "instant" =>
    c.challengeStep ?? (is2Step(c) ? "1" : "instant");

  const getStepTarget = (c: Challenge) => {
    if (is2Step(c)) {
      return getCurrentStep(c) === "1"
        ? (c.step1ProfitTarget ?? c.profitTarget)
        : (c.step2ProfitTarget ?? c.profitTarget);
    }
    return c.profitTarget;
  };

  // A 2-step account can only convert to funded once Step 2 is passed —
  // until then it stays in the Challenges space.
  const isReadyToConvert = (c: Challenge) =>
    (!is2Step(c) || getCurrentStep(c) === "2") &&
    c.status === "passed" &&
    !c.convertedToFunded;

  const handleCompleteStep1 = (c: Challenge) => {
    updateChallenge(c.id, {
      challengeStep: "2",
      currentProfit: 0,
      profitTarget: c.step2ProfitTarget ?? c.profitTarget,
      status: "active",
    });
  };

  const getChallengeProgress = (challenge: Challenge) => {
    const tradePnL = getAccountPnL(challenge.id, "challenge");
    const totalProfit = challenge.currentProfit + tradePnL;
    const progress = (totalProfit / getStepTarget(challenge)) * 100;
    return Math.min(progress, 100);
  };

  const getChallengeCurrentProfit = (challenge: Challenge) => {
    const tradePnL = getAccountPnL(challenge.id, "challenge");
    return challenge.currentProfit + tradePnL;
  };

  const cardVariants = {
    hover: {
      y: -4,
      transition: { duration: 0.3, ease: "easeOut" }
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
      transition: { duration: 0.4, ease: "easeOut" }
    }
  };

  const chartData = useMemo(
    () =>
      filteredChallenges.map((c) => ({
        name: c.accountName.length > 14 ? `${c.accountName.slice(0, 12)}…` : c.accountName,
        progress: Number(getChallengeProgress(c).toFixed(1)),
        status: c.status,
      })),
    [filteredChallenges]
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
          onClick={() => setIsAddDialogOpen(true)}
          type="button"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Challenge
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
                  formatter={(value: number) => [`${value}%`, 'Progress']}
                />
                <Bar dataKey="progress" radius={[6, 6, 0, 0]} maxBarSize={64}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={STATUS_COLOR_MAP[entry.status as ChallengeStatus]} />
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
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex flex-wrap items-center gap-2">
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

      {/* Empty State */}
      {filteredChallenges.length === 0 && (
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
            {statusFilter === 'all' ? 'No challenges yet' : `No ${statusFilter} challenges`}
          </p>
          <p className="text-[#94A3B8] mt-1" style={{ fontSize: typography.fontSize.sm }}>
            {statusFilter === 'all' ? 'Create your first challenge to get started' : 'Try a different filter'}
          </p>
        </motion.div>
      )}

      {/* Challenge Cards */}
      {viewMode === "cards" && filteredChallenges.length > 0 && (
      <motion.div
        layout
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        <AnimatePresence mode="popLayout">
        {filteredChallenges.map((challenge) => (
          <motion.div
            key={challenge.id}
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
                <Badge variant="default" className={getStatusColor(challenge.status)}>
                  {challenge.status}
                </Badge>
              </div>

              {/* Account Info */}
              <div className="flex items-start gap-4 mb-6">
                <div className={`w-14 h-14 ${getStatusBgColor(challenge.status)} rounded-xl flex items-center justify-center`}>
                  <Trophy className={`w-7 h-7 ${getStatusTextColor(challenge.status)}`} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-[#F8FAFC]">{challenge.accountName}</h3>
                  <p className="text-sm text-[#94A3B8]">{challenge.propFirmName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-[#64748B]">{challenge.challengeType}</p>
                    {is2Step(challenge) && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(41,141,255,0.12)] text-[#298DFF] border border-[rgba(41,141,255,0.3)]">
                        Step {getCurrentStep(challenge)} of 2
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Account Size */}
              <div className="mb-6">
                <p className="text-sm text-[#94A3B8] mb-1">Account Size</p>
                <p 
                  className="text-2xl font-bold text-[#F8FAFC]"
                  style={{ fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold }}
                >
                  {formatCurrency(challenge.accountSize)}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-[#94A3B8]">
                    {is2Step(challenge) ? `Step ${getCurrentStep(challenge)} Progress` : "Progress"}
                    <span className="text-[#64748B]"> · {formatCurrency(getStepTarget(challenge))}</span>
                  </p>
                  <p className="text-sm font-medium text-[#F8FAFC]">{formatPercentage(getChallengeProgress(challenge))}</p>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(148, 163, 184, 0.1)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${getChallengeProgress(challenge)}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{
                      background: challenge.status === 'active' ? gradientBorder.purpleBlue :
                             challenge.status === 'passed' ? gradientBorder.success :
                             challenge.status === 'failed' ? gradientBorder.danger :
                             gradientBorder.warning,
                    }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-xs text-[#94A3B8] mb-1">Current Profit</p>
                  <p className="text-sm font-medium text-[#F8FAFC]">{formatCurrency(getChallengeCurrentProfit(challenge))}</p>
                </div>
                <div>
                  <p className="text-xs text-[#94A3B8] mb-1">Target</p>
                  <p className="text-sm font-medium text-[#F8FAFC]">{formatCurrency(challenge.profitTarget)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#94A3B8] mb-1">Drawdown</p>
                  <p className="text-sm font-medium text-[#F8FAFC]">{formatPercentage(challenge.remainingDrawdown)} ({formatCurrency((challenge.remainingDrawdown / 100) * challenge.accountSize)})</p>
                </div>
                <div>
                  <p className="text-xs text-[#94A3B8] mb-1">Cost</p>
                  <p className="text-sm font-medium text-[#F8FAFC]">{formatCurrency(challenge.purchaseCost)}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/challenges/${challenge.id}`)}
                  className="flex-1 border-[rgba(148,163,184,0.2)] text-[#F8FAFC] hover:bg-[rgba(41,141,255,0.1)] hover:border-[#298DFF] rounded-xl pointer-events-auto transition-all duration-300"
                  type="button"
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Analytics
                </Button>
                <select
                  value={challenge.status}
                  onChange={(e) => handleStatusChange(challenge.id, e.target.value as ChallengeStatus)}
                  className="bg-[rgba(11,18,32,0.5)] text-[#F8FAFC] text-sm rounded-lg px-3 py-2 border border-[rgba(148,163,184,0.2)] focus:border-[#298DFF] focus:outline-none focus:ring-2 focus:ring-[rgba(41,141,255,0.2)] transition-all"
                >
                  <option value="active">Active</option>
                  <option value="passed">Passed</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
                {is2Step(challenge) && getCurrentStep(challenge) === '1' && !challenge.convertedToFunded && (
                  <Button
                    onClick={() => handleCompleteStep1(challenge)}
                    className="bg-gradient-to-r from-[#298DFF] to-[#1E6FE0] hover:shadow-lg hover:shadow-[rgba(41,141,255,0.3)] hover:scale-105 transition-all duration-300 text-white rounded-xl text-sm"
                    type="button"
                  >
                    <ArrowRight className="w-4 h-4 mr-1" />
                    Complete Step 1
                  </Button>
                )}
                {isReadyToConvert(challenge) && (
                  <Button
                    onClick={() => handleConvertToFunded(challenge)}
                    className="bg-gradient-to-r from-[#10B981] to-[#059669] hover:shadow-lg hover:shadow-[rgba(16,185,129,0.3)] hover:scale-105 transition-all duration-300 text-white rounded-xl text-sm"
                    type="button"
                  >
                    <ArrowRight className="w-4 h-4 mr-1" />
                    Convert
                  </Button>
                )}
                {challenge.convertedToFunded && (
                  <Badge variant="outline" className="border-[#10B981] text-[#10B981]">Converted</Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteChallenge(challenge.id)}
                  className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[rgba(239,68,68,0.1)] transition-all duration-300"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ))}
        </AnimatePresence>
      </motion.div>
      )}

      {/* Challenge Table */}
      {viewMode === "table" && filteredChallenges.length > 0 && (
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
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider">Prop Firm</TableHead>
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider text-right">Size</TableHead>
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider w-[180px]">Progress</TableHead>
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider text-right">Profit</TableHead>
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider">Status</TableHead>
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredChallenges.map((challenge) => {
                const progress = getChallengeProgress(challenge);
                return (
                  <TableRow
                    key={challenge.id}
                    className="border-b border-[rgba(148,163,184,0.06)] hover:bg-[rgba(41,141,255,0.06)] transition-colors"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 ${getStatusBgColor(challenge.status)} rounded-lg flex items-center justify-center`}>
                          <Trophy className={`w-4 h-4 ${getStatusTextColor(challenge.status)}`} />
                        </div>
                        <span className="font-medium text-[#F8FAFC]">{challenge.accountName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[#94A3B8]">{challenge.propFirmName}</TableCell>
                    <TableCell className="text-right text-[#F8FAFC] font-medium">{formatCurrency(challenge.accountSize)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 rounded-full overflow-hidden" style={{ background: 'rgba(148, 163, 184, 0.1)' }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${progress}%`, background: STATUS_COLOR_MAP[challenge.status] }}
                          />
                        </div>
                        <span className="text-xs text-[#94A3B8] w-10">{formatPercentage(progress)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-[#F8FAFC] font-medium">{formatCurrency(getChallengeCurrentProfit(challenge))}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className={getStatusColor(challenge.status)}>
                          {challenge.status}
                        </Badge>
                        {is2Step(challenge) && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(41,141,255,0.12)] text-[#298DFF] border border-[rgba(41,141,255,0.3)]">
                            S{getCurrentStep(challenge)}/2
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => router.push(`/challenges/${challenge.id}`)}
                          className="text-[#94A3B8] hover:text-[#298DFF] hover:bg-[rgba(41,141,255,0.1)] transition-all duration-300"
                          type="button"
                        >
                          <BarChart3 className="w-4 h-4" />
                        </Button>
                        {is2Step(challenge) && getCurrentStep(challenge) === '1' && !challenge.convertedToFunded && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCompleteStep1(challenge)}
                            className="text-[#298DFF] hover:text-[#298DFF] hover:bg-[rgba(41,141,255,0.1)] transition-all duration-300"
                            type="button"
                            title="Complete Step 1"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                        )}
                        {isReadyToConvert(challenge) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleConvertToFunded(challenge)}
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
                          onClick={() => deleteChallenge(challenge.id)}
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

      <AddChallengeDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
    </div>
  );
}
