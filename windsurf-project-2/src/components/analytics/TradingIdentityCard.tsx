"use client";

import { motion } from "framer-motion";
import { Fingerprint } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";
import { TraderIdentity } from "@/lib/analytics/traderIdentity";

const IDENTITY_COLOR = "#298DFF";

interface IdentityBlock {
  label: string;
  value: string;
  distribution: { key: string; percentage: number }[];
  note?: string;
}

// Renders whatever src/lib/analytics/traderIdentity.ts computes — no
// thresholds, category names, or fallback labels are decided here. This
// card is real (not a placeholder): style, market focus, and session
// profile each get their classification plus the real distribution behind
// it, and the executive summary is the engine's own deterministic
// narrative, not something assembled in this component.
export function TradingIdentityCard({ identity }: { identity: TraderIdentity }) {
  const blocks: IdentityBlock[] = [
    {
      label: "Trading Style",
      value: identity.tradingStyle,
      distribution: [],
      note: identity.tradingStyleExplanation,
    },
    {
      label: "Market Focus",
      value: identity.marketSpecialization,
      distribution: identity.topInstruments.map((i) => ({ key: i.symbol, percentage: i.percentage })),
    },
    {
      label: "Session Profile",
      value: identity.sessionProfile,
      distribution: identity.sessionDistribution.map((s) => ({ key: s.session, percentage: s.percentage })),
    },
  ];

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

      <div className="space-y-5 mb-5">
        {blocks.map((block) => (
          <div key={block.label}>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.sm }}>
                {block.label}
              </span>
              <span
                className="text-[#F8FAFC] font-semibold text-right"
                style={{ fontSize: typography.fontSize.sm }}
              >
                {block.value}
              </span>
            </div>

            {block.note && (
              <p
                className="text-[#94A3B8] mt-1.5"
                style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}
              >
                {block.note}
              </p>
            )}

            {block.distribution.length > 0 && (
              <div className="mt-1.5 space-y-0.5">
                {block.distribution.map((entry) => (
                  <p
                    key={entry.key}
                    className="text-[#94A3B8]"
                    style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}
                  >
                    {entry.key} • {entry.percentage}%
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
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
