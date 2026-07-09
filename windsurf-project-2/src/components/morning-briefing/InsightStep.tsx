"use client";

import { Bot } from "lucide-react";
import { glassmorphism, borderRadius, typography } from "@/design-system";

export function InsightStep({ insight }: { insight: string }) {
  return (
    <div className="w-full flex flex-col items-center text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: "rgba(41,141,255,0.1)" }}
      >
        <Bot className="w-7 h-7 text-[#298DFF]" />
      </div>
      <p className="text-[#94A3B8] uppercase mb-3" style={{ fontSize: typography.fontSize.xs, letterSpacing: typography.letterSpacing.label }}>
        EdgePilot Insight
      </p>
      <div
        className="rounded-xl p-6 max-w-lg"
        style={{
          background: glassmorphism.card.background,
          backdropFilter: glassmorphism.card.backdropBlur,
          border: "1px solid rgba(148,163,184,0.08)",
          borderRadius: borderRadius.xl,
        }}
      >
        <p className="text-[#F8FAFC] font-semibold" style={{ fontSize: typography.fontSize.lg, lineHeight: typography.lineHeight.relaxed }}>
          {insight}
        </p>
      </div>
    </div>
  );
}
