import { Challenge, FundedAccount } from "@/types";

// Shared account dropdown formatting — used by the Trade Journal account
// selector and the Import Trades dialog's destination account selector so
// both render the exact same "Account Name (Status) — Start: DD/MM/YYYY"
// format instead of drifting into two different conventions.

// A converted challenge reads as "Funded" (not "Passed") since that's its
// actual current lifecycle state.
const CHALLENGE_STATUS_LABELS: Record<Challenge["status"], string> = {
  active: "Active",
  passed: "Passed",
  failed: "Failed",
  refunded: "Refunded",
  step1_completed: "Step 1 Done",
};

const FUNDED_STATUS_LABELS: Record<FundedAccount["status"], string> = {
  active: "Active",
  breached: "Breached",
  closed: "Closed",
};

export const ACCOUNT_STATUS_BADGE_COLOR: Record<string, string> = {
  Active: "#298DFF",
  Passed: "#10B981",
  Failed: "#EF4444",
  Refunded: "#F59E0B",
  "Step 1 Done": "#A855F7",
  Funded: "#10B981",
  Breached: "#EF4444",
  Closed: "#94A3B8",
};

// DD/MM/YYYY — parsed as UTC so a date-only string ("2026-07-08") or a full
// timestamp never shifts a day off in a non-UTC browser timezone.
export function formatAccountStartDate(iso: string | undefined | null): string {
  if (!iso) return "No start date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "No start date";
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getUTCFullYear()}`;
}

export function getAccountStatusLabel(account: Challenge | FundedAccount, isChallenge: boolean): string {
  if (isChallenge) {
    const c = account as Challenge;
    if (c.convertedToFunded) return "Funded";
    return CHALLENGE_STATUS_LABELS[c.status] ?? c.status;
  }
  const f = account as FundedAccount;
  return FUNDED_STATUS_LABELS[f.status] ?? f.status;
}

// Challenges start from purchaseDate (user-editable, defaults to today),
// falling back to the DB row's createdAt. Funded accounts have neither
// field; their fundingDate is the closest equivalent to a "start date".
export function getAccountStartDateLabel(account: Challenge | FundedAccount, isChallenge: boolean): string {
  if (isChallenge) {
    const c = account as Challenge;
    return formatAccountStartDate(c.purchaseDate || c.createdAt);
  }
  return formatAccountStartDate((account as FundedAccount).fundingDate);
}

export function getAccountOptionLabel(account: Challenge | FundedAccount, isChallenge: boolean): string {
  const status = getAccountStatusLabel(account, isChallenge);
  const start = getAccountStartDateLabel(account, isChallenge);
  return `${account.accountName} (${status}) — Start: ${start}`;
}
