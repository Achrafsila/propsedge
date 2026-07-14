import { typography } from "@/design-system";
import { CARD, SectionLabel } from "./shared";

// Section 7 — MARKET CONTEXT. Max 5 deterministic institutional-language
// bullets, already capped by copy.ts's buildMarketContext — this
// component never truncates or reorders, it only renders.
export function MarketContextSection({ marketContext }: { marketContext: string[] }) {
  if (marketContext.length === 0) {
    return (
      <div className="rounded-2xl p-6" style={CARD}>
        <SectionLabel>Market Context</SectionLabel>
        <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.sm }}>
          No notable context to report right now.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-6" style={CARD}>
      <SectionLabel>Market Context</SectionLabel>
      <ul className="space-y-2.5">
        {marketContext.map((line, i) => (
          <li key={i} className="text-[#CBD5E1] flex items-start gap-2" style={{ fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.normal }}>
            <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ background: "#298DFF" }} />
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
