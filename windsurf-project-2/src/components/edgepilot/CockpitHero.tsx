"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { glassmorphism, borderRadius, typography, gradientText, gradientHero } from "@/design-system";
import { AccountBriefing, RecommendedRisk } from "@/lib/analytics/aiCoach";
import { AccountDecision, Decision } from "@/lib/analytics/decisionEngine";
import { DailyAccountability } from "@/lib/analytics/accountabilityEngine";
import { DailyContract } from "@/types";
import { AccountHealthState } from "@/lib/analytics/buddyAdvice";
import { EdgePilotAvatar } from "./EdgePilotAvatar";

// ============================================================
// PropEdge — Cockpit Hero (EdgePilot V3)
// ============================================================
// Three-zone hero, architected so the left column can later hold a real
// EdgePilot character asset with zero layout change: Avatar | Quote +
// Pilot's Advice | Decision. Pure presentation — every value here is
// already computed by aiCoach.ts/decisionEngine.ts; this component only
// lays it out and picks copy via buddyAdvice.ts's generators.

export interface PrimaryEvaluation {
  briefing: AccountBriefing;
  contract: DailyContract | null;
  decision: AccountDecision;
  accountability: DailyAccountability;
}

const DECISION_COLOR: Record<Decision, string> = {
  TRADE: "#10B981",
  TRADE_REDUCED: "#F59E0B",
  OBSERVE_ONLY: "#298DFF",
  STOP: "#EF4444",
};

const DECISION_LABEL: Record<Decision, string> = {
  TRADE: "TRADE",
  TRADE_REDUCED: "TRADE REDUCED",
  OBSERVE_ONLY: "OBSERVE",
  STOP: "STOP",
};

function fmt$(v: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

function todayLabel(): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(new Date());
}

// Presentation-only: the Next Best Action string from aiCoach.ts is
// untouched — this just trims the displayed copy to its first sentence so
// the cockpit reads as one direct instruction, never a paragraph. The full
// text still lives in the engine output (and is shown verbatim inside the
// Account Command Center's detailed view).
function firstSentence(text: string): string {
  const match = text.match(/^[^.!?]*[.!?]/);
  return match ? match[0].trim() : text;
}

export function CockpitHero({
  primaryEvaluation,
  recommendedRisk,
  nextBestAction,
  buddyAdvice,
  heroQuote,
  healthState,
}: {
  primaryEvaluation: PrimaryEvaluation | null;
  recommendedRisk: RecommendedRisk;
  nextBestAction: string;
  buddyAdvice: string;
  heroQuote: string;
  healthState: AccountHealthState | null;
}) {
  const decision = primaryEvaluation?.decision.decision ?? null;
  const decisionColor = decision ? DECISION_COLOR[decision] : "#298DFF";

  return (
    <div className="relative -mx-6 -mt-6 px-6 pt-12 pb-8 overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: gradientHero.radial }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative"
      >
        {/* ── Wordmark + date ── */}
        <div className="flex items-baseline justify-between gap-3 flex-wrap mb-8">
          <h1
            style={{
              fontSize: typography.fontSize.display,
              fontWeight: 800,
              letterSpacing: typography.letterSpacing.display,
              lineHeight: typography.lineHeight.display,
              background: gradientText.premium,
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            EdgePilot
          </h1>
          <p className="text-[#64748B]" style={{ fontSize: typography.fontSize.sm }}>
            {todayLabel()}
          </p>
        </div>

        {/* ── Avatar | Quote + Pilot's Advice | Decision ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)_auto] gap-8 items-stretch">
          {/* Avatar column — reserved for the future EdgePilot character asset */}
          <div className="flex lg:flex-col items-center justify-center">
            <EdgePilotAvatar state={healthState?.avatarState ?? "healthy"} size={132} />
          </div>

          {/* Quote + Pilot's Advice */}
          <div className="flex flex-col justify-center gap-5 min-w-0">
            <p
              className="text-[#CBD5E1] italic"
              style={{ fontSize: typography.fontSize["2xl"], lineHeight: typography.lineHeight.relaxed }}
            >
              &ldquo;{heroQuote}&rdquo;
            </p>
            <div
              className="rounded-2xl p-6"
              style={{ background: glassmorphism.card.background, backdropFilter: glassmorphism.card.backdropBlur, border: "1px solid rgba(148,163,184,0.08)", borderRadius: borderRadius["2xl"] }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-[#298DFF]" />
                <span className="text-[#94A3B8] uppercase" style={{ fontSize: typography.fontSize.xs, letterSpacing: typography.letterSpacing.label }}>
                  Pilot&apos;s Advice
                </span>
              </div>
              <p className="text-[#F8FAFC] font-medium" style={{ fontSize: typography.fontSize.lg, lineHeight: typography.lineHeight.relaxed }}>
                {buddyAdvice}
              </p>
            </div>
          </div>

          {/* Decision — neutral glass panel, colour kept on the badge + a subtle border/glow */}
          <div
            className="rounded-2xl p-7 flex flex-col justify-center lg:min-w-[340px]"
            style={{
              background: glassmorphism.card.background,
              backdropFilter: glassmorphism.card.backdropBlur,
              border: `1px solid ${decisionColor}33`,
              borderRadius: borderRadius["2xl"],
              boxShadow: `0 0 28px ${decisionColor}1F`,
            }}
          >
            {decision === null ? (
              <p className="text-[#64748B] text-sm">No active accounts to evaluate.</p>
            ) : (
              <>
                <motion.div
                  className="inline-flex self-start items-center px-6 py-3 rounded-2xl font-extrabold tracking-wide"
                  style={{ background: `${decisionColor}1F`, border: `1px solid ${decisionColor}55`, color: decisionColor, fontSize: typography.fontSize.kpi }}
                  animate={decision === "STOP" ? { scale: [1, 1.05, 1] } : { scale: 1 }}
                  transition={decision === "STOP" ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : undefined}
                >
                  {DECISION_LABEL[decision]}
                </motion.div>
                <p className="text-[#94A3B8] mt-3 mb-6" style={{ fontSize: typography.fontSize.sm }}>
                  {primaryEvaluation ? `${primaryEvaluation.briefing.account.name} — ${primaryEvaluation.briefing.modeLabel} Mode` : ""}
                </p>

                <div className="space-y-5">
                  <div>
                    <p className="text-[#64748B] uppercase mb-1" style={{ fontSize: typography.fontSize.xs, letterSpacing: typography.letterSpacing.label }}>
                      Recommended Risk
                    </p>
                    <p className="font-extrabold tabular-nums text-[#F8FAFC]" style={{ fontSize: typography.fontSize["3xl"] }}>
                      {recommendedRisk.amount !== null ? fmt$(recommendedRisk.amount) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#64748B] uppercase mb-1" style={{ fontSize: typography.fontSize.xs, letterSpacing: typography.letterSpacing.label }}>
                      Next Best Action
                    </p>
                    <p className="text-[#CBD5E1]" style={{ fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.normal }}>
                      {firstSentence(nextBestAction)}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
