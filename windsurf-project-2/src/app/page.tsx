"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Activity,
  Target,
  Clock,
  Percent
} from "lucide-react";
import { useAccounts } from "@/context/AccountsContext";
import { motion } from "framer-motion";
import { colors, typography, borderRadius, shadows, glassmorphism, gradientBorder, gradientText } from "@/design-system";

export default function Dashboard() {
  const { getDashboardKPIs, challenges, fundedAccounts } = useAccounts();
  const kpis = getDashboardKPIs();

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
      {/* Hero Section — Sui-style electric-blue glow */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative -mx-6 -mt-6 px-6 pt-12 pb-10 overflow-hidden"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(120% 120% at 50% 0%, rgba(41,141,255,0.35) 0%, rgba(41,141,255,0.10) 32%, rgba(41,141,255,0) 65%)' }}
        />
        <div className="relative">
          <h1
            className="font-extrabold"
            style={{
              fontSize: '4rem',
              fontWeight: 800,
              letterSpacing: '-0.05em',
              lineHeight: 1,
              background: gradientText.premium,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent'
            }}
          >
            Dashboard
          </h1>
          <p className="text-[#94A3B8] mt-3" style={{ fontSize: typography.fontSize.base, opacity: typography.opacity.tertiary }}>Overview of your prop firm performance</p>
        </div>
      </motion.div>

      {/* Portfolio Overview KPI Cards */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {/* Total Capital */}
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
                <DollarSign className="w-6 h-6 text-[#298DFF]" />
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
              {formatCurrency(kpis.totalChallengeCosts + kpis.totalFundedCapital)}
            </p>
            <p className="text-[#64748B] mt-2" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}>Combined portfolio value</p>
          </motion.div>
        </motion.div>

        {/* Active Challenges */}
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
                <Target className="w-6 h-6 text-[#3B82F6]" />
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
              {kpis.activeChallengeAccounts}
            </p>
            <p className="text-[#64748B] mt-2" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}>In progress</p>
          </motion.div>
        </motion.div>

        {/* Funded Capital */}
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
                <Activity className="w-6 h-6 text-[#10B981]" />
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
              Funded Capital
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
              {formatCurrency(kpis.totalFundedCapital)}
            </p>
            <p className="text-[#64748B] mt-2" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}>Total funded size</p>
          </motion.div>
        </motion.div>

        {/* ROI */}
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
                style={{ background: kpis.roiPercentage >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}
              >
                <TrendingUp className={`w-6 h-6 ${kpis.roiPercentage >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`} />
              </div>
              <div className={`w-2 h-2 rounded-full animate-pulse ${kpis.roiPercentage >= 0 ? 'bg-[#10B981]' : 'bg-[#EF4444]'}`} />
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
              ROI
            </p>
            <p 
              className={kpis.roiPercentage >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}
              style={{ 
                fontSize: typography.fontSize.kpi, 
                fontWeight: typography.fontWeight.extraBold,
                letterSpacing: typography.letterSpacing.kpi,
                lineHeight: typography.lineHeight.kpi,
                background: kpis.roiPercentage >= 0 ? gradientText.premium : undefined,
                backgroundClip: kpis.roiPercentage >= 0 ? 'text' : undefined,
                WebkitBackgroundClip: kpis.roiPercentage >= 0 ? 'text' : undefined,
                color: kpis.roiPercentage >= 0 ? 'transparent' : undefined
              }}
            >
              {formatPercentage(kpis.roiPercentage)}
            </p>
            <p className="text-[#64748B] mt-2" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}>Return on investment</p>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Secondary Stats */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {/* Total Payouts */}
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
              {formatCurrency(kpis.totalPayoutsReceived)}
            </p>
            <p className="text-[#64748B] mt-2" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}>Total withdrawals</p>
          </motion.div>
        </motion.div>

        {/* Funding Rate */}
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
                <Target className="w-6 h-6 text-[#298DFF]" />
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
              Funding Rate
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
              {formatPercentage(kpis.fundingRate)}
            </p>
            <p className="text-[#64748B] mt-2" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}>Conversion rate</p>
          </motion.div>
        </motion.div>

        {/* Active Funded */}
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
                <Activity className="w-6 h-6 text-[#10B981]" />
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
              Active Funded
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
              {kpis.activeFundedAccounts}
            </p>
            <p className="text-[#64748B] mt-2" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}>Currently trading</p>
          </motion.div>
        </motion.div>

        {/* Net Profit */}
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
                style={{ background: kpis.netROI >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}
              >
                <TrendingUp className={`w-6 h-6 ${kpis.netROI >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`} />
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
              Net Profit
            </p>
            <p 
              className={kpis.netROI >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}
              style={{ 
                fontSize: typography.fontSize.kpi, 
                fontWeight: typography.fontWeight.extraBold,
                letterSpacing: typography.letterSpacing.kpi,
                lineHeight: typography.lineHeight.kpi
              }}
            >
              {formatCurrency(kpis.netROI)}
            </p>
            <p className="text-[#64748B] mt-2" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}>Total profit/loss</p>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Recent Activity */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.4 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
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
            <h3 className="text-lg font-semibold text-[#F8FAFC] mb-4">Recent Challenges</h3>
            <div className="space-y-3">
              {challenges.slice(0, 3).map((challenge) => (
                <div 
                  key={challenge.id} 
                  className="flex items-center justify-between p-4 rounded-xl transition-all duration-300 hover:scale-[1.02]"
                  style={{
                    background: 'rgba(11, 18, 32, 0.5)',
                    border: '1px solid rgba(148, 163, 184, 0.08)',
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      challenge.status === 'active' ? 'bg-[rgba(41,141,255,0.1)]' :
                      challenge.status === 'passed' ? 'bg-[rgba(16,185,129,0.1)]' :
                      challenge.status === 'failed' ? 'bg-[rgba(239,68,68,0.1)]' :
                      'bg-[rgba(245,158,11,0.1)]'
                    }`}>
                      <Target className={`w-5 h-5 ${
                        challenge.status === 'active' ? 'text-[#298DFF]' :
                        challenge.status === 'passed' ? 'text-[#10B981]' :
                        challenge.status === 'failed' ? 'text-[#EF4444]' :
                        'text-[#F59E0B]'
                      }`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#F8FAFC]">{challenge.accountName}</p>
                      <p className="text-xs text-[#94A3B8]">{challenge.propFirmName} • {formatCurrency(challenge.accountSize)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-medium text-[#F8FAFC]">{formatPercentage(challenge.currentProfit)}</p>
                      <p className="text-xs text-[#94A3B8]">Target: {formatPercentage(challenge.profitTarget)}</p>
                    </div>
                    <Badge 
                      variant="default" 
                      className={
                        challenge.status === 'active' ? 'bg-[rgba(41,141,255,0.2)] text-[#298DFF] border border-[rgba(41,141,255,0.3)]' :
                        challenge.status === 'passed' ? 'bg-[rgba(16,185,129,0.2)] text-[#10B981] border border-[rgba(16,185,129,0.3)]' :
                        challenge.status === 'failed' ? 'bg-[rgba(239,68,68,0.2)] text-[#EF4444] border border-[rgba(239,68,68,0.3)]' :
                        'bg-[rgba(245,158,11,0.2)] text-[#F59E0B] border border-[rgba(245,158,11,0.3)]'
                      }
                    >
                      {challenge.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
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
            <h3 className="text-lg font-semibold text-[#F8FAFC] mb-4">Funded Accounts</h3>
            <div className="space-y-3">
              {fundedAccounts.slice(0, 3).map((account) => (
                <div 
                  key={account.id} 
                  className="flex items-center justify-between p-4 rounded-xl transition-all duration-300 hover:scale-[1.02]"
                  style={{
                    background: 'rgba(11, 18, 32, 0.5)',
                    border: '1px solid rgba(148, 163, 184, 0.08)',
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      account.status === 'active' ? 'bg-[rgba(16,185,129,0.1)]' :
                      account.status === 'breached' ? 'bg-[rgba(239,68,68,0.1)]' :
                      'bg-[rgba(148,163,184,0.1)]'
                    }`}>
                      <Activity className={`w-5 h-5 ${
                        account.status === 'active' ? 'text-[#10B981]' :
                        account.status === 'breached' ? 'text-[#EF4444]' :
                        'text-[#94A3B8]'
                      }`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#F8FAFC]">{account.accountName}</p>
                      <p className="text-xs text-[#94A3B8]">{account.propFirmName} • {formatCurrency(account.accountSize)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-medium text-[#F8FAFC]">{formatCurrency(account.currentBalance)}</p>
                      <p className="text-xs text-[#94A3B8]">{formatPercentage(account.currentProfit)} profit</p>
                    </div>
                    <Badge 
                      variant="default" 
                      className={
                        account.status === 'active' ? 'bg-[rgba(16,185,129,0.2)] text-[#10B981] border border-[rgba(16,185,129,0.3)]' :
                        account.status === 'breached' ? 'bg-[rgba(239,68,68,0.2)] text-[#EF4444] border border-[rgba(239,68,68,0.3)]' :
                        'bg-[rgba(148,163,184,0.2)] text-[#94A3B8] border border-[rgba(148,163,184,0.3)]'
                      }
                    >
                      {account.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}
