import { AlertTriangle } from "lucide-react";
import { typography } from "@/design-system";
import { CARD, SectionLabel } from "./shared";

// Section 10 — INSTITUTIONAL WARNINGS. Max 3, already capped by
// copy.ts's buildWarnings (fixed-priority rule bank, never padded).
export function InstitutionalWarningsSection({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;

  return (
    <div className="rounded-2xl p-6" style={{ ...CARD, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)" }}>
      <SectionLabel>Institutional Warnings</SectionLabel>
      <ul className="space-y-2.5">
        {warnings.map((line, i) => (
          <li key={i} className="flex items-start gap-2" style={{ fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.normal }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#EF4444" }} />
            <span className="text-[#F8FAFC]">{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
