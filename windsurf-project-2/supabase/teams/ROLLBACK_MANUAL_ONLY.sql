-- PropsEdge Teams emergency rollback (manual execution only).
-- IMPORTANT: This deletes Teams workspace data. Back up Teams tables before running.
-- Only use if the six Teams migrations were applied and feature flags are OFF.
begin;
drop policy if exists challenge_team_read on public.challenge_accounts;
drop policy if exists funded_team_read on public.funded_accounts;
drop policy if exists trades_team_read on public.trades;
drop policy if exists payouts_team_read on public.payouts;
drop function if exists public.revoke_team_account_share(uuid);
drop function if exists public.share_team_account(uuid,text,uuid);
drop function if exists public.change_team_member_role(uuid,uuid,text);
drop function if exists public.remove_team_member(uuid,uuid);
drop function if exists public.revoke_team_invitation(uuid);
drop function if exists public.list_team_invitations(uuid);
drop function if exists public.list_my_team_invitations();
drop function if exists public.accept_team_invitation(uuid);
drop function if exists public.invite_team_member(uuid,text,text);
drop function if exists public.create_team(text);
drop table if exists public.team_notes;
drop table if exists public.team_account_shares;
drop table if exists public.team_invitations;
drop table if exists public.team_members;
drop table if exists public.teams;
drop function if exists private.has_shared_account(text,uuid,uuid);
drop function if exists private.is_team_manager(uuid);
drop function if exists private.is_team_member(uuid);
-- Keep private schema: it may contain unrelated objects.
commit;
