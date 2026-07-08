"use client";

import { motion } from "framer-motion";
import { Fingerprint } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { TraderIdentity } from "@/lib/analytics/traderIdentity";
import { AnimatedBar } from "@/components/analytics/visualizations/AnimatedBar";

const IDENTITY_COLOR = "#298DFF";
const LONG_COLOR = "#10B981";

interface ProfileTile {
  label: string;
  value: string;
  note?: string;
}

// Renders whatever src/lib/analytics/traderIdentity.ts (+ the already-computed
// TraderDNAStats.tradesByDirection and TraderHabits.averageHoldingTime, both
// passed in as props, neither recomputed here) determines — no thresholds,
// category names, or fallback labels are decided in this component. Session/
// instrument distributions moved to their own cards (SessionPerformanceCard,
// InstrumentBreakdownCard) so they're shown once, not duplicated here.
export function TradingIdentityCard({
  identity,
  tradesByDirection,
  averageHoldingTime,
  averageHoldingTimeExplanation,
}: {
  identity: TraderIdentity;
  tradesByDirection: { long: number; short: number };
  averageHoldingTime: string;
  averageHoldingTimeExplanation: string;
}) {
  const tiles: ProfileTile[] = [
    { label: "Trading Style", value: identity.tradingStyle, note: identity.tradingStyleExplanation },
    { label: "Market Focus", value: identity.marketSpecialization },
    { label: "Session Profile", value: identity.sessionProfile },
  ];

  const totalDirectional = tradesByDirection.long + tradesByDirection.short;
  const longPct = totalDirectional > 0 ? Math.round((tradesByDirection.long / totalDirectional) * 100) : 0;
  const shortPct = totalDirectional > 0 ? 100 - longPct : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4 }}
      className="rounded-xl p-6"
      style={{
        background: glassmorphism.card.background,
        backdropFilter: glassmorphism.card.backdropBlur,
        border: "1px solid rgba(148,163,184,0.08)",
        borderRadius: borderRadius.xl,
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${IDENTITY_COLOR}1A` }}
        >
          <Fingerprint className="w-5 h-5" style={{ color: IDENTITY_COLOR }} />
        </div>
        <h3 className="text-[#F8FAFC] font-bold" style={{ fontSize: typography.fontSize.section }}>
          Trading Identity
        </h3>
      </div>

      <p
        className="text-[#94A3B8] mb-5"
        style={{ fontSize: typography.fontSize.sm, opacity: typography.opacity.tertiary }}
      >
        The core shape of how you trade — style, market, and session.
      </p>

      {/* Profile tiles — large values instead of label/value text rows */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-xl p-3.5"
            style={{ background: "rgba(41,141,255,0.06)", border: "1px solid rgba(41,141,255,0.15)" }}
          >
            <p
              className="text-[#94A3B8] uppercase mb-1.5"
              style={{ fontSize: typography.fontSize.xs, letterSpacing: typography.letterSpacing.label, opacity: typography.opacity.secondary }}
            >
              {tile.label}
            </p>
            <p className="text-[#F8FAFC] font-bold leading-tight" style={{ fontSize: typography.fontSize.lg }}>
              {tile.value}
            </p>
            {tile.note && (
              <p
                className="text-[#64748B] mt-1"
                style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary, lineHeight: typography.lineHeight.normal }}
              >
                {tile.note}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Long vs Short bias — real tradesByDirection split, not a new metric */}
      <div className="mb-5">
        <AnimatedBar
          label="Long vs Short Bias"
          percentage={longPct}
          color={LONG_COLOR}
          valueLabel={totalDirectional > 0 ? `${longPct}% Long · ${shortPct}% Short` : "No directional data yet"}
        />
      </div>

      {/* Average Holding Time — real value from TraderHabits */}
      <div
        className="rounded-xl p-3.5 mb-5"
        style={{ background: "rgba(148,163,184,0.05)", border: "1px solid rgba(148,163,184,0.1)" }}
      >
        <p
          className="text-[#94A3B8] uppercase mb-1.5"
          style={{ fontSize: typography.fontSize.xs, letterSpacing: typography.letterSpacing.label, opacity: typography.opacity.secondary }}
        >
          Average Holding Time
        </p>
        <p className="text-[#F8FAFC] font-bold leading-tight" style={{ fontSize: typography.fontSize.lg }}>
          {averageHoldingTime}
        </p>
        <p
          className="text-[#64748B] mt-1"
          style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary, lineHeight: typography.lineHeight.normal }}
        >
          {averageHoldingTimeExplanation}
        </p>
      </div>

      <div className="pt-4" style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }}>
        <h4
          className="text-[#F8FAFC] font-semibold mb-1.5"
          style={{ fontSize: typography.fontSize.sm }}
        >
          Executive Summary
        </h4>
        <p
          className="text-[#94A3B8]"
          style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary, lineHeight: typography.lineHeight.relaxed }}
        >
          {identity.executiveSummary}
        </p>
      </div>
    </motion.div>
  );
}
