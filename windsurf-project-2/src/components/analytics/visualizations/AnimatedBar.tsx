"use client";

import { motion } from "framer-motion";
import { typography } from "@/design-system";

// Horizontal animated progress bar — label on the left, value/caption on the
// right, fill width animates in on scroll. Matches the whileInView/0.4s
// convention already used by every Trader DNA card. Percentage is always
// supplied by the caller; this component only draws it.
export function AnimatedBar({
  label,
  percentage,
  color,
  valueLabel,
  trackColor = "rgba(148,163,184,0.08)",
  delay = 0,
  showHeader = true,
}: {
  label: string;
  percentage: number;
  color: string;
  valueLabel?: string;
  trackColor?: string;
  delay?: number;
  showHeader?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, percentage));

  return (
    <div>
      {showHeader && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.sm }}>
            {label}
          </span>
          <span className="font-semibold" style={{ fontSize: typography.fontSize.sm, color }}>
            {valueLabel ?? `${Math.round(clamped)}%`}
          </span>
        </div>
      )}
      <div className="h-2 rounded-full overflow-hidden" style={{ background: trackColor }}>
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${clamped}%` }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.6, delay, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
    </div>
  );
}
