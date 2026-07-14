"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { typography } from "@/design-system";
import { CARD } from "./shared";
import type { EdgePulseBrief } from "@/lib/edge-pulse/composeEdgePulse";

function EvidenceGroup({ title, evidence }: { title: string; evidence: string[] }) {
  if (evidence.length === 0) return null;
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-[#64748B] uppercase mb-2" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
        {title}
      </p>
      <ul className="space-y-1.5">
        {evidence.map((line, i) => (
          <li key={i} className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.xs, lineHeight: typography.lineHeight.normal }}>
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Section 11 — TECHNICAL REASONING. Collapsed by default, never expanded
// automatically — the spec's own rule ("Never display this by default").
// Surfaces the raw engine evidence (confirmed swings, break confirmations,
// fractal detections) that every other section's copy was built from, for
// a trader who wants to inspect it.
export function TechnicalReasoningSection({ technicalReasoning }: { technicalReasoning: EdgePulseBrief["technicalReasoning"] }) {
  const [expanded, setExpanded] = useState(false);
  const hasEvidence =
    technicalReasoning.marketPulseEvidence.length > 0 || technicalReasoning.regimeEvidence.length > 0 || technicalReasoning.phaseEvidence.length > 0;

  return (
    <div className="rounded-2xl p-6" style={CARD}>
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex items-center gap-2 w-full">
        <ChevronDown className="w-4 h-4 transition-transform text-[#298DFF]" style={{ transform: expanded ? "rotate(180deg)" : "none" }} />
        <span className="text-[#64748B] uppercase" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
          View Technical Reasoning
        </span>
      </button>

      {expanded && (
        <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }}>
          {hasEvidence ? (
            <>
              <EvidenceGroup title="Market Pulse Evidence" evidence={technicalReasoning.marketPulseEvidence.map((e) => e.message)} />
              <EvidenceGroup title="Swing / Regime Detections" evidence={technicalReasoning.regimeEvidence} />
              <EvidenceGroup title="Phase / Break Confirmations" evidence={technicalReasoning.phaseEvidence} />
            </>
          ) : (
            <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.sm }}>
              No technical reasoning available for this instrument.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
