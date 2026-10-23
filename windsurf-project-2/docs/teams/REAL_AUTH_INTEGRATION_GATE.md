# Supabase integration gate — Team Workspace

## Current environment
- Production Supabase project: lbmwvsghqarrlpylknmj (Free).
- Production migration history is empty; historical financial schema exists.
- Teams feature flags remain disabled and PR #2 remains draft.
- Do not apply the Teams migrations to production before reconciling migration history and receiving deployment approval.

## Real-auth validation procedure (after schema deployment is approved)
1. Use three distinct Supabase Auth accounts: Owner, Member, Outsider; never use a service-role client for test requests.
2. Authenticate each account separately and verify each JWT identifies the expected user.
3. Owner creates a team; Outsider must not see it.
4. Owner invites Member; wrong-email Outsider cannot accept; Member accepts with verified email.
5. Owner shares one Challenge and one Funded account; Member sees only those, related trades and payouts.
6. Member cannot INSERT, UPDATE or DELETE financial records owned by Owner.
7. Member can create a note on a shared account, cannot forge another author or modify notes.
8. Owner revokes a share; Member immediately loses access to the account and its notes.
9. Owner removes Member; all remaining shared-account and payout visibility disappears.
10. Test UI navigation, invite errors, empty states, sign-out/sign-in and feature flags.
11. Re-run Supabase security advisors and confirm no new warnings before activation.

## Deployment decision
- Local PostgreSQL and GitHub Actions tests are necessary but do not substitute real JWT/Data API verification.
- Do not create test accounts or write test data in production without explicit authorization.
- No new paid infrastructure, Supabase Pro, or Supabase branching required.
- Keep production unchanged until final release decision.
