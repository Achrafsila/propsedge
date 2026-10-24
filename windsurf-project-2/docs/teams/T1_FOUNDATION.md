# PropsEdge Teams — T1 foundation

**Status:** design contract committed; no Teams database migration applied.

## Product invariants
- Personal Workspace remains the private Prop Firm workspace, distinct from retired Personal Broker.
- Team Workspace aggregates only explicitly shared Prop Firm challenges/funded accounts.
- Financial records remain individually owned. Team members can read shared accounts, trades and payout amounts/status/history; they cannot edit another trader's financial records.
- One account can be shared with multiple teams. Revocation is per team.
- Notes/comments/actions are collaborative and separately authorized.
- Shared accounts must use a separate read-only data layer; never inject them into the private `AccountsContext`.

## Proposed entities
`teams` (id, name, owner_user_id); `team_members` (team_id, user_id, role owner/admin/member); `team_invitations` (team_id, invited_email, invited_by, role, token_digest, expires_at, accepted_at, revoked_at); `team_account_shares` (team_id, account_type challenge/funded, account_id, shared_by, revoked_at); `team_notes`, `team_comments`, `team_actions`, `team_activity`.

## Authorization requirements
1. Create team and owner membership atomically; prohibit ownerless teams.
2. Membership RLS must avoid recursive policies. Check current database membership on every request, not user-editable metadata.
3. Only team owner/admin may invite; invitation acceptance must validate verified authenticated email, expiry, and token.
4. Only account owner may share or revoke their own account. Admin role does not grant authority over another trader's financial data.
5. Existing financial INSERT/UPDATE/DELETE owner policies must remain intact.
6. Team members can read payout amounts/status/history for explicitly shared funded accounts, never unrelated payouts.
7. Removing a member or revoking a share must immediately remove data/API/export access.
8. Sharing a challenge must not silently expose its successor funded account without an explicit continuity policy.
9. No browser service_role credentials. Any privileged SQL functions require separate security review.
10. Team switches cannot modify private analytics or trigger deletion of trades.

## Security acceptance tests
- Team A cannot read Team B data.
- Unshared account never visible to another user.
- Multi-team sharing and independent revocation.
- Team member can view payout amounts but cannot edit payouts, trades, balances, rules or lifecycle.
- Removing member immediately revokes all reads.
- Invitation cannot be accepted by a different email.
- Owner transfer/deletion cannot leave an ownerless team.
- Private dashboard and AI Coach calculations remain unchanged.

## Rollout
Reconcile existing SQL files with live Supabase migration history; stage migration with RLS and indexes; test using multiple authenticated users; then implement team switcher, membership and invitations. Team financial sharing follows in T2. No Teams migration is authorized for production without security tests.
