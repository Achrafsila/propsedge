import { typography, gradientText } from "@/design-system";
import { CARD, formatPrice } from "./shared";
import { OVERALL_INTERPRETATION_LABEL, type OverallStructureInterpretation } from "@/lib/edge-pulse/engines/structureInterpretationEngine";

// Sprint 2 / Phase 4 — the CALIBRATED headline. Colors keyed by the new
// OverallStructureInterpretation (multi-timeframe sequence/BOS/CHoCH read),
// never the legacy single-timeframe MarketPulse regime/conviction label.
const OVERALL_COLOR: Record<OverallStructureInterpretation, string> = {
  strongly_bullish: "#10B981",
  slightly_bullish: "#10B981",
  neutral: "#298DFF",
  slightly_bearish: "#EF4444",
  strongly_bearish: "#EF4444",
  unresolved: "#64748B",
};

// Section 1 — MARKET OUTLOOK. Very large hero: symbol, the calibrated
// overall structure interpretation as the headline, exactly 3 narrative
// sentences, one session-posture line. Every value is read straight from
// EdgePulseBrief (composeEdgePulse.ts) — no recomputation here. Never
// shows the legacy overallBias (MarketPulse-derived) as the primary
// headline — that field is kept on the payload only for backward
// compatibility with any other consumer.
export function MarketOutlookHero({
  symbol,
  currentPrice,
  overall,
  narrative,
  sessionPosture,
}: {
  symbol: string;
  currentPrice: number | null;
  overall: OverallStructureInterpretation;
  narrative: string[];
  sessionPosture: string | null;
}) {
  const color = OVERALL_COLOR[overall];
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
        {OVERALL_INTERPRETATION_LABEL[overall]}
      </p>

      <div className="space-y-1.5 mb-5">
        {narrative.map((sentence, i) => (
          <p key={i} className="text-[#CBD5E1]" style={{ fontSize: typography.fontSize.lg, lineHeight: typography.lineHeight.relaxed }}>
            {sentence}
          </p>
        ))}
      </div>

      {sessionPosture && (
        <div className="pt-5" style={{ borderTop: "1px solid rgba(148,163,184,0.1)" }}>
          <p className="text-[#64748B] uppercase mb-1.5" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
            Session Posture
          </p>
          <p className="text-[#F8FAFC] font-medium" style={{ fontSize: typography.fontSize.base }}>
            {sessionPosture}
          </p>
        </div>
      )}
    </div>
  );
}
