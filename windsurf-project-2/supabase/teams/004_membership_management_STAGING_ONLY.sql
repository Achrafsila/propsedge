-- T1 membership management, staging only.
create or replace function private.is_team_manager(p_team_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
 select auth.uid() is not null and exists (
  select 1 from public.team_members where team_id=p_team_id and user_id=auth.uid()
  and role in ('owner','admin'))
$$;
revoke all on function private.is_team_manager(uuid) from public,anon;
grant execute on function private.is_team_manager(uuid) to authenticated;

create or replace function public.list_team_invitations(p_team_id uuid)
returns table(id uuid,invited_email text,role text,expires_at timestamptz,accepted_at timestamptz,revoked_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
begin
 if not private.is_team_manager(p_team_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 return query select i.id,i.invited_email,i.role,i.expires_at,i.accepted_at,i.revoked_at
 from public.team_invitations i where i.team_id=p_team_id order by i.created_at desc;
end $$;

create or replace function public.revoke_team_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_team uuid;
begin
 select team_id into v_team from public.team_invitations where id=p_invitation_id;
 if v_team is null or not private.is_team_manager(v_team) then raise exception 'Forbidden' using errcode='42501'; end if;
 update public.team_invitations set revoked_at=now() where id=p_invitation_id and accepted_at is null;
end $$;

create or replace function public.remove_team_member(p_team_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_actor_role text; v_target_role text;
begin
 select role into v_actor_role from public.team_members where team_id=p_team_id and user_id=auth.uid();
 select role into v_target_role from public.team_members where team_id=p_team_id and user_id=p_user_id;
 if v_target_role is null or v_target_role='owner' then raise exception 'Owner protected' using errcode='42501'; end if;
 if not (v_actor_role='owner' or (v_actor_role='admin' and v_target_role='member') or p_user_id=auth.uid())
 then raise exception 'Forbidden' using errcode='42501'; end if;
 delete from public.team_members where team_id=p_team_id and user_id=p_user_id;
end $$;

create or replace function public.change_team_member_role(p_team_id uuid,p_user_id uuid,p_role text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
 if p_role not in ('admin','member') or not exists (
  select 1 from public.team_members where team_id=p_team_id and user_id=auth.uid() and role='owner')
 then raise exception 'Owner only' using errcode='42501'; end if;
 update public.team_members set role=p_role where team_id=p_team_id and user_id=p_user_id and role<>'owner';
 if not found then raise exception 'Member not found or protected' using errcode='42501'; end if;
end $$;

revoke all on function public.list_team_invitations(uuid) from public,anon;
revoke all on function public.revoke_team_invitation(uuid) from public,anon;
revoke all on function public.remove_team_member(uuid,uuid) from public,anon;
revoke all on function public.change_team_member_role(uuid,uuid,text) from public,anon;
grant execute on function public.list_team_invitations(uuid) to authenticated;
grant execute on function public.revoke_team_invitation(uuid) to authenticated;
grant execute on function public.remove_team_member(uuid,uuid) to authenticated;
grant execute on function public.change_team_member_role(uuid,uuid,text) to authenticated;
