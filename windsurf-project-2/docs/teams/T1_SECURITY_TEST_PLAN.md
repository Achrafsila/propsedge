# Teams T1 — authorization test plan (staging)

Preconditions: apply 001 then 002 to an isolated Supabase staging database. Do NOT execute against production until migration history is reconciled. Prepare three distinct authenticated identities: Alice, Bob and Charlie.

1. Anonymous user: SELECT teams and team_members denied; create_team RPC denied.
2. Alice: create_team('Alpha') succeeds; exactly one team and one owner membership are committed.
3. Alice: create_team(' ') fails; neither team nor membership is inserted.
4. Bob: SELECT teams returns no Alpha row; SELECT team_members returns no Alpha row.
5. Bob: direct INSERT teams, team_members and UPDATE/DELETE attempts denied.
6. Alice: SELECT teams returns Alpha; SELECT team_members returns exactly Alice.
7. Alice: direct INSERT/UPDATE/DELETE teams and team_members denied, despite owner role (until audited RPCs).
8. Alice: create_team('Beta') succeeds; two teams and two owner memberships are visible.
9. Charlie: create_team('Gamma') succeeds; Charlie sees Gamma only.
10. Verify exactly one owner per team, foreign keys, indexes and RLS enabled.
11. Verify function EXECUTE privileges: anon cannot call create_team or private.is_team_member; authenticated can call create_team.
12. Inspect database advisor warnings and test that no function exposes arbitrary team member data via supplied UUIDs.
13. Test two simultaneous team creation requests by Alice; each team must have its owner membership.
14. After adding invitation and removal RPCs, repeat tests with cross-team membership and immediate revocation.
15. Confirm no existing Prop Firm financial table policy changed and no broker localStorage was accessed.

Automate these with isolated JWTs in a staging environment before enabling the Teams UI.
