-- PropsEdge Teams T1, follow-up to 001_teams_foundation_STAGING_ONLY.sql.
-- NOT APPLIED. Security-reviewed staging candidate; run integration tests first.
-- All functions are schema-qualified and explicitly deny anonymous execution.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Membership lookup runs under definer privileges to avoid self-referential
-- RLS recursion. It accepts only a team ID; actor is ALWAYS auth.uid().
create or replace function private.is_team_member(p_team_id uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.team_members m
    where m.team_id = p_team_id and m.user_id = (select auth.uid())
  );
$$;
revoke all on function private.is_team_member(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_team_member(uuid) to authenticated;

-- A single authenticated transaction creates team and sole owner membership.
-- Direct client writes remain denied to prevent inconsistent ownership.
create or replace function public.create_team(p_name text)
returns uuid language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_name is null or char_length(trim(p_name)) not between 2 and 100 then
    raise exception 'Team name must contain 2 to 100 characters' using errcode = '22023';
  end if;
  insert into public.teams(name,owner_user_id)
    values (trim(p_name),v_user) returning id into v_id;
  insert into public.team_members(team_id,user_id,role)
    values (v_id,v_user,'owner');
  return v_id;
end;
$$;
revoke all on function public.create_team(text) from public, anon;
grant execute on function public.create_team(text) to authenticated;

create policy teams_select_member on public.teams
  for select to authenticated
  using ((select private.is_team_member(id)));

create policy team_members_select_member on public.team_members
  for select to authenticated
  using ((select private.is_team_member(team_id)));

grant select on public.teams, public.team_members to authenticated;

-- No direct INSERT/UPDATE/DELETE grants on either table.
-- Team membership additions, invitations, owner transfers and removal
-- require separately audited transactional RPCs, introduced next.
