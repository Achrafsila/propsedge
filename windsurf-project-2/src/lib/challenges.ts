import { Challenge } from "@/types";

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
