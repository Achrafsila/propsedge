"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Wallet, PiggyBank, ArrowDownToLine, TrendingUp, LineChart, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { usePersonalPortfolio } from "@/context/PersonalPortfolioContext";
import { AddCashTransactionDialog } from "@/components/personal-capital/AddCashTransactionDialog";

const PERSONAL_CAPITAL_GRADIENT = "linear-gradient(90deg, #FFFFFF, #6EE7B7, #2DD4BF)";
const EMERALD = "#10B981";
const TEAL = "#14B8A6";

const CURRENCY_OPTIONS = ["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD"];

function PageHeader({ subtitle }: { subtitle: string }) {
  return (
    <div>
      <motion.h1
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          fontSize: typography.fontSize.display,
          fontWeight: typography.fontWeight.extraBold,
          letterSpacing: typography.letterSpacing.display,
          lineHeight: typography.lineHeight.display,
          background: PERSONAL_CAPITAL_GRADIENT,
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          color: "transparent",
        }}
      >
        Portfolio
      </motion.h1>
      <p className="text-[#94A3B8] mt-3" style={{ fontSize: typography.fontSize.base }}>
        {subtitle}
      </p>
    </div>
  );
}

// ── Setup screen — shown until a portfolio has been created ────────────────
function PortfolioSetup() {
  const { createPortfolio } = usePersonalPortfolio();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [initialDeposit, setInitialDeposit] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedDeposit = parseFloat(initialDeposit);
    createPortfolio({
      name: name.trim() || "My Portfolio",
      currency,
      initialDeposit: Number.isFinite(parsedDeposit) ? parsedDeposit : 0,
    });
  };

  return (
    <div className="space-y-8">
      <PageHeader subtitle="Track portfolio growth, deposits, withdrawals, and trading performance." />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="rounded-xl p-8 max-w-lg"
        style={{
          background: glassmorphism.card.background,
          backdropFilter: glassmorphism.card.backdropBlur,
          border: "1px solid rgba(148, 163, 184, 0.08)",
          borderRadius: borderRadius.xl,
        }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${EMERALD}1A` }}>
            <Wallet className="w-6 h-6" style={{ color: EMERALD }} />
          </div>
          <h3 className="text-[#F8FAFC] font-bold" style={{ fontSize: typography.fontSize.section }}>
            Create Your Portfolio
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="portfolio-name" className="text-[#8B97A8]">Portfolio Name</Label>
            <Input
              id="portfolio-name"
              type="text"
              placeholder="My Portfolio"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="portfolio-currency" className="text-[#8B97A8]">Currency</Label>
            <select
              id="portfolio-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] rounded-lg px-3 py-2 border focus:border-[#10B981] focus:outline-none focus:ring-2 focus:ring-[#10B981]/20 transition-all"
            >
              {CURRENCY_OPTIONS.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="initial-deposit" className="text-[#8B97A8]">Initial Deposit</Label>
            <Input
              id="initial-deposit"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={initialDeposit}
              onChange={(e) => setInitialDeposit(e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full bg-[#10B981] hover:bg-[#0EA271] text-white">
            Create Portfolio
          </Button>
        </form>
      </motion.div>
    </div>
  );
}

// ── KPI card ─────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  sublabel?: string;
  delay?: number;
}

function KpiCard({ label, value, icon: Icon, color, sublabel, delay = 0 }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="relative rounded-xl p-5"
      style={{
        background: glassmorphism.card.background,
        backdropFilter: glassmorphism.card.backdropBlur,
        border: "1px solid rgba(148, 163, 184, 0.08)",
        borderRadius: borderRadius.xl,
      }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color}1A` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <p
        className="text-[#94A3B8] mb-1.5 uppercase"
        style={{
          fontSize: typography.fontSize.xs,
          fontWeight: typography.fontWeight.medium,
          letterSpacing: typography.letterSpacing.label,
        }}
      >
        {label}
      </p>
      <p className="font-extrabold tabular-nums leading-none" style={{ fontSize: "1.75rem", letterSpacing: "-0.04em", color }}>
        {value}
      </p>
      {sublabel && (
        <p className="text-[#64748B] mt-1.5" style={{ fontSize: typography.fontSize.xs }}>{sublabel}</p>
      )}
    </motion.div>
  );
}

// ── Portfolio dashboard — shown once a portfolio exists ─────────────────────
function PortfolioDashboard() {
  const { portfolio, cashTransactions, getNetDeposits, getNetWithdrawals, getTradingProfit, getPortfolioValue } =
    usePersonalPortfolio();
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);

  const currency = portfolio?.currency ?? "USD";
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

  const netDeposits = getNetDeposits();
  const netWithdrawals = getNetWithdrawals();
  const tradingProfit = getTradingProfit();
  const portfolioValue = getPortfolioValue();
  const totalReturn = netDeposits > 0 ? (tradingProfit / netDeposits) * 100 : null;

  const sortedTransactions = [...cashTransactions].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <PageHeader subtitle={`${portfolio?.name} · ${currency}`} />
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={() => setDepositOpen(true)}
            className="bg-[#10B981] hover:bg-[#0EA271] text-white rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Deposit
          </Button>
          <Button
            type="button"
            onClick={() => setWithdrawalOpen(true)}
            variant="outline"
            className="border-[rgba(20,184,166,0.4)] text-[#14B8A6] hover:bg-[rgba(20,184,166,0.1)] rounded-xl"
          >
            <Minus className="w-4 h-4 mr-2" />
            Add Withdrawal
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard label="Portfolio Value" value={formatCurrency(portfolioValue)} icon={Wallet} color={EMERALD} delay={0.05} />
        <KpiCard label="Net Deposits" value={formatCurrency(netDeposits)} icon={PiggyBank} color={TEAL} delay={0.1} />
        <KpiCard label="Net Withdrawals" value={formatCurrency(netWithdrawals)} icon={ArrowDownToLine} color={TEAL} delay={0.15} />
        <KpiCard
          label="Trading Profit"
          value={formatCurrency(tradingProfit)}
          icon={TrendingUp}
          color={tradingProfit >= 0 ? EMERALD : "#EF4444"}
          sublabel="Personal Capital trades only"
          delay={0.2}
        />
        <KpiCard
          label="Total Return"
          value={totalReturn === null ? "—" : `${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(2)}%`}
          icon={LineChart}
          color={totalReturn === null ? "#94A3B8" : totalReturn >= 0 ? EMERALD : "#EF4444"}
          delay={0.25}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="relative rounded-xl p-6"
        style={{
          background: glassmorphism.card.background,
          backdropFilter: glassmorphism.card.backdropBlur,
          border: "1px solid rgba(148, 163, 184, 0.08)",
          borderRadius: borderRadius.xl,
        }}
      >
        <h3 className="text-[#F8FAFC] font-semibold mb-4" style={{ fontSize: typography.fontSize.section }}>
          Transaction History
        </h3>
        {sortedTransactions.length === 0 ? (
          <div className="text-center py-10 text-[#94A3B8]">
            <p>No deposits or withdrawals recorded yet.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[rgba(148,163,184,0.1)] hover:bg-transparent">
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider">Date</TableHead>
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider">Type</TableHead>
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider text-right">Amount</TableHead>
                <TableHead className="text-[#94A3B8] uppercase text-xs tracking-wider">Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTransactions.map((t) => (
                <TableRow key={t.id} className="border-b border-[rgba(148,163,184,0.06)] hover:bg-[rgba(16,185,129,0.04)] transition-colors">
                  <TableCell className="text-[#94A3B8]">{t.date}</TableCell>
                  <TableCell>
                    <Badge
                      className={t.type === "deposit"
                        ? "bg-[rgba(16,185,129,0.2)] text-[#10B981] border border-[rgba(16,185,129,0.3)]"
                        : "bg-[rgba(20,184,166,0.2)] text-[#14B8A6] border border-[rgba(20,184,166,0.3)]"
                      }
                    >
                      {t.type === "deposit" ? "Deposit" : "Withdrawal"}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className="text-right font-medium"
                    style={{ color: t.type === "deposit" ? EMERALD : TEAL }}
                  >
                    {t.type === "deposit" ? "+" : "-"}{formatCurrency(t.amount)}
                  </TableCell>
                  <TableCell className="text-[#94A3B8]">{t.note || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </motion.div>

      <AddCashTransactionDialog open={depositOpen} onOpenChange={setDepositOpen} type="deposit" />
      <AddCashTransactionDialog open={withdrawalOpen} onOpenChange={setWithdrawalOpen} type="withdrawal" />
    </div>
  );
}

export default function PortfolioPage() {
  const { portfolio } = usePersonalPortfolio();
  return portfolio ? <PortfolioDashboard /> : <PortfolioSetup />;
}
