import { Challenge, ChallengeStatus } from "@/types";

export type LifecycleNodeState = "done" | "current" | "upcoming" | "failed";

export interface LifecycleNode {
  label: string;
  shortLabel: string;
  state: LifecycleNodeState;
}

// Coarse buckets for filtering/table display — deliberately fewer values
// than ChallengeStatus: "still in motion" (active, step1_completed, and a
// passed-but-not-yet-converted row) all read as "active" here, since only
// failed/refunded/funded are actually terminal outcomes.
export type AccountStatusBucket = "active" | "failed" | "funded" | "refunded";

// Which stage this row's own lifecycle has reached, independent of outcome —
// drives the separate "Lifecycle" filter (Step 1 / Step 2 reached / Funded
// reached) called out from the Status filter (Active / Failed / Funded / Refunded).
export type AccountLifecycleBucket = "step1" | "step2" | "funded";

export const is2Step = (c: Challenge): boolean => c.challengeKind === "2-step";

export const getCurrentStep = (c: Challenge): "1" | "2" | "instant" =>
  c.challengeStep ?? (is2Step(c) ? "1" : "instant");

export const getStepTarget = (c: Challenge): number => {
  if (is2Step(c)) {
    return getCurrentStep(c) === "1"
      ? (c.step1ProfitTarget ?? c.profitTarget)
      : (c.step2ProfitTarget ?? c.profitTarget);
  }
  return c.profitTarget;
};

// A row is only "active" (still progressing toward a live target) while its
// raw status says so and it hasn't converted to funded — every other state
// is a resolved outcome that should read as an outcome, not a live stage.
export const isChallengeActive = (c: Challenge): boolean =>
  c.status === "active" && !c.convertedToFunded;

// Failed/refunded lifecycles never actually hit their target, so rendering
// them as a full 100% bar would visually lie about a loss (e.g. an account
// down $494 showing "completed"). These get a neutral summary instead.
export const endedWithoutProgress = (c: Challenge): boolean =>
  c.status === "failed" || c.status === "refunded";

// The single outcome phrase for the card/table badge. "Passed" is reserved
// for a *final* evaluation result (1-step/instant) — a 2-step row that
// finished Step 1 or Step 2 reads as "Step N completed" so it can never be
// mistaken for the whole challenge being passed.
export function getChallengeOutcomeLabel(c: Challenge): string {
  if (c.convertedToFunded) return "Funded";

  const step = getCurrentStep(c);
  const stepSuffix = is2Step(c) && step !== "instant" ? ` Step ${step}` : "";

  switch (c.status) {
    case "failed":
      return stepSuffix ? `Failed at${stepSuffix}` : "Failed";
    case "refunded":
      return "Refunded";
    case "passed":
      if (!is2Step(c)) return "Passed";
      return step === "2" ? "Step 2 completed" : "Step 1 completed";
    case "step1_completed":
      return "Step 1 completed";
    default:
      return "Active";
  }
}

// Fixed outcome colors, independent of the raw status enum, so a
// step-completed row (still progressing) never collides visually with a
// genuinely final "passed"/"funded" state even though both can carry the
// same underlying `status: "passed"` value.
export function getChallengeOutcomeColor(c: Challenge): string {
  if (c.convertedToFunded) return "#10B981";
  switch (c.status) {
    case "active":
      return "#298DFF";
    case "failed":
      return "#EF4444";
    case "refunded":
      return "#F59E0B";
    case "step1_completed":
      return "#A855F7";
    case "passed":
      return is2Step(c) ? "#A855F7" : "#10B981";
    default:
      return "#94A3B8";
  }
}

// Compact ✓ / ● / ○ / ✕ chain. Always renders every stage in the arc (never
// truncates after a failure) so it reads as "where things stand across the
// whole lifecycle" — matching the fixed display rules per status:
//   Active Step 1   → ● Step 1 → ○ Step 2 → ○ Funded
//   Active Step 2   → ✓ Step 1 → ● Step 2 → ○ Funded
//   Failed Step 1   → ✕ Step 1 → ○ Step 2 → ○ Funded
//   Failed Step 2   → ✓ Step 1 → ✕ Step 2 → ○ Funded
//   Funded          → ✓ Step 1 → ✓ Step 2 → ● Funded
//   Refunded        → done up to the reached stage, nothing marked current/failed
export function getLifecycleNodes(c: Challenge): LifecycleNode[] {
  if (!is2Step(c)) {
    const evalNode = (state: LifecycleNodeState): LifecycleNode => ({
      label: "Evaluation",
      shortLabel: "Eval",
      state,
    });
    const fundedNode = (state: LifecycleNodeState): LifecycleNode => ({
      label: "Funded",
      shortLabel: "Funded",
      state,
    });

    if (c.convertedToFunded) return [evalNode("done"), fundedNode("current")];
    if (c.status === "failed") return [evalNode("failed"), fundedNode("upcoming")];
    if (c.status === "passed") return [evalNode("done"), fundedNode("upcoming")];
    if (c.status === "refunded") return [evalNode("upcoming"), fundedNode("upcoming")];
    return [evalNode("current"), fundedNode("upcoming")];
  }

  const nodeDefs = [
    { label: "Step 1", shortLabel: "S1" },
    { label: "Step 2", shortLabel: "S2" },
    { label: "Funded", shortLabel: "Funded" },
  ];
  const ownIndex = getCurrentStep(c) === "2" ? 1 : 0;

  const build = (stateAt: (i: number) => LifecycleNodeState): LifecycleNode[] =>
    nodeDefs.map((def, i) => ({ ...def, state: stateAt(i) }));

  if (c.convertedToFunded) {
    return build((i) => (i === nodeDefs.length - 1 ? "current" : "done"));
  }
  if (c.status === "failed") {
    return build((i) => (i < ownIndex ? "done" : i === ownIndex ? "failed" : "upcoming"));
  }
  if (c.status === "refunded") {
    return build((i) => (i < ownIndex ? "done" : "upcoming"));
  }

  const ownStepDone = c.status === "passed" || c.status === "step1_completed";
  return build((i) => (i < ownIndex ? "done" : i === ownIndex ? (ownStepDone ? "done" : "current") : "upcoming"));
}

export function getAccountStatusBucket(c: Challenge): AccountStatusBucket {
  if (c.convertedToFunded) return "funded";
  if (c.status === "failed") return "failed";
  if (c.status === "refunded") return "refunded";
  return "active";
}

export function getAccountLifecycleBucket(c: Challenge): AccountLifecycleBucket {
  if (c.convertedToFunded) return "funded";
  return getCurrentStep(c) === "2" ? "step2" : "step1";
}

export type LifecycleStage = "1" | "2" | "instant";

// One purchased evaluation, normalized from however many DB rows it spans.
// A 2-step challenge is stored as two linked `Challenge` rows (a Step 1
// parent, and a Step 2 child created once Step 1 passes) — this collapses
// that pair back into the single lifecycle a user actually purchased, so
// the UI renders/counts one card per purchase instead of one per row.
export interface ChallengeLifecycle {
  lifecycleId: string;
  rootChallenge: Challenge;
  step1Record: Challenge;
  step2Record?: Challenge;
  // The row that's currently "live" — Step 2 once it exists, otherwise
  // Step 1. Status, drawdown, current profit, and target all read from here
  // since each step carries its own fresh values.
  latestRecord: Challenge;
  is2Step: boolean;
  status: ChallengeStatus;
  convertedToFunded: boolean;
  // Only one of these is ever set: currentStage while still progressing,
  // failedStage once the lifecycle has failed.
  currentStage?: LifecycleStage;
  failedStage?: LifecycleStage;
  // Always the root's purchaseCost — Step 2 rows are created with cost 0,
  // so summing across rows would still be correct, but reading only the
  // root is what makes that invariant explicit rather than incidental.
  totalCost: number;
  statusBucket: AccountStatusBucket;
  outcomeLabel: string;
  outcomeColor: string;
  lifecycleNodes: LifecycleNode[];
}

// Pure grouping: does not mutate or delete anything, just re-derives a
// per-lifecycle view from the flat row list every time `challenges` changes.
export function groupChallengesIntoLifecycles(challenges: Challenge[]): ChallengeLifecycle[] {
  const idSet = new Set(challenges.map((c) => c.id));
  // A row only behaves as a "child" if its declared parent is actually
  // present in this dataset — an orphaned Step 2 (parent deleted, or
  // excluded upstream) still gets its own lifecycle card rather than
  // silently vanishing from the grouped view.
  const isRoot = (c: Challenge) => !c.parentChallengeId || !idSet.has(c.parentChallengeId);

  return challenges.filter(isRoot).map((root) => {
    const step2Record = challenges.find((c) => c.parentChallengeId === root.id);
    const latestRecord = step2Record ?? root;
    const stage = getCurrentStep(latestRecord);
    const active = isChallengeActive(latestRecord);
    const failed = latestRecord.status === "failed";

    return {
      lifecycleId: root.id,
      rootChallenge: root,
      step1Record: root,
      step2Record,
      latestRecord,
      is2Step: is2Step(root),
      status: latestRecord.status,
      convertedToFunded: !!latestRecord.convertedToFunded,
      currentStage: active ? stage : undefined,
      failedStage: failed ? stage : undefined,
      totalCost: root.purchaseCost,
      statusBucket: getAccountStatusBucket(latestRecord),
      outcomeLabel: getChallengeOutcomeLabel(latestRecord),
      outcomeColor: getChallengeOutcomeColor(latestRecord),
      lifecycleNodes: getLifecycleNodes(latestRecord),
    };
  });
}
