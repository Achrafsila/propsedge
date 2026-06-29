"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  Edit, 
  Plus, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  BarChart3,
  ChevronLeft,
  ChevronRight
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
  ReferenceLine
} from "recharts";
import { AddTradeDialog } from "@/components/AddTradeDialog";
import { AddPayoutDialog } from "@/components/AddPayoutDialog";

interface AccountAnalyticsViewProps {
  account: any;
  trades: any[];
  payouts: any[];
  accountType: "challenge" | "funded";
  allAccounts: any[];
  onAccountChange: (accountId: string) => void;
}

export function AccountAnalyticsView({ 
  account, 
  trades, 
  payouts, 
  accountType, 
  allAccounts,
  onAccountChange 
}: AccountAnalyticsViewProps) {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isAddTradeDialogOpen, setIsAddTradeDialogOpen] = useState(false);
  const [isAddPayoutDialogOpen, setIsAddPayoutDialogOpen] = useState(false);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-[#00C875]';
      case 'passed': return 'bg-[#00C875]';
      case 'failed': return 'bg-[#FF4D4F]';
      case 'breached': return 'bg-[#FF4D4F]';
      case 'refunded': return 'bg-[#D8A94A]';
      case 'closed': return 'bg-[#566070]';
      default: return 'bg-[#566070]';
    }
  };

  // Calculate daily P&L from trades
  const dailyPnL = trades.reduce((acc: any, trade: any) => {
    const date = trade.entryDate;
    if (!acc[date]) {
      acc[date] = { pnl: 0, trades: 0 };
    }
    acc[date].pnl += trade.pnl;
    acc[date].trades += 1;
    return acc;
  }, {});

  // Generate equity curve data
  const equityCurveData = Object.entries(dailyPnL)
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .reduce((acc: any, [date, data]: any, index: number) => {
      const previousBalance = index === 0 ? account.accountSize : acc[index - 1].balance;
      const balance = previousBalance + data.pnl;
      acc.push({ date, balance, pnl: data.pnl });
      return acc;
    }, []);

  // Calculate statistics
  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl < 0);
  const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
  const avgWin = winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length : 0;
  const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;
  const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);

  // Calculate target progress using actual P&L from trades
  const targetProgress = accountType === 'challenge' && account.profitTarget > 0
    ? (totalPnL / account.profitTarget) * 100
    : 0;

  // Calculate drawdown limit
  const drawdownLimit = accountType === 'challenge'
    ? account.accountSize - account.maxDrawdown
    : account.accountSize - account.maxDrawdown;

  // Calendar navigation
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    
    const days = [];
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const getDayPnL = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return dailyPnL[dateStr] || null;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const monthDays = getDaysInMonth(currentMonth);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="text-[#8B97A8] hover:text-[#F8FAFC] hover:bg-[#111C33]"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-[#F8FAFC]">Analytics</h1>
            <p className="text-[#8B97A8] mt-1">
              {accountType === 'challenge' ? 'Challenge Account' : 'Funded Account'} Details
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={account.id}
            onChange={(e) => onAccountChange(e.target.value)}
            className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] rounded-lg px-4 py-2 focus:border-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 transition-all"
          >
            {allAccounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.accountName} - {formatCurrency(acc.accountSize)}
              </option>
            ))}
          </select>
          <Badge variant="default" className={getStatusColor(account.status)}>
            {account.status}
          </Badge>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="border-[#1A2942] text-[#F8FAFC] hover:bg-[#111C33] hover:border-[#2F80ED] rounded-xl"
        >
          <Edit className="w-4 h-4 mr-2" />
          Edit Account
        </Button>
        <Button
          variant="outline"
          className="border-[#1A2942] text-[#F8FAFC] hover:bg-[#111C33] hover:border-[#2F80ED] rounded-xl pointer-events-auto"
          onClick={() => setIsAddTradeDialogOpen(true)}
          type="button"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Trade
        </Button>
        {accountType === 'funded' && (
          <Button
            variant="outline"
            className="border-[#1A2942] text-[#F8FAFC] hover:bg-[#111C33] hover:border-[#D8A94A] rounded-xl pointer-events-auto"
            onClick={() => setIsAddPayoutDialogOpen(true)}
            type="button"
          >
            <DollarSign className="w-4 h-4 mr-2" />
            Request Payout
          </Button>
        )}
      </div>

      {/* Account Data Strip */}
      <Card className="bg-[#080D1B] border-[#1A2942]">
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <p className="text-[#8B97A8] mb-1">Start Date</p>
              <p className="text-[#F8FAFC] font-medium">
                {accountType === 'challenge' ? account.purchaseDate : account.fundingDate}
              </p>
            </div>
            <div>
              <p className="text-[#8B97A8] mb-1">Account Type</p>
              <p className="text-[#F8FAFC] font-medium capitalize">{accountType}</p>
            </div>
            <div>
              <p className="text-[#8B97A8] mb-1">Prop Firm</p>
              <p className="text-[#F8FAFC] font-medium">{account.propFirmName}</p>
            </div>
            <div>
              <p className="text-[#8B97A8] mb-1">Plan Type</p>
              <p className="text-[#F8FAFC] font-medium">
                {accountType === 'challenge' ? account.challengeType : 'Funded'}
              </p>
            </div>
            <div>
              <p className="text-[#8B97A8] mb-1">Account Size</p>
              <p className="text-[#F8FAFC] font-medium">{formatCurrency(account.accountSize)}</p>
            </div>
            <div>
              <p className="text-[#8B97A8] mb-1">Starting Balance</p>
              <p className="text-[#F8FAFC] font-medium">{formatCurrency(account.accountSize)}</p>
            </div>
            <div>
              <p className="text-[#8B97A8] mb-1">Current Balance</p>
              <p className="text-[#F8FAFC] font-medium">
                {formatCurrency(accountType === 'challenge' 
                  ? account.accountSize * (1 + account.currentProfit / 100)
                  : account.currentBalance
                )}
              </p>
            </div>
            <div>
              <p className="text-[#8B97A8] mb-1">Platform</p>
              <p className="text-[#F8FAFC] font-medium">TradingView</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trading Growth Curve */}
      <Card className="bg-[#080D1B] border-[#1A2942]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[#F8FAFC]">Trading Growth Curve</CardTitle>
            <div className="flex gap-4 text-sm">
              <div>
                <p className="text-[#8B97A8]">Net P&L</p>
                <p className={`font-medium ${totalPnL >= 0 ? 'text-[#00C875]' : 'text-[#FF4D4F]'}`}>
                  {formatCurrency(totalPnL)}
                </p>
              </div>
              {accountType === 'challenge' && (
                <>
                  <div>
                    <p className="text-[#8B97A8]">Target Progress</p>
                    <p className="font-medium text-[#F8FAFC]">
                      {formatPercentage(targetProgress)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#8B97A8]">Drawdown Remaining</p>
                    <p className="font-medium text-[#FF4D4F]">
                      {formatPercentage(account.remainingDrawdown)}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            {equityCurveData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={equityCurveData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1A2942" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#8B97A8"
                    fontSize={12}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis 
                    stroke="#8B97A8"
                    fontSize={12}
                    tickFormatter={(value) => formatCurrency(value)}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0D1424', 
                      border: '1px solid #1A2942',
                      borderRadius: '8px',
                      color: '#F8FAFC'
                    }}
                    formatter={(value: any) => formatCurrency(Number(value))}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="balance" 
                    stroke="#2F80ED" 
                    strokeWidth={2}
                    dot={false}
                  />
                  {accountType === 'challenge' && (
                    <>
                      <ReferenceLine 
                        y={account.accountSize} 
                        stroke="#8B97A8" 
                        strokeDasharray="3 3"
                        label="Start"
                      />
                      <ReferenceLine 
                        y={account.accountSize + account.profitTarget} 
                        stroke="#D8A94A" 
                        strokeDasharray="3 3"
                        label="Target"
                      />
                      <ReferenceLine 
                        y={drawdownLimit} 
                        stroke="#FF4D4F" 
                        strokeDasharray="3 3"
                        label="Max Drawdown"
                      />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[#8B97A8]">
                No trading data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Trading Calendar */}
      <Card className="bg-[#080D1B] border-[#1A2942]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[#F8FAFC]">Trading Calendar</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateMonth('prev')}
                className="text-[#8B97A8] hover:text-[#F8FAFC] hover:bg-[#111C33]"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <span className="text-[#F8FAFC] font-medium min-w-[150px] text-center">
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateMonth('next')}
                className="text-[#8B97A8] hover:text-[#F8FAFC] hover:bg-[#111C33]"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center text-sm font-medium text-[#8B97A8] py-2">
                {day}
              </div>
            ))}
            {monthDays.map((date, index) => {
              if (!date) {
                return <div key={index} className="aspect-square" />;
              }
              const dayPnL = getDayPnL(date);
              return (
                <div
                  key={index}
                  className={`aspect-square rounded-lg p-2 border transition-all ${
                    isToday(date) 
                      ? 'border-[#D8A94A] bg-[#0D1424]' 
                      : dayPnL 
                        ? dayPnL.pnl >= 0 
                          ? 'border-[#00C875]/30 bg-[#00C875]/10' 
                          : 'border-[#FF4D4F]/30 bg-[#FF4D4F]/10'
                        : 'border-[#1A2942] bg-[#0D1424]'
                  }`}
                >
                  <div className="text-xs text-[#8B97A8] mb-1">{date.getDate()}</div>
                  {dayPnL && (
                    <>
                      <div className={`text-xs font-medium ${dayPnL.pnl >= 0 ? 'text-[#00C875]' : 'text-[#FF4D4F]'}`}>
                        {formatCurrency(dayPnL.pnl)}
                      </div>
                      <div className="text-xs text-[#8B97A8]">{dayPnL.trades} trades</div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <Card className="bg-[#080D1B] border-[#1A2942]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#00C875]/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[#00C875]" />
              </div>
              <div>
                <p className="text-xs text-[#8B97A8]">Best Trade</p>
                <p className="text-sm font-medium text-[#00C875]">
                  {winningTrades.length > 0 ? formatCurrency(Math.max(...winningTrades.map(t => t.pnl))) : '$0'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#080D1B] border-[#1A2942]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FF4D4F]/10 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-[#FF4D4F]" />
              </div>
              <div>
                <p className="text-xs text-[#8B97A8]">Worst Trade</p>
                <p className="text-sm font-medium text-[#FF4D4F]">
                  {losingTrades.length > 0 ? formatCurrency(Math.min(...losingTrades.map(t => t.pnl))) : '$0'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#080D1B] border-[#1A2942]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#2F80ED]/10 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-[#2F80ED]" />
              </div>
              <div>
                <p className="text-xs text-[#8B97A8]">Win Rate</p>
                <p className="text-sm font-medium text-[#F8FAFC]">{formatPercentage(winRate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#080D1B] border-[#1A2942]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#D8A94A]/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-[#D8A94A]" />
              </div>
              <div>
                <p className="text-xs text-[#8B97A8]">Profit Factor</p>
                <p className="text-sm font-medium text-[#F8FAFC]">{profitFactor.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#080D1B] border-[#1A2942]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#2F80ED]/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-[#2F80ED]" />
              </div>
              <div>
                <p className="text-xs text-[#8B97A8]">Total Trades</p>
                <p className="text-sm font-medium text-[#F8FAFC]">{trades.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#080D1B] border-[#1A2942]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#00C875]/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[#00C875]" />
              </div>
              <div>
                <p className="text-xs text-[#8B97A8]">Average Win</p>
                <p className="text-sm font-medium text-[#00C875]">{formatCurrency(avgWin)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#080D1B] border-[#1A2942]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FF4D4F]/10 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-[#FF4D4F]" />
              </div>
              <div>
                <p className="text-xs text-[#8B97A8]">Average Loss</p>
                <p className="text-sm font-medium text-[#FF4D4F]">{formatCurrency(avgLoss)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#080D1B] border-[#1A2942]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#2F80ED]/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-[#2F80ED]" />
              </div>
              <div>
                <p className="text-xs text-[#8B97A8]">Avg Daily P&L</p>
                <p className={`text-sm font-medium ${totalPnL >= 0 ? 'text-[#00C875]' : 'text-[#FF4D4F]'}`}>
                  {trades.length > 0 ? formatCurrency(totalPnL / Object.keys(dailyPnL).length) : '$0'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <AddTradeDialog 
        open={isAddTradeDialogOpen} 
        onOpenChange={setIsAddTradeDialogOpen} 
      />
      {accountType === 'funded' && (
        <AddPayoutDialog 
          open={isAddPayoutDialogOpen} 
          onOpenChange={setIsAddPayoutDialogOpen} 
        />
      )}
    </div>
  );
}
