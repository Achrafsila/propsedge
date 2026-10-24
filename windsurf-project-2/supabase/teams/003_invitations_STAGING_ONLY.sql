-- T1 invitation schema; staging only. No production changes.
create table if not exists public.team_invitations (
 id uuid primary key default gen_random_uuid(),
 team_id uuid not null references public.teams(id) on delete cascade,
 invited_email text not null,
 invited_by uuid not null references auth.users(id),
 role text not null check (role in ('admin','member')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '7 days'),
 accepted_at timestamptz,
 revoked_at timestamptz
);
create unique index if not exists team_pending_invite_unique
 on public.team_invitations(team_id,lower(invited_email))
 where accepted_at is null and revoked_at is null;
alter table public.team_invitations enable row level security;
revoke all on public.team_invitations from public,anon,authenticated;

-- Membership lookup helper used by invitation RPCs.
create or replace function private.is_team_manager(p_team_id uuid)
returns boolean language sql stable security definer set search_path = ''
as '
 select auth.uid() is not null and exists (
  select 1 from public.team_members where team_id=p_team_id and user_id=auth.uid()
  and role in (''owner'',''admin''))
';
revoke all on function private.is_team_manager(uuid) from public,anon;
grant execute on function private.is_team_manager(uuid) to authenticated;

create or replace function public.invite_team_member(p_team_id uuid,p_email text,p_role text default 'member')
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_email text := lower(trim(p_email));
begin
 if not private.is_team_manager(p_team_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 if v_email is null or length(v_email)>320 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
 then raise exception 'Invalid email' using errcode='22023'; end if;
 if p_role not in ('admin','member') then raise exception 'Invalid role' using errcode='22023'; end if;
 if exists(
  select 1 from public.team_members m join auth.users u on u.id=m.user_id
  where m.team_id=p_team_id and lower(u.email)=v_email
 ) then raise exception 'Already a member' using errcode='23505'; end if;
 if p_role='admin' and not exists(select 1 from public.team_members where team_id=p_team_id and user_id=auth.uid() and role='owner')
 then raise exception 'Only owner can invite admins' using errcode='42501'; end if;
 update public.team_invitations set revoked_at=now()
 where team_id=p_team_id and lower(invited_email)=v_email and accepted_at is null and revoked_at is null and expires_at<=now();
 insert into public.team_invitations(team_id,invited_email,invited_by,role)
 values(p_team_id,v_email,auth.uid(),p_role) returning id into v_id;
 return v_id;
end $$;

create or replace function public.accept_team_invitation(p_invitation_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_email text; v_team uuid; v_role text;
begin
 select lower(email) into v_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if v_email is null then raise exception 'Verified email required' using errcode='42501'; end if;
 select team_id,role into v_team,v_role from public.team_invitations
 where id=p_invitation_id and lower(invited_email)=v_email and accepted_at is null
 and revoked_at is null and expires_at>now() for update;
 if v_team is null then raise exception 'Invitation unavailable' using errcode='42501'; end if;
 insert into public.team_members(team_id,user_id,role) values(v_team,auth.uid(),v_role)
 on conflict(team_id,user_id) do nothing;
 update public.team_invitations set accepted_at=now() where id=p_invitation_id;
 return v_team;
end $$;

create or replace function public.list_my_team_invitations()
returns table(id uuid,team_id uuid,team_name text,role text,expires_at timestamptz)
language sql stable security definer set search_path = ''
as $$
 select i.id,i.team_id,t.name,i.role,i.expires_at
 from public.team_invitations i join public.teams t on t.id=i.team_id
 join auth.users u on u.id=auth.uid()
 where u.email_confirmed_at is not null and lower(i.invited_email)=lower(u.email)
 and i.accepted_at is null and i.revoked_at is null and i.expires_at>now()
$$;
revoke all on function public.invite_team_member(uuid,text,text) from public,anon;
revoke all on function public.accept_team_invitation(uuid) from public,anon;
revoke all on function public.list_my_team_invitations() from public,anon;
grant execute on function public.invite_team_member(uuid,text,text) to authenticated;
grant execute on function public.accept_team_invitation(uuid) to authenticated;
grant execute on function public.list_my_team_invitations() to authenticated;
