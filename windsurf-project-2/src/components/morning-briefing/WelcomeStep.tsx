"use client";

import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { typography, gradientText } from "@/design-system";

export function WelcomeStep({ firstName }: { firstName: string }) {
  return (
    <div className="flex flex-col items-center text-center px-4">
      <motion.h1
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          fontSize: typography.fontSize.display,
          fontWeight: typography.fontWeight.extraBold,
          letterSpacing: typography.letterSpacing.display,
          lineHeight: typography.lineHeight.display,
          background: gradientText.premium,
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          color: "transparent",
        }}
      >
        Good morning, {firstName} 👋
      </motion.h1>
      <p className="text-[#94A3B8] mt-4" style={{ fontSize: typography.fontSize.lg }}>
        Let&apos;s prepare today&apos;s trading session.
      </p>
      <div
        className="flex items-center gap-2 mt-6 px-4 py-2 rounded-full"
        style={{ background: "rgba(148,163,184,0.06)", border: "1px solid rgba(148,163,184,0.12)" }}
      >
        <Clock className="w-4 h-4 text-[#298DFF]" />
        <span className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.sm }}>
          Less than one minute
        </span>
      </div>
    </div>
  );
}
