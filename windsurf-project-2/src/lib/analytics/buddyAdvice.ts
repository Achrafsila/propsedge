import { BriefingMode } from "./aiCoach";
import { Decision } from "./decisionEngine";
import { Deviation, DeviationType } from "./accountabilityEngine";
import { TraderDiscipline } from "./traderDiscipline";

// ============================================================
// PropEdge — Buddy Advice engine (EdgePilot V3 cockpit)
// ============================================================
// Pure, template-based copy generators for the executive cockpit — same
// convention as morningBriefing.ts's getEdgePilotInsight/getDailyMotivation:
// every function only ever reads fields the Decision/Accountability/Trader
// DNA engines already computed, picks among canned strings, never invents
// a number or generates text. No AI, no new calculation — this file is
// presentation copy only.

// ── Account Health state ─────────────────────────────────────────────────
// Single source of truth for both the Account Health executive card's
// label/color and the avatar's color, so the two can never disagree.

export type EdgePilotAvatarState = "healthy" | "recovery" | "danger" | "payout";

export interface AccountHealthState {
  label: "Recovery" | "Healthy" | "Near Payout" | "Near Breach";
  avatarState: EdgePilotAvatarState;
  color: string;
}

const HEALTH_STATE_COLOR: Record<AccountHealthState["label"], string> = {
  Healthy: "#10B981",
  Recovery: "#F59E0B",
  "Near Payout": "#298DFF",
  "Near Breach": "#EF4444",
};

// protection is folded into the Recovery bucket — both are defensive,
// reduced-size states, and the spec's cockpit only asks for 4 labels.
export function getAccountHealthState(mode: BriefingMode): AccountHealthState {
  let label: AccountHealthState["label"];
  let avatarState: EdgePilotAvatarState;
  if (mode === "near_breach" || mode === "no_trading") {
    label = "Near Breach";
    avatarState = "danger";
  } else if (mode === "payout_protection") {
    label = "Near Payout";
    avatarState = "payout";
  } else if (mode === "recovery" || mode === "protection") {
    label = "Recovery";
    avatarState = "recovery";
  } else {
    label = "Healthy";
    avatarState = "healthy";
  }
  return { label, avatarState, color: HEALTH_STATE_COLOR[label] };
}

// ── Biggest Risk ──────────────────────────────────────────────────────────
// ONE risk, never a list — maps today's Deviation types onto the 4 labels
// the spec names, picks the single highest-severity one present today.
// Falls back to portfolio-wide behavioural signals (already computed by
// traderDiscipline.ts) only when there are zero deviations today, and
// returns null rather than manufacturing a risk that isn't there.

export type BiggestRiskLabel = "Revenge Trading" | "Risk Escalation" | "Overtrading" | "Trading Outside Plan";

export interface BiggestRisk {
  label: BiggestRiskLabel;
  detail: string;
}

const RISK_LABEL_BY_DEVIATION_TYPE: Record<DeviationType, BiggestRiskLabel> = {
  revenge_trading_sequence: "Revenge Trading",
  position_size_escalation: "Risk Escalation",
  max_risk_exceeded: "Risk Escalation",
  trade_count_exceeded: "Overtrading",
  trading_after_daily_stop: "Overtrading",
  outside_allowed_session: "Trading Outside Plan",
  unauthorized_instrument: "Trading Outside Plan",
};

const SEVERITY_RANK: Record<Deviation["severity"], number> = { critical: 4, high: 3, medium: 2, low: 1 };

const RISK_DETAIL: Record<BiggestRiskLabel, (evidence: string) => string> = {
  "Revenge Trading": () =>
    "You re-entered fast and sized up right after a loss today. That pattern compounds losses instead of recovering them.",
  "Risk Escalation": (evidence) => `${evidence} Sizing or losses ran past what you committed to this morning.`,
  Overtrading: (evidence) => `${evidence} More trades than your plan rarely means a better session.`,
  "Trading Outside Plan": (evidence) => `${evidence} Staying inside your committed session and instruments is the edge itself.`,
};

function biggestRiskFromDeviations(deviations: Deviation[]): BiggestRisk | null {
  if (deviations.length === 0) return null;
  const worst = [...deviations].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])[0];
  const label = RISK_LABEL_BY_DEVIATION_TYPE[worst.type];
  return { label, detail: RISK_DETAIL[label](worst.evidence) };
}

// Portfolio-wide fallback when nothing happened today yet (e.g. before the
// first trade) — reuses traderDiscipline.ts's own classifications, never a
// new signal.
function biggestRiskFromDiscipline(discipline: TraderDiscipline): BiggestRisk | null {
  if (discipline.revengeTradingScore.value === "Poor" || discipline.revengeTradingScore.value === "High Risk") {
    return { label: "Revenge Trading", detail: "Your recent history shows fast, larger re-entries right after losses. Watch for that pattern today." };
  }
  if (discipline.positionSizeAfterLosses.value === "Increasing Risk") {
    return { label: "Risk Escalation", detail: "You've recently tended to size up after losses. Keep sizing flat if today turns red." };
  }
  return null;
}

export function getBiggestRisk(deviations: Deviation[], discipline: TraderDiscipline): BiggestRisk | null {
  return biggestRiskFromDeviations(deviations) ?? biggestRiskFromDiscipline(discipline);
}

// ── Buddy Advice ──────────────────────────────────────────────────────────
// Max 2 sentences, priority ladder — same "first applicable wins"
// convention as aiCoach.ts's selectMainPriority and decisionEngine.ts's
// getAccountDecision ladder.

export function getBuddyAdvice(decision: Decision, mode: BriefingMode, biggestRisk: BiggestRisk | null): string {
  if (decision === "STOP") {
    if (mode === "near_breach" || mode === "no_trading") {
      return "You're too close to the edge to take another trade. Protecting what's left matters more than any setup today.";
    }
    return "You've already broken today's plan. The disciplined move now is to stop, not to fix it with one more trade.";
  }

  if (mode === "payout_protection") {
    return "You're close to payout. Don't try to make more. Try to make fewer mistakes.";
  }

  if (decision === "TRADE_REDUCED" || mode === "recovery" || mode === "protection") {
    return "You already know how to make money. Today your only objective is protecting the account.";
  }

  if (biggestRisk?.label === "Overtrading") {
    return "Every unnecessary trade increases the probability of failure. Fewer, better trades win today.";
  }

  if (decision === "OBSERVE_ONLY") {
    return "Nothing is broken yet — but nothing is confirmed either. Wait for your setup, not for boredom to pass.";
  }

  if (mode === "aggressive_attack" || mode === "growth") {
    return "You're in rhythm — execute your plan, not your excitement.";
  }

  return "The market owes you nothing. Your discipline owes you everything.";
}

// ── Key Takeaway & Hero quote ────────────────────────────────────────────
// Two separate curated lists: the Hero quote is a generic daily reminder
// (rotates by day, same "stable for the whole day" convention
// morningBriefing.ts's getDailyMotivation already uses); the Key Takeaway
// is risk-specific, shown under the Biggest Risk card.

// Days since Jan 1 of the same year — duplicated from morningBriefing.ts's
// own dayOfYear rather than imported, per this folder's self-contained
// convention.
function dayOfYear(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return 0;
  const start = Date.UTC(y, 0, 1);
  const current = Date.UTC(y, m - 1, d);
  return Math.floor((current - start) / (24 * 60 * 60 * 1000));
}

const HERO_QUOTES: string[] = [
  "Discipline today protects your freedom tomorrow.",
  "The trader who survives is the trader who compounds.",
  "Every session is a test of process, not of prediction.",
  "Protect the account first. The profit follows.",
  "Small, repeatable edges beat big, lucky ones.",
  "Your rules are worth more than any single trade.",
  "Patience is a position too.",
];

export function getHeroQuote(dateSeed: string): string {
  return HERO_QUOTES[dayOfYear(dateSeed) % HERO_QUOTES.length];
}

const KEY_TAKEAWAY_BY_RISK: Record<BiggestRiskLabel, string> = {
  "Revenge Trading": "Professional traders stop because they have rules. Amateurs stop because they have no money left.",
  "Risk Escalation": "The size of your loss should never surprise you — that's what the plan is for.",
  Overtrading: "The best trade is often the one you don't take.",
  "Trading Outside Plan": "An edge only works inside the conditions it was built for.",
};

const DEFAULT_KEY_TAKEAWAYS: string[] = [
  "Consistency gets payouts. Excitement gets breaches.",
  "You don't need to be right often. You need to be disciplined always.",
  "The market rewards process, not urgency.",
];

export function getKeyTakeaway(biggestRisk: BiggestRisk | null, dateSeed: string): string {
  if (biggestRisk) return KEY_TAKEAWAY_BY_RISK[biggestRisk.label];
  return DEFAULT_KEY_TAKEAWAYS[dayOfYear(dateSeed) % DEFAULT_KEY_TAKEAWAYS.length];
}
