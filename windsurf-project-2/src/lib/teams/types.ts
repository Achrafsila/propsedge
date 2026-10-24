/**
 * PropsEdge Teams — shared contract, T1.
 * No team permissions are inferred from client state: RLS must enforce every operation.
 */
export type TeamRole = "owner" | "admin" | "member";
export type TeamAccountType = "challenge" | "funded";
export type WorkspaceSelection =
  | { kind: "personal" }
  | { kind: "team"; teamId: string };

export interface Team {
  id: string;
  name: string;
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMembership {
  teamId: string;
  userId: string;
  role: TeamRole;
  joinedAt: string;
}

export interface TeamAccountShare {
  id: string;
  teamId: string;
  accountType: TeamAccountType;
  accountId: string;
  sharedBy: string;
  createdAt: string;
  revokedAt: string | null;
}

/** UI hints only. Authorization is exclusively enforced by the server and database. */
export function canManageTeam(role: TeamRole): boolean {
  return role === "owner" || role === "admin";
}

/** Financial write access NEVER follows from team membership. */
export function canEditFinancialRecord(actorUserId: string, recordOwnerUserId: string): boolean {
  return Boolean(actorUserId) && actorUserId === recordOwnerUserId;
}

/** Sharing is always initiated by the account's owner, not by team administrators. */
export function canShareOwnedAccount(actorUserId: string, recordOwnerUserId: string): boolean {
  return canEditFinancialRecord(actorUserId, recordOwnerUserId);
}
