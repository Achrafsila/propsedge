import { typography } from "@/design-system";
import { CARD, SectionLabel } from "./shared";

// Section 8 — SESSION PLAYBOOK. Conditions only — never entries, exits, or
// trade instructions. Max 4, already capped by copy.ts's buildSessionPlaybook.
export function SessionPlaybookSection({ sessionPlaybook }: { sessionPlaybook: string[] }) {
  if (sessionPlaybook.length === 0) {
    return (
      <div className="rounded-2xl p-6" style={CARD}>
        <SectionLabel>Session Playbook</SectionLabel>
        <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.sm }}>
          No notable conditions to monitor right now.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-6" style={CARD}>
      <SectionLabel>Session Playbook</SectionLabel>
      <ul className="space-y-2.5">
        {sessionPlaybook.map((line, i) => (
          <li key={i} className="text-[#CBD5E1] flex items-start gap-2" style={{ fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.normal }}>
            <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ background: "#F59E0B" }} />
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
