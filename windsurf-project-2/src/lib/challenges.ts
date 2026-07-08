import { Challenge, Trade } from "@/types";

// A Step 2 challenge row is a continuation of its parent, not a separate
// purchase — business-facing counts (Total Challenges, cost, funding rate)
// must only look at root challenges.
export const isRootChallenge = (challenge: Challenge): boolean => !challenge.parentChallengeId;

export const getRootChallenges = (challenges: Challenge[]): Challenge[] =>
  challenges.filter(isRootChallenge);

function findChildChallenge(root: Challenge, challenges: Challenge[]): Challenge | undefined {
  return challenges.find((c) => c.parentChallengeId === root.id);
}

// Step 1 only ever reaches 'step1_completed', never 'passed'/'failed' — once
// a Step 2 row exists, it is the source of truth for the challenge's overall
// outcome so the two steps are never counted as separate results.
export function getEffectiveStatus(root: Challenge, challenges: Challenge[]): Challenge["status"] {
  const child = findChildChallenge(root, challenges);
  return child ? child.status : root.status;
}

export function getEffectiveConvertedToFunded(root: Challenge, challenges: Challenge[]): boolean {
  const child = findChildChallenge(root, challenges);
  return !!(child ? child.convertedToFunded : root.convertedToFunded);
}

// Lifecycle statuses that still represent capital actively at risk in a
// challenge — failed/refunded lifecycles contribute $0, and a converted
// (funded) lifecycle has moved on to Funded Capital, so neither belongs in
// Total Capital even though its account size is still on the row.
const CAPITAL_ELIGIBLE_STATUSES: ReadonlySet<Challenge["status"]> = new Set([
  "active",
  "step1_completed",
  "passed",
]);

// Total Capital and any other KPI meant to reflect capital currently being
// traded must resolve each root challenge's *effective* lifecycle outcome
// (Step 2's status/conversion overriding a failed/passed Step 1) rather than
// summing every row's accountSize blindly — a failed Step 2 already leaves
// its parent Step 1 marked failed (see the Step 2 cascade fix), so this
// naturally drops the whole lifecycle to $0 without any extra bookkeeping.
export function getCapitalEligibleChallenges(challenges: Challenge[]): Challenge[] {
  return getRootChallenges(challenges).filter((root) => {
    if (getEffectiveConvertedToFunded(root, challenges)) return false;
    return CAPITAL_ELIGIBLE_STATUSES.has(getEffectiveStatus(root, challenges));
  });
}

// A 2-step lifecycle starts when Step 1 was created, never when Step 2 was
// spun off — so this always reads the root's own dates, regardless of
// whether a Step 2 row exists. Falls back from the user-editable purchase
// date to the DB row's creation timestamp, then the earliest linked trade,
// for legacy rows that predate one of those fields.
export function getEffectiveStartDate(root: Challenge, trades: Trade[]): string | undefined {
  if (root.purchaseDate) return root.purchaseDate;
  if (root.createdAt) return root.createdAt;
  const rootTrades = trades.filter((t) => t.accountId === root.id && t.accountType === "challenge");
  if (rootTrades.length === 0) return undefined;
  return rootTrades.reduce((earliest, t) => (t.entryDate < earliest ? t.entryDate : earliest), rootTrades[0].entryDate);
}

// The funded date comes from whichever row actually converted (Step 2 for a
// 2-step lifecycle, the root itself otherwise) — mirrors
// getEffectiveConvertedToFunded's child-first lookup. Returns undefined for
// lifecycles that never funded so callers can exclude them from averages.
export function getEffectiveFundedDate(root: Challenge, challenges: Challenge[]): string | undefined {
  if (!getEffectiveConvertedToFunded(root, challenges)) return undefined;
  const child = findChildChallenge(root, challenges);
  const target = child ?? root;
  return target.convertedToFundedAt ?? target.updatedAt ?? undefined;
}
