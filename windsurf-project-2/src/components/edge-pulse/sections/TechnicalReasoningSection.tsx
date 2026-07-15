"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { typography } from "@/design-system";
import { CARD, formatPrice } from "./shared";
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

function CalibratedFactsCard({ facts }: { facts: EdgePulseBrief["technicalReasoning"]["calibratedFacts"][number] }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "rgba(148,163,184,0.04)", border: "1px solid rgba(148,163,184,0.08)" }}>
      <p className="text-[#64748B] uppercase mb-1.5" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
        {facts.label}
      </p>
      <div className="space-y-1">
        <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.xs }}>
          Sequence Trend <span className="text-[#F8FAFC] font-semibold capitalize">{facts.sequenceTrend}</span>
        </p>
        <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.xs }}>
          Phase <span className="text-[#F8FAFC] font-semibold">{facts.phase}</span>
        </p>
        <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.xs }}>
          Latest Event <span className="text-[#F8FAFC] font-semibold">{facts.latestEvent}</span>
        </p>
        <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.xs }}>
          Reversal <span className="text-[#F8FAFC] font-semibold">{facts.reversal ? "Confirmed" : "Not confirmed"}</span>
        </p>
        {facts.latestSwingHigh !== null && (
          <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.xs }}>
            Latest Swing High <span className="text-[#F8FAFC] font-semibold tabular-nums">{formatPrice(facts.latestSwingHigh)}</span>
          </p>
        )}
        {facts.latestSwingLow !== null && (
          <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.xs }}>
            Latest Swing Low <span className="text-[#F8FAFC] font-semibold tabular-nums">{formatPrice(facts.latestSwingLow)}</span>
          </p>
        )}
      </div>
    </div>
  );
}

// Section 11 — TECHNICAL REASONING. Collapsed by default. Sprint 2 / Phase
// 5: the default (outer-expanded) view shows only CALIBRATED per-timeframe
// facts — sequence trend, phase, latest BOS/CHoCH/false break, reversal
// state, latest swing high/low — the same fields every other section's
// copy is built from. The old MarketPulse/regime/phase evidence dump is
// demoted to a second, independently collapsed "Legacy diagnostics"
// sub-block that stays closed even when the outer section is opened.
export function TechnicalReasoningSection({ technicalReasoning }: { technicalReasoning: EdgePulseBrief["technicalReasoning"] }) {
  const [expanded, setExpanded] = useState(false);
  const [legacyExpanded, setLegacyExpanded] = useState(false);
  const { calibratedFacts, legacyDiagnostics } = technicalReasoning;
  const hasLegacyEvidence =
    legacyDiagnostics.marketPulseEvidence.length > 0 || legacyDiagnostics.regimeEvidence.length > 0 || legacyDiagnostics.phaseEvidence.length > 0;

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {calibratedFacts.map((facts) => (
              <CalibratedFactsCard key={facts.timeframe} facts={facts} />
            ))}
          </div>

          <button
            type="button"
            onClick={() => setLegacyExpanded((v) => !v)}
            className="flex items-center gap-2 w-full pt-3"
            style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }}
          >
            <ChevronDown className="w-3.5 h-3.5 transition-transform text-[#64748B]" style={{ transform: legacyExpanded ? "rotate(180deg)" : "none" }} />
            <span className="text-[#64748B] uppercase" style={{ fontSize: "0.625rem", letterSpacing: typography.letterSpacing.label }}>
              Legacy diagnostics
            </span>
          </button>

          {legacyExpanded && (
            <div className="mt-3">
              {hasLegacyEvidence ? (
                <>
                  <EvidenceGroup title="Market Pulse Evidence" evidence={legacyDiagnostics.marketPulseEvidence.map((e) => e.message)} />
                  <EvidenceGroup title="Swing / Regime Detections" evidence={legacyDiagnostics.regimeEvidence} />
                  <EvidenceGroup title="Phase / Break Confirmations" evidence={legacyDiagnostics.phaseEvidence} />
                </>
              ) : (
                <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.sm }}>
                  No legacy diagnostics available for this instrument.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
