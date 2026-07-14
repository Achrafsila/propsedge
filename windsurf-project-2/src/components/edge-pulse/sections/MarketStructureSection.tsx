import { typography } from "@/design-system";
import { CARD, SectionLabel, formatPrice, STRUCTURE_COLOR_HEX } from "./shared";
import type { StructureResult } from "@/lib/edge-pulse/engines/structureEngine";

// Section 2 — MARKET STRUCTURE. One row per timeframe: bias, color, latest
// HH/HL or LH/LL. No long text — disagreement across timeframes must read
// instantly from the colors alone.
export function MarketStructureSection({ structure }: { structure: StructureResult }) {
  return (
    <div className="rounded-2xl p-6" style={CARD}>
      <div className="flex items-center justify-between mb-4">
        <SectionLabel>Market Structure</SectionLabel>
        {structure.disagreement && (
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
          const color = STRUCTURE_COLOR_HEX[row.color];
          const showHH = row.latestHH !== null;
          const showHL = row.latestHL !== null;
          const showLH = row.latestLH !== null;
          const showLL = row.latestLL !== null;
          return (
            <div key={row.timeframe} className="rounded-xl p-4" style={{ background: "rgba(148,163,184,0.04)", border: `1px solid ${color}33` }}>
              <p className="text-[#64748B] uppercase mb-1.5" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
                {row.label}
              </p>
              <p className="font-bold mb-3" style={{ fontSize: typography.fontSize.lg, color }}>
                {row.bias}
              </p>
              <div className="space-y-1">
                {showHH && (
                  <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.xs }}>
                    Latest HH <span className="text-[#F8FAFC] font-semibold tabular-nums">{formatPrice(row.latestHH!)}</span>
                  </p>
                )}
                {showHL && (
                  <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.xs }}>
                    Latest HL <span className="text-[#F8FAFC] font-semibold tabular-nums">{formatPrice(row.latestHL!)}</span>
                  </p>
                )}
                {showLH && (
                  <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.xs }}>
                    Latest LH <span className="text-[#F8FAFC] font-semibold tabular-nums">{formatPrice(row.latestLH!)}</span>
                  </p>
                )}
                {showLL && (
                  <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.xs }}>
                    Latest LL <span className="text-[#F8FAFC] font-semibold tabular-nums">{formatPrice(row.latestLL!)}</span>
                  </p>
                )}
                {!showHH && !showHL && !showLH && !showLL && (
                  <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.xs }}>
                    Unavailable
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
