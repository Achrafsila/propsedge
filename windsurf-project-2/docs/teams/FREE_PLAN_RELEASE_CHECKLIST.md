# Teams release checklist — Supabase Free (no paid branch)

## Scope
This project intentionally stays on Supabase Free + Vercel + GitHub.
Do not run SQL 001–006 in production until the tests below can be
performed against an isolated local PostgreSQL database or another
no-cost test environment, and the live migration drift is reconciled.

## Database security tests (mandatory)
Use three independent authenticated identities: Alice (owner), Bob
(member), Charlie (outsider). Test with actual authenticated JWTs,
not just the SQL editor's postgres role.

1. Alice creates Team A; exactly one owner row is created.
2. Charlie cannot SELECT Team A or any of its members.
3. Bob cannot invite anyone before joining.
4. Alice invites Bob; Charlie cannot accept Bob's invitation.
5. Bob cannot accept with an unverified email.
6. Bob accepts; Bob sees Team A; Charlie still cannot.
7. Bob cannot create an admin invitation or promote himself.
8. Alice can promote/demote Bob; Bob cannot remove Alice.
9. Alice shares a Challenge; Bob sees only that Challenge and its
   trades, not Alice's other Challenge or Funded accounts.
10. Alice shares a Funded account; Bob sees its payouts and trades,
    but cannot INSERT/UPDATE/DELETE the account, trades or payouts.
11. Charlie cannot see any shared account or collaboration notes.
12. Bob creates a note on an actively shared account; Alice can read it.
13. Bob cannot change or delete Alice's note.
14. Alice revokes sharing; Bob immediately loses account, trade,
    payout and note access for that account.
15. Bob is removed from Team A; Bob immediately loses all team access.
16. Sharing to Team B never grants access to Team A, or vice versa.
17. An account share cannot be created for an account the actor
    does not own.
18. Expired and revoked invitations cannot be accepted.
19. A member cannot write a note on an unshared account.
20. Check account_type is honored for trades (challenge/funded).

## Release gates
- No RLS bypass in client or service_role exposure.
- Security advisors checked after SQL is applied.
- TypeScript, production build and browser E2E pass.
- Team route + navigation feature flags enabled only AFTER DB tests.
- SQL migration history reconciled before production changes.
- Rollback plan: disable flags first, preserve existing private data.
- No claim of production readiness until all mandatory checks pass.

## Known functional constraints
- Invitation is in-app only; there is no outgoing email notification.
- Team notes are scoped to actively shared accounts; deleting a
  share hides notes from members without deleting the audit trail.
- No local Postgres, Docker, or Supabase CLI was detected on the
  authorized Mac at the time this checklist was authored.
- Supabase branching was refused because the project is not Pro.
