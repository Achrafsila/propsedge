import { glassmorphism, borderRadius, typography } from "@/design-system";

// ============================================================
// Edge Pulse sections — shared presentation constants
// ============================================================
// Every section component uses ONLY these + the design-system tokens
// directly — no ad-hoc colors/spacing. Matches the CARD convention already
// established in EdgePulseView.tsx / DetailedAnalysis.tsx.

export const CARD = {
  background: glassmorphism.card.background,
  backdropFilter: glassmorphism.card.backdropBlur,
  border: "1px solid rgba(148,163,184,0.08)",
  borderRadius: borderRadius["2xl"],
};

export const LABEL_STYLE = {
  fontSize: "0.625rem",
  letterSpacing: typography.letterSpacing.label,
} as const;

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[#64748B] uppercase mb-3" style={LABEL_STYLE}>
      {children}
    </p>
  );
}

export function formatPrice(price: number): string {
  return price.toLocaleString(undefined, { maximumFractionDigits: 5 });
}

export function formatSignedPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export const STATE_COLOR: Record<string, string> = {
  fresh: "#10B981",
  tested: "#298DFF",
  mitigated: "#F59E0B",
  broken: "#64748B",
};

export const QUALITY_COLOR: Record<string, string> = {
  Excellent: "#10B981",
  Good: "#298DFF",
  Moderate: "#F59E0B",
  Weak: "#EF4444",
  Unavailable: "#64748B",
};

export const STRUCTURE_COLOR_HEX: Record<string, string> = {
  green: "#10B981",
  red: "#EF4444",
  yellow: "#F59E0B",
  gray: "#64748B",
};
