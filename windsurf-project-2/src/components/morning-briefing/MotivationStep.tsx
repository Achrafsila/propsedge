"use client";

import { Sparkles } from "lucide-react";
import { glassmorphism, borderRadius, typography, gradientText } from "@/design-system";

export function MotivationStep({ motivation }: { motivation: string }) {
  return (
    <div className="w-full flex flex-col items-center text-center">
      <Sparkles className="w-8 h-8 text-[#F59E0B] mb-5" />
      <div
        className="rounded-xl p-6 max-w-lg"
        style={{
          background: glassmorphism.card.background,
          backdropFilter: glassmorphism.card.backdropBlur,
          border: "1px solid rgba(148,163,184,0.08)",
          borderRadius: borderRadius.xl,
        }}
      >
        <p
          className="font-semibold italic"
          style={{
            fontSize: typography.fontSize.lg,
            lineHeight: typography.lineHeight.relaxed,
            background: gradientText.premium,
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            color: "transparent",
          }}
        >
          &ldquo;{motivation}&rdquo;
        </p>
      </div>
    </div>
  );
}
