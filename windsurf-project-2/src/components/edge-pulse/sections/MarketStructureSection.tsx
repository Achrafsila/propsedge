import { typography } from "@/design-system";
import { CARD, SectionLabel, formatPrice } from "./shared";
import type { TimeframeStructureRow, StructureResult } from "@/lib/edge-pulse/engines/structureEngine";
import {
  classifyStructureCondition,
  mostRecentStructuralEvent,
  type StructureCondition,
  type StructureInterpretationResult,
} from "@/lib/edge-pulse/engines/structureInterpretationEngine";

// Sprint 2 / Phase 4 — trader-facing labels for the calibrated
// classification, never a raw enum name. `null` (a clean, resolved
// bullish/bearish sequence with no open reversal attempt/correction/
// compression/rotation) is handled separately below, since it needs the
// row's own direction to phrase correctly.
const CONDITION_DISPLAY_LABEL: Record<StructureCondition, string> = {
  mixed_bullish_pressure: "Bullish Pressure",
  mixed_bearish_pressure: "Bearish Pressure",
  balanced_range: "Balanced Range",
  compression_before_break: "Range Compression",
  two_sided_rotation: "Two-Sided Rotation",
  bullish_reversal_attempt: "Bullish Recovery Attempt",
  bearish_reversal_attempt: "Reversal Warning",
  corrective_bullish_move: "Corrective Rally",
  corrective_bearish_move: "Corrective Decline",
  conflicting_timeframes: "Conflicting Timeframes",
  unresolved: "Structure Unresolved",
};

const CONDITION_COLOR: Record<StructureCondition, string> = {
  mixed_bullish_pressure: "#10B981",
  mixed_bearish_pressure: "#EF4444",
  balanced_range: "#F59E0B",
  compression_before_break: "#F59E0B",
  two_sided_rotation: "#F59E0B",
  bullish_reversal_attempt: "#10B981",
  bearish_reversal_attempt: "#EF4444",
  corrective_bullish_move: "#10B981",
  corrective_bearish_move: "#EF4444",
  conflicting_timeframes: "#F59E0B",
  unresolved: "#64748B",
};

// Sprint 2 / Phase 5 M15 safety gate: "Trend Continuation" may only display
// when sequenceTrend is bullish/bearish (guaranteed here — classifyStructureCondition
// only returns null for a clean bull/bear sequence), a SAME-DIRECTION BOS is
// the most recent structural event (no newer opposite CHoCH — mostRecentStructuralEvent
// already picks whichever of BOS/CHoCH is more recent), and no open reversal
// attempt/correction/compression/rotation is active (all already excluded by
// classifyStructureCondition returning null). Anything short of that downgrades:
// a stale/mismatched-direction BOS reads as "Structure Unresolved" (the two
// calibrated reads — sequence vs. break confirmation — disagree); no event at
// all, or a CHoCH with an already-confirmed reversal, reads as a plain
// directional trend label, never an active "continuation" claim.
function conditionLabel(row: TimeframeStructureRow): { label: string; color: string } {
  if (row.quality === "unavailable") return { label: "Unavailable", color: "#64748B" };
  const condition = classifyStructureCondition(row);
  if (condition !== null) return { label: CONDITION_DISPLAY_LABEL[condition], color: CONDITION_COLOR[condition] };

  const directionalLabel = { label: row.sequenceTrend === "bullish" ? "Bullish Trend" : "Bearish Trend", color: row.sequenceTrend === "bullish" ? "#10B981" : "#EF4444" };
  const mostRecent = mostRecentStructuralEvent(row);
  if (mostRecent === null) return directionalLabel;
  if (mostRecent.type === "BOS") {
    if (mostRecent.direction === row.sequenceTrend) {
      return { label: "Trend Continuation", color: row.sequenceTrend === "bullish" ? "#10B981" : "#EF4444" };
    }
    return { label: CONDITION_DISPLAY_LABEL.unresolved, color: CONDITION_COLOR.unresolved };
  }
  return directionalLabel; // CHoCH with an already-confirmed reversal — a fresh directional read, not "continuation"
}

function phaseLabel(row: TimeframeStructureRow): string {
  if (row.compression) return "Compression";
  if (row.expansion) return "Expansion";
  if (row.rotation) return "Rotation";
  if (row.correction) return "Correction";
  if (row.bias.includes("Pullback")) return "Pullback";
  return "—";
}

function structuralEventLabel(row: TimeframeStructureRow): string {
  const event = mostRecentStructuralEvent(row);
  if (!event) return "None";
  const kind = event.type === "BOS" ? "BOS" : "CHoCH";
  const direction = event.direction === "bullish" ? "Bullish" : "Bearish";
  return `${kind} ${direction} @ ${formatPrice(event.price)}`;
}

// Section 2 — MARKET STRUCTURE. One row per timeframe: the CALIBRATED
// structure condition (never a raw enum, never an overconfident trend
// label for a genuinely mixed sequence), phase, latest structural event,
// reversal state, and the latest confirmed swing high/low. The
// "Timeframes Disagree" badge reads the CALIBRATED alignment (Sprint 2 /
// Phase 5) — never the legacy bias-camp `structure.disagreement` flag,
// which could contradict the hero's own alignment sentence.
export function MarketStructureSection({
  structure,
  structureInterpretation,
}: {
  structure: StructureResult;
  structureInterpretation: StructureInterpretationResult;
}) {
  return (
    <div className="rounded-2xl p-6" style={CARD}>
      <div className="flex items-center justify-between mb-4">
        <SectionLabel>Market Structure</SectionLabel>
        {structureInterpretation.alignment === "conflicting" && (
          <span
            className="px-2.5 py-1 rounded-full font-semibold"
            style={{ fontSize: typography.fontSize.xs, color: "#F59E0B", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)" }}
          >
            Timeframes Disagree
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {structure.rows.map((row) => {
          const { label, color } = conditionLabel(row);
          const swingHigh = row.latestHH ?? row.latestLH;
          const swingLow = row.latestHL ?? row.latestLL;
          return (
            <div key={row.timeframe} className="rounded-xl p-4" style={{ background: "rgba(148,163,184,0.04)", border: `1px solid ${color}33` }}>
              <p className="text-[#64748B] uppercase mb-1.5" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
                {row.label}
              </p>
              <p className="font-bold mb-3" style={{ fontSize: typography.fontSize.lg, color }}>
                {label}
              </p>
              {row.quality === "unavailable" ? (
                <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.xs }}>
                  Unavailable
                </p>
              ) : (
                <div className="space-y-1">
                  <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.xs }}>
                    Phase <span className="text-[#F8FAFC] font-semibold">{phaseLabel(row)}</span>
                  </p>
                  <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.xs }}>
                    Latest Event <span className="text-[#F8FAFC] font-semibold">{structuralEventLabel(row)}</span>
                  </p>
                  <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.xs }}>
                    Reversal <span className="text-[#F8FAFC] font-semibold">{row.reversal ? "Confirmed" : "Not confirmed"}</span>
                  </p>
                  {swingHigh !== null && (
                    <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.xs }}>
                      Latest Swing High <span className="text-[#F8FAFC] font-semibold tabular-nums">{formatPrice(swingHigh)}</span>
                    </p>
                  )}
                  {swingLow !== null && (
                    <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.xs }}>
                      Latest Swing Low <span className="text-[#F8FAFC] font-semibold tabular-nums">{formatPrice(swingLow)}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
