"use client";

import { AlertTriangle } from "lucide-react";
import { borderRadius, typography } from "@/design-system";

export function MissingAccountWarning({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3"
      style={{
        background: "rgba(245,158,11,0.08)",
        border: "1px solid rgba(245,158,11,0.3)",
        borderRadius: borderRadius.xl,
      }}
    >
      <AlertTriangle className="w-5 h-5 text-[#F59E0B] flex-shrink-0" />
      <p className="text-[#F59E0B]" style={{ fontSize: typography.fontSize.sm }}>
        {count} trade{count === 1 ? "" : "s"} {count === 1 ? "is" : "are"} linked to missing accounts —
        excluded from Performance by Account and Performance by Prop Firm, but still counted in Net P&L.
      </p>
    </div>
  );
}
