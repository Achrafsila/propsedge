import { Challenge, FundedAccount, PersonalAccount, PersonalAccountStatus } from "@/types";
import { TradingMode } from "@/context/TradingModeContext";

// Shared account dropdown formatting — used by the Trade Journal account
// selector and the Import Trades dialog's destination account selector so
// both render the exact same "Account Name (Status) — Start: DD/MM/YYYY"
// format instead of drifting into two different conventions.

export type AccountKind = "challenge" | "funded" | "personal";

export interface SelectableAccountSources {
  challenges: Challenge[];
  fundedAccounts: FundedAccount[];
  personalAccounts: PersonalAccount[];
}

// The single choke point every account-type selector (Trade Journal, Add
// Trade, Import Trades) funnels through — Trading Mode always wins over
// whatever accountType happens to be selected, so Personal and Prop Firm
// accounts can never appear in the same dropdown. Personal Capital mode
// only ever returns personalAccounts, regardless of accountType; Prop Firm
// mode never returns personalAccounts, even if accountType were somehow
// "personal" (defensive — callers keep accountType in sync with mode, but
// this makes the invariant hold even if one doesn't).
export function getSelectableAccounts(
  accountType: AccountKind,
  tradingMode: TradingMode,
  accounts: SelectableAccountSources
): (Challenge | FundedAccount | PersonalAccount)[] {
  if (tradingMode === "personal-capital") return accounts.personalAccounts;
  if (accountType === "challenge") return accounts.challenges;
  if (accountType === "funded") return accounts.fundedAccounts;
  return [];
}

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

const PERSONAL_STATUS_LABELS: Record<PersonalAccountStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  archived: "Archived",
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
  Inactive: "#94A3B8",
  Archived: "#64748B",
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

export function getAccountStatusLabel(
  account: Challenge | FundedAccount | PersonalAccount,
  kind: AccountKind
): string {
  if (kind === "challenge") {
    const c = account as Challenge;
    if (c.convertedToFunded) return "Funded";
    return CHALLENGE_STATUS_LABELS[c.status] ?? c.status;
  }
  if (kind === "funded") {
    const f = account as FundedAccount;
    return FUNDED_STATUS_LABELS[f.status] ?? f.status;
  }
  const p = account as PersonalAccount;
  return PERSONAL_STATUS_LABELS[p.status] ?? p.status;
}

// Challenges start from purchaseDate (user-editable, defaults to today),
// falling back to the DB row's createdAt. Funded accounts have neither
// field; their fundingDate is the closest equivalent to a "start date".
// Personal accounts use their own createdAt.
export function getAccountStartDateLabel(
  account: Challenge | FundedAccount | PersonalAccount,
  kind: AccountKind
): string {
  if (kind === "challenge") {
    const c = account as Challenge;
    return formatAccountStartDate(c.purchaseDate || c.createdAt);
  }
  if (kind === "funded") {
    return formatAccountStartDate((account as FundedAccount).fundingDate);
  }
  return formatAccountStartDate((account as PersonalAccount).createdAt);
}

export function getAccountOptionLabel(
  account: Challenge | FundedAccount | PersonalAccount,
  kind: AccountKind
): string {
  const status = getAccountStatusLabel(account, kind);
  const start = getAccountStartDateLabel(account, kind);
  return `${account.accountName} (${status}) — Start: ${start}`;
}
