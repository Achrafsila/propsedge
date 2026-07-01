"use client";

import { useState, useMemo } from "react";
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
import { DollarSign, Clock, CheckCircle, AlertCircle, Plus, Trash2, BarChart3, LayoutGrid, List } from "lucide-react";
import { useAccounts } from "@/context/AccountsContext";
import { PayoutStatus } from "@/types";
import { AddPayoutDialog } from "@/components/AddPayoutDialog";
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

type PayoutStatusFilter = "all" | PayoutStatus;
type ViewMode = "cards" | "table";

const PAYOUT_STATUS_COLOR: Record<PayoutStatus, string> = {
  pending: "#F59E0B",
  paid: "#10B981",
  rejected: "#EF4444",
};

export default function Payouts() {
  const { payouts, payoutsLoading, fundedAccounts, updatePayout, deletePayout } = useAccounts();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusColor = (status: PayoutStatus) => {
    switch (status) {
      case 'pending': return 'bg-[rgba(245,158,11,0.15)] text-[#F59E0B] border border-[rgba(245,158,11,0.4)] font-semibold rounded-full';
      case 'paid': return 'bg-[rgba(16,185,129,0.15)] text-[#10B981] border border-[rgba(16,185,129,0.4)] font-semibold rounded-full';
      case 'rejected': return 'bg-[rgba(239,68,68,0.15)] text-[#EF4444] border border-[rgba(239,68,68,0.4)] font-semibold rounded-full';
      default: return 'bg-[rgba(148,163,184,0.15)] text-[#94A3B8] border border-[rgba(148,163,184,0.4)] font-semibold rounded-full';
    }
  };

  const getStatusBgColor = (status: PayoutStatus) => {
    switch (status) {
      case 'pending': return 'bg-[rgba(245,158,11,0.1)]';
      case 'paid': return 'bg-[rgba(16,185,129,0.1)]';
      case 'rejected': return 'bg-[rgba(239,68,68,0.1)]';
      default: return 'bg-[rgba(148,163,184,0.1)]';
    }
  };

  const getStatusTextColor = (status: PayoutStatus) => {
    switch (status) {
      case 'pending': return 'text-[#F59E0B]';
      case 'paid': return 'text-[#10B981]';
      case 'rejected': return 'text-[#EF4444]';
      default: return 'text-[#94A3B8]';
    }
  };

  const getStatusIcon = (status: PayoutStatus) => {
    switch (status) {
      case 'pending': return Clock;
      case 'paid': return CheckCircle;
      case 'rejected': return AlertCircle;
      default: return Clock;
    }
  };

  const handleStatusChange = (id: string, newStatus: PayoutStatus) => {
    updatePayout(id, { status: newStatus });
  };

  const totalEarned = payouts.reduce((sum, p) => sum + p.generatedProfit, 0);
  const totalReceived = payouts.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.receivedPayoutAmount, 0);
  const totalPending = payouts.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.requestedPayoutAmount, 0);
  const pendingCount = payouts.filter(p => p.status === 'pending').length;

  const [statusFilter, setStatusFilter] = useState<PayoutStatusFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  const statusCounts = useMemo(() => {
    const counts: Record<PayoutStatusFilter, number> = { all: payouts.length, pending: 0, paid: 0, rejected: 0 };
    payouts.forEach((p) => { counts[p.status] += 1; });
    return counts;
  }, [payouts]);

  const filteredPayouts = useMemo(
    () => (statusFilter === "all" ? payouts : payouts.filter((p) => p.status === statusFilter)),
    [payouts, statusFilter]
  );

  const filterOptions: { value: PayoutStatusFilter; label: string; color: string }[] = [
    { value: "all", label: "All", color: "#94A3B8" },
    { value: "pending", label: "Pending", color: PAYOUT_STATUS_COLOR.pending },
    { value: "paid", label: "Paid", color: PAYOUT_STATUS_COLOR.paid },
    { value: "rejected", label: "Rejected", color: PAYOUT_STATUS_COLOR.rejected },
  ];

  const chartData = useMemo(
    () =>
      filteredPayouts.map((p) => {
        const acct = fundedAccounts.find((a) => a.id === p.fundedAccountId);
        return {
          name: acct ? (acct.accountName.length > 14 ? `${acct.accountName.slice(0, 12)}…` : acct.accountName) : `#${p.id}`,
          amount: Number((p.status === 'paid' ? p.receivedPayoutAmount : p.requestedPayoutAmount).toFixed(0)),
          status: p.status,
        };
      }),
    [filteredPayouts, fundedAccounts]
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

  if (payoutsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#F59E0B] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
            Payouts
          </h1>
          <p className="text-[#94A3B8] mt-2" style={{ fontSize: typography.fontSize.base, opacity: typography.opacity.tertiary }}>Manage your withdrawal requests</p>
        </div>
        <Button 
          className="bg-gradient-to-r from-[#F59E0B] to-[#D97706] hover:shadow-lg hover:shadow-[rgba(245,158,11,0.3)] hover:scale-105 transition-all duration-300 text-white rounded-xl pointer-events-auto"
          onClick={() => setIsAddDialogOpen(true)}
          type="button"
        >
          <Plus className="w-4 h-4 mr-2" />
          Request Payout
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
                style={{ background: 'rgba(245, 158, 11, 0.1)' }}
              >
                <DollarSign className="w-6 h-6 text-[#F59E0B]" />
              </div>
              <div className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
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
              Total Earned
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
              {formatCurrency(totalEarned)}
            </p>
            <p className="text-[#64748B] mt-2" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}>All time profit</p>
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
                <CheckCircle className="w-6 h-6 text-[#10B981]" />
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
              Total Received
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
              {formatCurrency(totalReceived)}
            </p>
            <p className="text-[#64748B] mt-2" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}>Paid to you</p>
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
                <Clock className="w-6 h-6 text-[#F59E0B]" />
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
              Pending
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
              {formatCurrency(totalPending)}
            </p>
            <p className="text-[#64748B] mt-2" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}>{pendingCount} requests</p>
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
              Total Payouts
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
              {payouts.length}
            </p>
            <p className="text-[#64748B] mt-2" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}>All requests</p>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Payouts Chart */}
      <motion.div
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.15 }}
      >
        <div
          className="relative rounded-xl p-6"
          style={{ background: glassmorphism.card.background, backdropFilter: glassmorphism.card.backdropBlur, border: '1px solid rgba(148, 163, 184, 0.08)', borderRadius: borderRadius.xl }}
        >
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-[#F59E0B]" />
            <h3
              className="text-[#F8FAFC]"
              style={{ fontSize: typography.fontSize.section, fontWeight: typography.fontWeight.bold, letterSpacing: typography.letterSpacing.section }}
            >
              Payouts by Account
            </h3>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.08)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={{ stroke: 'rgba(148, 163, 184, 0.15)' }} tickLine={false} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  cursor={{ fill: 'rgba(245, 158, 11, 0.08)' }}
                  contentStyle={{ background: 'rgba(11, 18, 32, 0.95)', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '12px', color: '#F8FAFC' }}
                  formatter={((value: number) => [formatCurrency(value), 'Amount']) as never}
                />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={64}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={PAYOUT_STATUS_COLOR[entry.status as PayoutStatus]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex flex-col items-center justify-center text-center">
              <BarChart3 className="w-10 h-10 text-[#475569] mb-3" />
              <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.base }}>No payouts to chart yet</p>
              <p className="text-[#64748B] mt-1" style={{ fontSize: typography.fontSize.xs }}>Payout amounts per account will appear here</p>
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
                  <span className="px-1.5 py-0.5 rounded-full text-xs" style={{ background: 'rgba(0,0,0,0.25)', color: isActive ? '#F8FAFC' : '#64748B' }}>
                    {statusCounts[option.value]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'rgba(148, 163, 184, 0.06)', border: '1px solid rgba(148, 163, 184, 0.12)' }}>
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 pointer-events-auto"
            style={{ color: viewMode === 'cards' ? '#F8FAFC' : '#94A3B8', background: viewMode === 'cards' ? 'rgba(245, 158, 11, 0.2)' : 'transparent' }}
          >
            <LayoutGrid className="w-4 h-4" />
            Cards
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 pointer-events-auto"
            style={{ color: viewMode === 'table' ? '#F8FAFC' : '#94A3B8', background: viewMode === 'table' ? 'rgba(245, 158, 11, 0.2)' : 'transparent' }}
          >
            <List className="w-4 h-4" />
            Table
          </button>
        </div>
      </motion.div>

      {/* Empty State */}
      {filteredPayouts.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl p-12 flex flex-col items-center justify-center text-center"
          style={{ background: glassmorphism.card.background, backdropFilter: glassmorphism.card.backdropBlur, border: '1px solid rgba(148, 163, 184, 0.08)', borderRadius: borderRadius.xl }}
        >
          <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
            <DollarSign className="w-7 h-7 text-[#F59E0B]" />
          </div>
          <p className="text-[#F8FAFC] text-lg font-semibold">
            {statusFilter === 'all' ? 'No payouts yet' : `No ${statusFilter} payouts`}
          </p>
          <p className="text-[#94A3B8] mt-1" style={{ fontSize: typography.fontSize.sm }}>
            {statusFilter === 'all' ? 'Request a payout to get started' : 'Try a different filter'}
          </p>
        </motion.div>
      )}

      {/* Payout Cards */}
      {viewMode === "cards" && filteredPayouts.length > 0 && (
      <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
        {filteredPayouts.map((payout) => {
          const fundedAccount = fundedAccounts.find(a => a.id === payout.fundedAccountId);
          const StatusIcon = getStatusIcon(payout.status);

          return (
            <motion.div
              key={payout.id}
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
                  <Badge variant="default" className={getStatusColor(payout.status)}>
                    {payout.status}
                  </Badge>
                </div>

                {/* Payout Info */}
                <div className="flex items-start gap-4 mb-6">
                  <div className={`w-14 h-14 ${getStatusBgColor(payout.status)} rounded-xl flex items-center justify-center`}>
                    <StatusIcon className={`w-7 h-7 ${getStatusTextColor(payout.status)}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-[#F8FAFC]">Payout #{payout.id}</h3>
                    <p className="text-sm text-[#94A3B8]">{payout.payoutDate}</p>
                    <p className="text-xs text-[#64748B] mt-1">
                      {fundedAccount ? fundedAccount.accountName : 'Unknown Account'}
                    </p>
                  </div>
                </div>

                {/* Requested Amount */}
                <div className="mb-6">
                  <p className="text-sm text-[#94A3B8] mb-1">Requested Amount</p>
                  <p 
                    className="text-2xl font-bold text-[#F8FAFC]"
                    style={{ fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold }}
                  >
                    {formatCurrency(payout.requestedPayoutAmount)}
                  </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-xs text-[#94A3B8] mb-1">Generated Profit</p>
                    <p className="text-sm font-medium text-[#F8FAFC]">{formatCurrency(payout.generatedProfit)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#94A3B8] mb-1">Prop Firm Split</p>
                    <p className="text-sm font-medium text-[#F8FAFC]">{payout.propFirmSplitPercentage}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#94A3B8] mb-1">Received Amount</p>
                    <p className="text-sm font-medium text-[#10B981]">{formatCurrency(payout.receivedPayoutAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#94A3B8] mb-1">Your Share</p>
                    <p className="text-sm font-medium text-[#F8FAFC]">{100 - payout.propFirmSplitPercentage}%</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <select
                    value={payout.status}
                    onChange={(e) => handleStatusChange(payout.id, e.target.value as PayoutStatus)}
                    className="flex-1 bg-[rgba(11,18,32,0.5)] text-[#F8FAFC] text-sm rounded-lg px-3 py-2 border border-[rgba(148,163,184,0.2)] focus:border-[#F59E0B] focus:outline-none focus:ring-2 focus:ring-[rgba(245,158,11,0.2)] transition-all"
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deletePayout(payout.id)}
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

      {/* Payout Table */}
      {viewMode === "table" && filteredPayouts.length > 0 && (
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
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider">Date</TableHead>
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider text-right">Requested</TableHead>
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider text-right">Received</TableHead>
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider text-right">Split</TableHead>
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider">Status</TableHead>
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayouts.map((payout) => {
                const fundedAccount = fundedAccounts.find(a => a.id === payout.fundedAccountId);
                const StatusIcon = getStatusIcon(payout.status);
                return (
                  <TableRow key={payout.id} className="border-b border-[rgba(148,163,184,0.06)] hover:bg-[rgba(245,158,11,0.06)] transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 ${getStatusBgColor(payout.status)} rounded-lg flex items-center justify-center`}>
                          <StatusIcon className={`w-4 h-4 ${getStatusTextColor(payout.status)}`} />
                        </div>
                        <span className="font-medium text-[#F8FAFC]">{fundedAccount ? fundedAccount.accountName : `Payout #${payout.id}`}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[#94A3B8]">{payout.payoutDate}</TableCell>
                    <TableCell className="text-right text-[#F8FAFC] font-medium">{formatCurrency(payout.requestedPayoutAmount)}</TableCell>
                    <TableCell className="text-right text-[#10B981] font-medium">{formatCurrency(payout.receivedPayoutAmount)}</TableCell>
                    <TableCell className="text-right text-[#94A3B8]">{payout.propFirmSplitPercentage}%</TableCell>
                    <TableCell>
                      <Badge variant="default" className={getStatusColor(payout.status)}>{payout.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deletePayout(payout.id)}
                        className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[rgba(239,68,68,0.1)] transition-all duration-300"
                        type="button"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </motion.div>
      )}

      <AddPayoutDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
    </div>
  );
}
