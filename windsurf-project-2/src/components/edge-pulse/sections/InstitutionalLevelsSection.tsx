import { typography } from "@/design-system";
import { CARD, SectionLabel, formatPrice, formatSignedPercent } from "./shared";
import type { InstitutionalLevelsResult } from "@/lib/edge-pulse/engines/institutionalLevelsEngine";

// Section 5 — KEY INSTITUTIONAL LEVELS. Already sorted nearest-first by
// institutionalLevelsEngine.ts — this component only renders the list, it
// never re-sorts or filters.
export function InstitutionalLevelsSection({ institutionalLevels }: { institutionalLevels: InstitutionalLevelsResult }) {
  if (institutionalLevels.levels.length === 0) {
    return (
      <div className="rounded-2xl p-6" style={CARD}>
        <SectionLabel>Key Institutional Levels</SectionLabel>
        <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.sm }}>
          No institutional levels available for this instrument.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-6" style={CARD}>
      <SectionLabel>Key Institutional Levels</SectionLabel>
      <div>
        {institutionalLevels.levels.map((level, i) => (
          <div key={`${level.label}-${i}`} className="flex items-center justify-between py-2.5" style={{ borderTop: i === 0 ? "none" : "1px solid rgba(148,163,184,0.08)" }}>
            <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.sm }}>
              {level.label}
            </p>
            <div className="flex items-center gap-3">
              <p className="text-[#F8FAFC] font-semibold tabular-nums" style={{ fontSize: typography.fontSize.sm }}>
                {formatPrice(level.price)}
              </p>
              <p className="text-[#64748B] tabular-nums w-16 text-right" style={{ fontSize: typography.fontSize.xs }}>
                {formatSignedPercent(level.distancePercent)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
