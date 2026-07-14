import { typography } from "@/design-system";
import { CARD, SectionLabel, QUALITY_COLOR } from "./shared";
import type { MarketQuality, QualityRating } from "@/lib/edge-pulse/copy";

const RATING_STARS: Record<QualityRating, number> = { Excellent: 5, Good: 4, Moderate: 3, Weak: 2, Unavailable: 0 };

function Stars({ rating }: { rating: QualityRating }) {
  const filled = RATING_STARS[rating];
  const color = QUALITY_COLOR[rating];
  if (rating === "Unavailable") {
    return (
      <span className="text-[#64748B]" style={{ fontSize: typography.fontSize.sm }}>
        Unavailable
      </span>
    );
  }
  return (
    <span style={{ color, fontSize: typography.fontSize.base, letterSpacing: "0.05em" }}>
      {"★".repeat(filled)}
      <span style={{ opacity: 0.25 }}>{"★".repeat(5 - filled)}</span>
    </span>
  );
}

function QualityRow({ label, rating, first }: { label: string; rating: QualityRating; first?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5" style={{ borderTop: first ? "none" : "1px solid rgba(148,163,184,0.08)" }}>
      <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.sm }}>
        {label}
      </p>
      <Stars rating={rating} />
    </div>
  );
}

// Section 9 — MARKET QUALITY. Never "Conviction" — ratings map straight
// from already-computed enums (marketQuality is built in copy.ts); an
// unresolved input reads "Unavailable", never a fabricated low score.
export function MarketQualitySection({ marketQuality }: { marketQuality: MarketQuality }) {
  return (
    <div className="rounded-2xl p-6" style={CARD}>
      <SectionLabel>Market Quality</SectionLabel>
      <div>
        <QualityRow label="Trend Quality" rating={marketQuality.trendQuality} first />
        <QualityRow label="Liquidity Quality" rating={marketQuality.liquidityQuality} />
        <QualityRow label="Execution Conditions" rating={marketQuality.executionConditions} />
        <QualityRow label="Volatility" rating={marketQuality.volatility} />
        <QualityRow label="Structure Alignment" rating={marketQuality.structureAlignment} />
      </div>
    </div>
  );
}
