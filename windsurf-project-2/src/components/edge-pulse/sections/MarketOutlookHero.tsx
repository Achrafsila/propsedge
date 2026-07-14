import { typography, gradientText } from "@/design-system";
import { CARD, formatPrice } from "./shared";
import type { OverallBiasLabel } from "@/lib/edge-pulse/copy";

const BIAS_COLOR: Record<OverallBiasLabel, string> = {
  "Strongly Bullish": "#10B981",
  Bullish: "#10B981",
  Neutral: "#298DFF",
  Bearish: "#EF4444",
  "Strongly Bearish": "#EF4444",
  Transitional: "#F59E0B",
  Unclear: "#64748B",
};

// Section 1 — MARKET OUTLOOK. Very large hero: symbol, overall bias
// headline, 2-3 sentence narrative, one execution-posture line. Every
// value is read straight from EdgePulseBrief — no recomputation here.
export function MarketOutlookHero({
  symbol,
  currentPrice,
  overallBias,
  outlookNarrative,
  executionPosture,
}: {
  symbol: string;
  currentPrice: number | null;
  overallBias: OverallBiasLabel;
  outlookNarrative: string[];
  executionPosture: string | null;
}) {
  const color = BIAS_COLOR[overallBias];
  return (
    <div className="rounded-2xl p-8" style={{ ...CARD, boxShadow: `0 0 40px ${color}14` }}>
      <div className="flex items-baseline justify-between flex-wrap gap-3 mb-2">
        <h1
          style={{
            fontSize: typography.fontSize.display,
            fontWeight: 800,
            letterSpacing: typography.letterSpacing.display,
            lineHeight: typography.lineHeight.display,
            background: gradientText.premium,
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            color: "transparent",
          }}
        >
          {symbol}
        </h1>
        {currentPrice !== null && (
          <p className="text-[#94A3B8] tabular-nums" style={{ fontSize: typography.fontSize.xl }}>
            {formatPrice(currentPrice)}
          </p>
        )}
      </div>

      <p className="font-extrabold mb-5" style={{ fontSize: typography.fontSize["3xl"], color, letterSpacing: typography.letterSpacing.section }}>
        {overallBias}
      </p>

      <div className="space-y-1.5 mb-5">
        {outlookNarrative.map((sentence, i) => (
          <p key={i} className="text-[#CBD5E1]" style={{ fontSize: typography.fontSize.lg, lineHeight: typography.lineHeight.relaxed }}>
            {sentence}
          </p>
        ))}
      </div>

      {executionPosture && (
        <div className="pt-5" style={{ borderTop: "1px solid rgba(148,163,184,0.1)" }}>
          <p className="text-[#64748B] uppercase mb-1.5" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
            Execution Posture
          </p>
          <p className="text-[#F8FAFC] font-medium" style={{ fontSize: typography.fontSize.base }}>
            {executionPosture}
          </p>
        </div>
      )}
    </div>
  );
}
