"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Plus, TrendingUp, TrendingDown, Trash2, Upload } from "lucide-react";
import { useAccounts } from "@/context/AccountsContext";
import { useTradingMode } from "@/context/TradingModeContext";
import { getTradesForTradingMode } from "@/lib/tradingMode";
import { AddTradeDialog } from "@/components/AddTradeDialog";
import { ImportTradesDialog } from "@/components/ImportTradesDialog";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { DeleteAllTradesDialog } from "@/components/DeleteAllTradesDialog";
import { motion } from "framer-motion";
import { colors, typography, borderRadius, glassmorphism, gradientBorder, gradientText } from "@/design-system";
import { buildAccountIndex, filterGlobalTrades, GlobalFilters } from "@/lib/analytics/globalAnalytics";
import {
  ACCOUNT_STATUS_BADGE_COLOR,
  getAccountOptionLabel,
  getAccountStartDateLabel,
  getAccountStatusLabel,
} from "@/lib/accountLabels";

export default function Journal() {
  const { trades, tradesLoading, deleteTrade, deleteAllTrades, challenges, fundedAccounts } = useAccounts();
  const { tradingMode } = useTradingMode();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [selectedAccountType, setSelectedAccountType] = useState<"challenge" | "funded">("challenge");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const selectableAccounts = selectedAccountType === "challenge" ? challenges : fundedAccounts;
  const hasSelectedAccount = selectedAccountId !== "";

  // Journal must never mix Prop Firm and Personal Capital trades — Prop
  // Firm mode is a no-op pass-through (identical to before Personal
  // Capital existed); Personal Capital mode filters down to trades that
  // are actually personal. See src/lib/tradingMode.ts. Challenge/Funded
  // account selection above is still Prop-Firm-only (no personal accounts
  // exist yet), so this is what keeps a Personal Capital view empty even
  // if a challenge/funded account happens to be selected.
  const modeTrades = useMemo(() => getTradesForTradingMode(trades, tradingMode), [trades, tradingMode]);

  // Same filtering engine Trader DNA / Analytics uses (filterGlobalTrades),
  // so "From"/"To" here behaves identically everywhere dates are filtered.
  // scope/accountId narrow to the single account selected above; propFirm/
  // instrument/session are left unbounded since the Journal doesn't expose
  // those filters.
  const accountIndex = useMemo(() => buildAccountIndex(challenges, fundedAccounts), [challenges, fundedAccounts]);
  const journalFilters: GlobalFilters = useMemo(
    () => ({
      scope: selectedAccountType,
      dateFrom,
      dateTo,
      propFirm: "",
      accountId: selectedAccountId,
      instrument: "",
      session: "",
    }),
    [selectedAccountType, selectedAccountId, dateFrom, dateTo]
  );
  const accountTrades = hasSelectedAccount ? filterGlobalTrades(modeTrades, journalFilters, accountIndex) : [];

  const handleDeleteAllTrades = async () => {
    setIsDeletingAll(true);
    try {
      await deleteAllTrades();
      setIsDeleteAllDialogOpen(false);
      // Smart reset — behave like a brand-new account: no account selected,
      // no date range applied.
      setSelectedAccountId("");
      setDateFrom("");
      setDateTo("");
    } catch {
      // deleteAllTrades() already surfaces an error toast; nothing else to do.
    } finally {
      setIsDeletingAll(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const totalTrades = accountTrades.length;
  const winningTrades = accountTrades.filter(t => t.status === 'win').length;
  const losingTrades = accountTrades.filter(t => t.status === 'loss').length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const totalPnL = accountTrades.reduce((sum, t) => sum + t.pnl, 0);
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
          <Button
            variant="outline"
            className="border-[rgba(239,68,68,0.3)] text-[#EF4444] hover:bg-[rgba(239,68,68,0.1)] hover:border-[#EF4444] rounded-xl transition-all duration-300 disabled:opacity-40 disabled:pointer-events-none"
            onClick={() => setIsDeleteAllDialogOpen(true)}
            disabled={modeTrades.length === 0}
            type="button"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete All Trades
          </Button>
          <Button
            variant="outline"
            className="border-[rgba(148,163,184,0.2)] text-[#F8FAFC] hover:bg-[rgba(41,141,255,0.1)] hover:border-[#298DFF] rounded-xl transition-all duration-300 disabled:opacity-40 disabled:pointer-events-none"
            onClick={() => setIsImportDialogOpen(true)}
            disabled={!hasSelectedAccount}
            type="button"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import Trades
          </Button>
          <Button
            className="bg-gradient-to-r from-[#298DFF] to-[#1E6FE0] hover:shadow-lg hover:shadow-[rgba(41,141,255,0.3)] hover:scale-105 transition-all duration-300 text-white rounded-xl pointer-events-auto disabled:opacity-40 disabled:pointer-events-none"
            onClick={() => setIsAddDialogOpen(true)}
            disabled={!hasSelectedAccount}
            type="button"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Trade
          </Button>
        </div>
      </motion.div>

      {/* Account Selector */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="rounded-xl p-4 space-y-4"
        style={{
          background: glassmorphism.card.background,
          backdropFilter: glassmorphism.card.backdropBlur,
          border: '1px solid',
          borderColor: 'rgba(148, 163, 184, 0.08)',
          borderRadius: borderRadius.xl,
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[#8B97A8] text-sm">Account Type</label>
            <select
              value={selectedAccountType}
              onChange={(e) => {
                setSelectedAccountType(e.target.value as "challenge" | "funded");
                setSelectedAccountId("");
              }}
              className="w-full bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] rounded-lg px-3 py-2 border focus:border-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 transition-all"
            >
              <option value="challenge">Challenge</option>
              <option value="funded">Funded</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[#8B97A8] text-sm">Account</label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] rounded-lg px-3 py-2 border focus:border-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 transition-all"
            >
              <option value="">Select an account</option>
              {selectableAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {getAccountOptionLabel(account, selectedAccountType === "challenge")}
                </option>
              ))}
            </select>
            {hasSelectedAccount && (() => {
              const selectedAccount = selectableAccounts.find((a) => a.id === selectedAccountId);
              if (!selectedAccount) return null;
              const isChallenge = selectedAccountType === "challenge";
              const status = getAccountStatusLabel(selectedAccount, isChallenge);
              const color = ACCOUNT_STATUS_BADGE_COLOR[status] ?? "#94A3B8";
              return (
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}
                  >
                    {status}
                  </span>
                  <span className="text-[#64748B] text-xs">Start: {getAccountStartDateLabel(selectedAccount, isChallenge)}</span>
                </div>
              );
            })()}
          </div>
        </div>

        {hasSelectedAccount && (
          <div className="pt-4" style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }}>
            <DateRangeFilter
              dateFrom={dateFrom}
              dateTo={dateTo}
              onChange={(range) => { setDateFrom(range.dateFrom); setDateTo(range.dateTo); }}
            />
          </div>
        )}
      </motion.div>

      {!hasSelectedAccount ? (
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
            <BookOpen className="w-7 h-7 text-[#298DFF]" />
          </div>
          <p className="text-[#F8FAFC] text-lg font-semibold">Select an account to view or import trades</p>
        </motion.div>
      ) : (
      <>
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
          ) : accountTrades.length === 0 ? (
            <div className="text-center py-8 text-[#94A3B8]">
              <p>No trades recorded yet. Click "Add Trade" to start tracking.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {accountTrades.slice().reverse().map((trade) => (
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
      </>
      )}

      <AddTradeDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        defaultAccountType={selectedAccountType}
        defaultAccountId={selectedAccountId}
      />
      <ImportTradesDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        defaultAccountType={selectedAccountType}
        defaultAccountId={selectedAccountId}
      />
      <DeleteAllTradesDialog
        open={isDeleteAllDialogOpen}
        onOpenChange={setIsDeleteAllDialogOpen}
        onConfirm={handleDeleteAllTrades}
        isDeleting={isDeletingAll}
      />
    </div>
  );
}
