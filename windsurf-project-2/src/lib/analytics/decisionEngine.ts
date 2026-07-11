import { DailyContract } from "@/types";
import { AccountBriefing, BriefingMode } from "./aiCoach";
import { TraderDiscipline } from "./traderDiscipline";
import { Deviation, DeviationType } from "./accountabilityEngine";

// ============================================================
// PropEdge — Decision Engine (EdgePilot V2)
// ============================================================
// Issues the one thing every other engine in this rebuild feeds into: a
// single per-account answer to "what should I do right now?" Pure,
// deterministic priority ladder — same "first applicable wins" convention
// aiCoach.ts's selectMainPriority already uses — over inputs every other
// engine here already computed (BriefingMode, deviations, Loss Discipline
// Score). Never calculates risk/behaviour itself, only interprets what's
// already been calculated elsewhere (see the "Future Ready" note in the
// spec: Decision Engine calculates/enforces, an LLM layer may later only
// explain this output, never replace it).

export type Decision = "TRADE" | "TRADE_REDUCED" | "OBSERVE_ONLY" | "STOP";

export interface AccountDecision {
  decision: Decision;
  decisionLabel: string;
  mode: BriefingMode;
  modeLabel: string;
  hardRules: string[];
  blockers: string[];
  unlockConditions: string[];
}

const DECISION_LABEL: Record<Decision, string> = {
  TRADE: "Trade",
  TRADE_REDUCED: "Trade Reduced",
  OBSERVE_ONLY: "Observe Only",
  STOP: "Stop",
};

// Same 50/65 borderline band aiCoach.ts's classifyBriefingMode uses for its
// own discipline-based nudges (BORDERLINE_DISCIPLINE_FLOOR/CEILING) —
// duplicated rather than imported, matching this folder's per-file
// self-contained convention.
const BORDERLINE_DISCIPLINE_FLOOR = 50;
const BORDERLINE_DISCIPLINE_CEILING = 65;

const REDUCED_TRADE_MODES: BriefingMode[] = ["protection", "recovery", "payout_protection"];

// Maps a couple of deviation types to the shorter, plainer phrasing the
// spec's own Decision Engine example uses ("Sizing instability", "Recent
// revenge pattern") instead of the full violation label shown elsewhere.
const BLOCKER_LABEL_OVERRIDE: Partial<Record<DeviationType, string>> = {
  position_size_escalation: "Sizing instability",
  revenge_trading_sequence: "Recent revenge pattern",
};

function fmt$(v: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

// Same "{score}/100" parse duplicated in accountabilityEngine.ts — kept
// local rather than imported so this file has no dependency on that one's
// internals, only its exported Deviation type.
function parseLossDisciplineScore(discipline: TraderDiscipline): number | null {
  const match = discipline.lossDisciplineScore.metricLabel.match(/^(\d+)\/100$/);
  return match ? Number(match[1]) : null;
}

function buildHardRules(contract: DailyContract | null): string[] {
  if (!contract) return [];
  const rules: string[] = [];
  if (contract.maxRiskPerTrade != null) rules.push(`Maximum risk ${fmt$(contract.maxRiskPerTrade)}`);
  if (contract.maxTrades != null) rules.push(`Maximum ${contract.maxTrades} trade${contract.maxTrades === 1 ? "" : "s"}`);
  if (contract.allowedInstruments.length > 0) rules.push(`${contract.allowedInstruments.join(", ")} only`);
  if (contract.allowedSessions.length > 0) rules.push(`${contract.allowedSessions.join(", ")} session only`);
  if (contract.stopAfterLosses != null) rules.push(`Stop after ${contract.stopAfterLosses} loss${contract.stopAfterLosses === 1 ? "" : "es"}`);
  return rules;
}

function buildBlockers(deviations: Deviation[], disciplineScore: number | null): string[] {
  const blockers = new Set<string>();
  if (disciplineScore !== null && disciplineScore < BORDERLINE_DISCIPLINE_FLOOR) {
    blockers.add(`Loss Discipline ${disciplineScore}`);
  }
  for (const d of deviations) {
    // Named behavioural patterns (sizing/revenge) always surface as a
    // blocker when detected, even at "medium" severity — their severity
    // band reflects statistical confidence for the compliance score, not
    // whether the pattern is worth calling out as a reason to trade less.
    const isNamedBehaviouralPattern = d.type in BLOCKER_LABEL_OVERRIDE;
    if (d.severity !== "high" && d.severity !== "critical" && !isNamedBehaviouralPattern) continue;
    blockers.add(BLOCKER_LABEL_OVERRIDE[d.type] ?? d.label);
  }
  return Array.from(blockers);
}

// Priority ladder, first applicable wins:
//   1. No committed contract today (and not already in a hard no-trading
//      mode) — the trader can't be evaluated against a plan that doesn't
//      exist, so nothing above OBSERVE_ONLY is possible.
//   2. Guardrail breach (no_trading/near_breach mode) or any CRITICAL
//      deviation today → STOP.
//   3. Any HIGH deviation, a protective/recovery/payout mode, or a Loss
//      Discipline Score below the borderline floor → TRADE_REDUCED.
//   4. Any MEDIUM deviation, or a borderline discipline score → OBSERVE_ONLY.
//   5. Otherwise → TRADE.
export function getAccountDecision(
  briefing: AccountBriefing,
  contract: DailyContract | null,
  deviations: Deviation[],
  discipline: TraderDiscipline
): AccountDecision {
  const disciplineScore = parseLossDisciplineScore(discipline);
  const hasCritical = deviations.some((d) => d.severity === "critical");
  const hasHigh = deviations.some((d) => d.severity === "high");
  const hasMedium = deviations.some((d) => d.severity === "medium");

  let decision: Decision;
  let unlockConditions: string[] = [];
  let missingContractBlocker: string[] = [];

  if (!contract && briefing.mode !== "no_trading") {
    decision = "OBSERVE_ONLY";
    unlockConditions = ["Complete Morning Briefing commitment"];
    missingContractBlocker = ["No Daily Contract committed for today"];
  } else if (briefing.mode === "no_trading" || briefing.mode === "near_breach" || hasCritical) {
    decision = "STOP";
    unlockConditions = ["Complete two disciplined sessions"];
  } else if (
    hasHigh ||
    REDUCED_TRADE_MODES.includes(briefing.mode) ||
    (disciplineScore !== null && disciplineScore < BORDERLINE_DISCIPLINE_FLOOR)
  ) {
    decision = "TRADE_REDUCED";
    unlockConditions = ["Complete two disciplined sessions"];
  } else if (
    hasMedium ||
    (disciplineScore !== null && disciplineScore >= BORDERLINE_DISCIPLINE_FLOOR && disciplineScore < BORDERLINE_DISCIPLINE_CEILING)
  ) {
    decision = "OBSERVE_ONLY";
  } else {
    decision = "TRADE";
  }

  return {
    decision,
    decisionLabel: DECISION_LABEL[decision],
    mode: briefing.mode,
    modeLabel: briefing.modeLabel,
    hardRules: buildHardRules(contract),
    blockers: [...missingContractBlocker, ...buildBlockers(deviations, disciplineScore)],
    unlockConditions,
  };
}
