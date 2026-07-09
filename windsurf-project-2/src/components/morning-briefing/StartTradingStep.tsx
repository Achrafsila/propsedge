"use client";

import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { typography, gradientText } from "@/design-system";

export function StartTradingStep({ onStart }: { onStart: () => void }) {
  return (
    <div className="w-full flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: "rgba(16,185,129,0.1)" }}>
        <Rocket className="w-8 h-8 text-[#10B981]" />
      </div>
      <h2
        className="font-extrabold mb-3"
        style={{
          fontSize: typography.fontSize["3xl"],
          background: gradientText.premium,
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          color: "transparent",
        }}
      >
        You&apos;re ready.
      </h2>
      <p className="text-[#94A3B8] mb-8" style={{ fontSize: typography.fontSize.base }}>
        Have a disciplined trading session.
      </p>
      <Button
        type="button"
        onClick={onStart}
        className="bg-gradient-to-r from-[#298DFF] to-[#1E6FE0] hover:shadow-lg hover:shadow-[rgba(41,141,255,0.3)] hover:scale-105 transition-all duration-300 text-white rounded-xl px-8 py-6 text-base pointer-events-auto"
      >
        Start Trading Session
      </Button>
    </div>
  );
}
