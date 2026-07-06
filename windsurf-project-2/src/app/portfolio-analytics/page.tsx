"use client";

import { motion } from "framer-motion";
import { LineChart } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";

const PERSONAL_CAPITAL_GRADIENT = "linear-gradient(90deg, #FFFFFF, #6EE7B7, #2DD4BF)";

// Placeholder page so the Personal Capital nav's "Analytics" link resolves.
// Distinct from Trader DNA (/analytics, behavioral engine, shared with Prop
// Firm) — this is meant for portfolio-level performance analytics specific
// to Personal Capital, not yet built.
export default function PortfolioAnalyticsPage() {
  return (
    <div className="space-y-8">
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
          Analytics
        </motion.h1>
        <p className="text-[#94A3B8] mt-3" style={{ fontSize: typography.fontSize.base }}>
          Portfolio-level performance analytics — coming soon.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="rounded-xl p-10 flex flex-col items-center justify-center text-center"
        style={{
          background: glassmorphism.card.background,
          backdropFilter: glassmorphism.card.backdropBlur,
          border: "1px solid rgba(148, 163, 184, 0.08)",
          borderRadius: borderRadius.xl,
        }}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
          style={{ background: "rgba(20,184,166,0.1)" }}
        >
          <LineChart className="w-6 h-6" style={{ color: "#14B8A6" }} />
        </div>
        <p className="text-[#F8FAFC] font-semibold" style={{ fontSize: typography.fontSize.section }}>
          Coming soon
        </p>
        <p className="text-[#64748B] mt-1.5" style={{ fontSize: typography.fontSize.xs }}>
          Portfolio analytics is on the roadmap for a future Personal Capital block.
        </p>
      </motion.div>
    </div>
  );
}
