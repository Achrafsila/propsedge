# Teams production schema deployment — 2026-10-23/24

Project: lbmwvsghqarrlpylknmj (Supabase Free).

## Applied (SQL execution, not Supabase migration history)
1. 001_teams_foundation_STAGING_ONLY.sql
2. 002_team_creation_and_rls_STAGING_ONLY.sql
3. 003_invitations_STAGING_ONLY.sql
4. 004_membership_management_STAGING_ONLY.sql
5. 005_account_shares_STAGING_ONLY.sql
6. 006_collaboration_notes_STAGING_ONLY.sql

All six executions completed successfully. Five Teams tables exist, all RLS enabled.
Teams table counts immediately after deploy: teams=0, members=0, invitations=0, shares=0, notes=0.
Existing four financial tables remain RLS enabled, each now has five policies (four owner policies plus one team SELECT).
No existing financial data was written during deployment.
Feature flags intentionally OFF. PR #2 remains draft. No Vercel release performed.

## Rollback
Manual rollback script: supabase/teams/ROLLBACK_MANUAL_ONLY.sql. This would delete any Teams data created after deployment. Never execute after onboarding users without exporting Teams data first.
Existing financial tables are preserved by rollback; only the four team SELECT policies are dropped.
No verified point-in-time backup was taken; do not describe rollback as full data restoration.

## Advisors
Supabase security advisor flags the ten authenticated callable SECURITY DEFINER RPCs in public. These are intentional API RPCs but require real-auth authorization tests before release.
The team_invitations table has RLS enabled with zero policies by design: invitations accessed via restricted RPCs.
Existing leaked password protection warning remains.

## Remaining gates
- Real Supabase Auth multi-identity REST tests (owner/member/outsider).
- Verify exposed RPC permissions and actual JWT-based authorization, including note access and share revocation.
- Reconcile migration tracking (Supabase migration history is empty).
- Verify feature flags OFF and browser QA; enable only after explicit release decision.
