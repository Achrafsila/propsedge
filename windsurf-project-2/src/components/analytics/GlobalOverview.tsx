"use client";

import { motion } from "framer-motion";
import { BarChart3, DollarSign, Target, TrendingUp } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { GlobalTradeStats } from "@/lib/analytics/globalAnalytics";

const fmt$ = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const cardVariants = { hover: { y: -4, transition: { duration: 0.3 } } };

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  sub: string;
}) {
  return (
    <motion.div variants={cardVariants} whileHover="hover">
      <div
        className="relative rounded-xl p-6 transition-all duration-300"
        style={{
          background: glassmorphism.card.background,
          backdropFilter: glassmorphism.card.backdropBlur,
          border: "1px solid rgba(148,163,184,0.08)",
          borderRadius: borderRadius.xl,
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: `${color}1A` }}
          >
            <Icon className="w-6 h-6" style={{ color }} />
          </div>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: color }} />
        </div>
        <p
          className="text-[#94A3B8] mb-2 uppercase"
          style={{
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.medium,
            letterSpacing: typography.letterSpacing.label,
            opacity: typography.opacity.secondary,
          }}
        >
          {label}
        </p>
        <p
          style={{
            color,
            fontSize: typography.fontSize.kpi,
            fontWeight: typography.fontWeight.extraBold,
            letterSpacing: typography.letterSpacing.kpi,
            lineHeight: typography.lineHeight.kpi,
          }}
        >
          {value}
        </p>
        <p className="text-[#64748B] mt-2" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}>
          {sub}
        </p>
      </div>
    </motion.div>
  );
}

export function GlobalOverview({ stats }: { stats: GlobalTradeStats }) {
  const pnlColor = stats.netPnL >= 0 ? "#10B981" : "#EF4444";

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <KpiCard
        icon={BarChart3}
        label="Total Trades"
        value={stats.totalTrades.toString()}
        color="#298DFF"
        sub={`${stats.wins}W · ${stats.losses}L · ${stats.breakeven}BE`}
      />
      <KpiCard
        icon={DollarSign}
        label="Net P&L"
        value={fmt$(stats.netPnL)}
        color={pnlColor}
        sub="Across all matching trades"
      />
      <KpiCard
        icon={TrendingUp}
        label="Win Rate"
        value={`${stats.winRate.toFixed(1)}%`}
        color="#10B981"
        sub={`${stats.wins} of ${stats.totalTrades} trades`}
      />
      <KpiCard
        icon={Target}
        label="Profit Factor"
        value={stats.profitFactor.toFixed(2)}
        color="#D4AF37"
        sub={`Avg win ${fmt$(stats.avgWin)}`}
      />
    </div>
  );
}
