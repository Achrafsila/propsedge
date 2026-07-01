"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Plus, TrendingUp, TrendingDown, Filter, Trash2, Upload } from "lucide-react";
import { useAccounts } from "@/context/AccountsContext";
import { AddTradeDialog } from "@/components/AddTradeDialog";
import { ImportTradesDialog } from "@/components/ImportTradesDialog";
import { motion } from "framer-motion";
import { colors, typography, borderRadius, glassmorphism, gradientBorder, gradientText } from "@/design-system";

export default function Journal() {
  const { trades, tradesLoading, deleteTrade, challenges, fundedAccounts } = useAccounts();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const totalTrades = trades.length;
  const winningTrades = trades.filter(t => t.status === 'win').length;
  const losingTrades = trades.filter(t => t.status === 'loss').length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
  const avgTrade = totalTrades > 0 ? totalPnL / totalTrades : 0;

  const getAccountName = (accountId: string, accountType: "challenge" | "funded") => {
    if (accountType === "challenge") {
      const challenge = challenges.find(c => c.id === accountId);
      return challenge?.accountName || "Unknown Account";
    } else {
      const account = fundedAccounts.find(a => a.id === accountId);
      return account?.accountName || "Unknown Account";
    }
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
            Trade Journal
          </h1>
          <p className="text-[#94A3B8] mt-2" style={{ fontSize: typography.fontSize.base, opacity: typography.opacity.tertiary }}>Track and analyze your trading history</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-[rgba(148,163,184,0.2)] text-[#F8FAFC] hover:bg-[rgba(41,141,255,0.1)] hover:border-[#298DFF] rounded-xl transition-all duration-300">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button
            variant="outline"
            className="border-[rgba(148,163,184,0.2)] text-[#F8FAFC] hover:bg-[rgba(41,141,255,0.1)] hover:border-[#298DFF] rounded-xl transition-all duration-300"
            onClick={() => setIsImportDialogOpen(true)}
            type="button"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import Trades
          </Button>
          <Button
            className="bg-gradient-to-r from-[#298DFF] to-[#1E6FE0] hover:shadow-lg hover:shadow-[rgba(41,141,255,0.3)] hover:scale-105 transition-all duration-300 text-white rounded-xl pointer-events-auto"
            onClick={() => setIsAddDialogOpen(true)}
            type="button"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Trade
          </Button>
        </div>
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
                <BookOpen className="w-6 h-6 text-[#298DFF]" />
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
              Total Trades
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
              {totalTrades}
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
              Win Rate
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
              {winRate.toFixed(1)}%
            </p>
            <p className="text-[#64748B] mt-2" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}>{winningTrades}W / {losingTrades}L</p>
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
                style={{ background: totalPnL >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}
              >
                <TrendingUp className={`w-6 h-6 ${totalPnL >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`} />
              </div>
              <div className={`w-2 h-2 rounded-full animate-pulse ${totalPnL >= 0 ? 'bg-[#10B981]' : 'bg-[#EF4444]'}`} />
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
              Total P&L
            </p>
            <p 
              className={totalPnL >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}
              style={{ 
                fontSize: typography.fontSize.kpi, 
                fontWeight: typography.fontWeight.extraBold,
                letterSpacing: typography.letterSpacing.kpi,
                lineHeight: typography.lineHeight.kpi
              }}
            >
              {formatCurrency(totalPnL)}
            </p>
            <p className="text-[#64748B] mt-2" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}>Cumulative profit/loss</p>
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
                style={{ background: avgTrade >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}
              >
                <BookOpen className={`w-6 h-6 ${avgTrade >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`} />
              </div>
              <div className={`w-2 h-2 rounded-full animate-pulse ${avgTrade >= 0 ? 'bg-[#10B981]' : 'bg-[#EF4444]'}`} />
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
              Avg Trade
            </p>
            <p 
              className={avgTrade >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}
              style={{ 
                fontSize: typography.fontSize.kpi, 
                fontWeight: typography.fontWeight.extraBold,
                letterSpacing: typography.letterSpacing.kpi,
                lineHeight: typography.lineHeight.kpi
              }}
            >
              {formatCurrency(avgTrade)}
            </p>
            <p className="text-[#64748B] mt-2" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}>Per trade average</p>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Recent Trades */}
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
          <h3 className="text-lg font-semibold text-[#F8FAFC] mb-4">Recent Trades</h3>
          {tradesLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 border-2 border-[#298DFF] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : trades.length === 0 ? (
            <div className="text-center py-8 text-[#94A3B8]">
              <p>No trades recorded yet. Click "Add Trade" to start tracking.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {trades.slice().reverse().map((trade) => (
                <div 
                  key={trade.id} 
                  className="flex items-center justify-between p-4 rounded-xl transition-all duration-300 hover:scale-[1.02]"
                  style={{
                    background: 'rgba(11, 18, 32, 0.5)',
                    border: '1px solid rgba(148, 163, 184, 0.08)',
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      trade.status === 'win' ? 'bg-[rgba(16,185,129,0.1)]' :
                      trade.status === 'loss' ? 'bg-[rgba(239,68,68,0.1)]' :
                      'bg-[rgba(148,163,184,0.1)]'
                    }`}>
                      {trade.status === 'win' ? (
                        <TrendingUp className="w-5 h-5 text-[#10B981]" />
                      ) : trade.status === 'loss' ? (
                        <TrendingDown className="w-5 h-5 text-[#EF4444]" />
                      ) : (
                        <BookOpen className="w-5 h-5 text-[#94A3B8]" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#F8FAFC]">{trade.symbol}</p>
                      <p className="text-xs text-[#94A3B8]">{getAccountName(trade.accountId, trade.accountType)} • {trade.entryDate}</p>
                      {trade.session && (
                        <p className="text-xs text-[#64748B]">{trade.session} Session</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={`text-sm font-medium ${trade.pnl >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                        {formatCurrency(trade.pnl)}
                      </p>
                    </div>
                    {trade.picture && (
                      <button
                        onClick={() => window.open(trade.picture, '_blank')}
                        className="text-[#298DFF] hover:text-[#7CC0FF] transition-colors"
                        title="View Screenshot"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                          <circle cx="8.5" cy="8.5" r="1.5"></circle>
                          <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                      </button>
                    )}
                    <Badge 
                      variant="default" 
                      className={
                        trade.status === 'win' ? 'bg-[rgba(16,185,129,0.2)] text-[#10B981] border border-[rgba(16,185,129,0.3)]' :
                        trade.status === 'loss' ? 'bg-[rgba(239,68,68,0.2)] text-[#EF4444] border border-[rgba(239,68,68,0.3)]' :
                        'bg-[rgba(148,163,184,0.2)] text-[#94A3B8] border border-[rgba(148,163,184,0.3)]'
                      }
                    >
                      {trade.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteTrade(trade.id)}
                      className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[rgba(239,68,68,0.1)] transition-all duration-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>

      <AddTradeDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
      <ImportTradesDialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen} />
    </div>
  );
}
