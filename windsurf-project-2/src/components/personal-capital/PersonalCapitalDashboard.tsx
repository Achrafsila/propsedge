"use client";

import { motion } from "framer-motion";
import { Wallet, PiggyBank, ArrowDownToLine, TrendingUp, LineChart, TrendingDown } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";

// Personal Capital's own subtle accent palette — emerald/teal only, kept
// local to this component so Prop Firm's brand blue (#298DFF) and the
// shared design-system tokens are never touched by this mode.
const EMERALD = "#10B981";
const TEAL = "#14B8A6";

const PERSONAL_CAPITAL_GRADIENT = "linear-gradient(90deg, #FFFFFF, #6EE7B7, #2DD4BF)";

interface PlaceholderCard {
  label: string;
  icon: React.ElementType;
  color: string;
}

const PLACEHOLDER_CARDS: PlaceholderCard[] = [
  { label: "Portfolio Value", icon: Wallet, color: EMERALD },
  { label: "Net Deposits", icon: PiggyBank, color: TEAL },
  { label: "Net Withdrawals", icon: ArrowDownToLine, color: TEAL },
  { label: "Trading Profit", icon: TrendingUp, color: EMERALD },
  { label: "Total Return", icon: LineChart, color: EMERALD },
  { label: "Current Drawdown", icon: TrendingDown, color: TEAL },
];

// V1 placeholder only — no portfolio/deposit/withdrawal data model exists
// yet, so every card shows "—" rather than a fabricated number. This is a
// dedicated component (not a reuse or edit of the Prop Firm dashboard) so
// that dashboard can keep evolving independently without risk of collision.
export function PersonalCapitalDashboard() {
  return (
    <div className="space-y-8">
      <div className="relative -mx-6 -mt-6 px-6 pt-12 pb-8 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 120% at 50% 0%, rgba(16,185,129,0.25) 0%, rgba(20,184,166,0.08) 32%, rgba(16,185,129,0) 65%)",
          }}
        />
        <div className="relative">
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
            Personal Capital Dashboard
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="text-[#94A3B8] mt-3"
            style={{ fontSize: typography.fontSize.base }}
          >
            Track portfolio growth, deposits, withdrawals, and trading performance.
          </motion.p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PLACEHOLDER_CARDS.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            className="relative rounded-xl p-5"
            style={{
              background: glassmorphism.card.background,
              backdropFilter: glassmorphism.card.backdropBlur,
              border: "1px solid rgba(148, 163, 184, 0.08)",
              borderRadius: borderRadius.xl,
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{ background: `${card.color}1A` }}
            >
              <card.icon className="w-5 h-5" style={{ color: card.color }} />
            </div>
            <p
              className="text-[#94A3B8] mb-1.5 uppercase"
              style={{
                fontSize: typography.fontSize.xs,
                fontWeight: typography.fontWeight.medium,
                letterSpacing: typography.letterSpacing.label,
              }}
            >
              {card.label}
            </p>
            <p
              className="font-extrabold tabular-nums leading-none"
              style={{ fontSize: "1.75rem", letterSpacing: "-0.04em", color: card.color }}
            >
              —
            </p>
            <p className="text-[#64748B] mt-1.5" style={{ fontSize: typography.fontSize.xs }}>
              Coming soon
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
