-- T2 preview: read-only account sharing, NOT APPLIED.
-- Apply only after T1 authorization tests and review of existing owner-only RLS.
create table if not exists public.team_account_shares (
 id uuid primary key default gen_random_uuid(),
 team_id uuid not null references public.teams(id) on delete cascade,
 account_type text not null check(account_type in ('challenge','funded')),
 account_id uuid not null,
 shared_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 revoked_at timestamptz
);
create unique index if not exists team_account_share_active_unique
 on public.team_account_shares(team_id,account_type,account_id)
 where revoked_at is null;
create index if not exists team_account_shares_owner on public.team_account_shares(shared_by,account_type,account_id);
alter table public.team_account_shares enable row level security;
revoke all on public.team_account_shares from public,anon,authenticated;

-- Definer lookup avoids RLS recursion and never trusts a client-supplied owner.
create or replace function private.has_shared_account(p_type text,p_account uuid,p_owner uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
 select auth.uid() is not null and exists(
  select 1 from public.team_account_shares s
  join public.team_members m on m.team_id=s.team_id and m.user_id=auth.uid()
  where s.account_type=p_type and s.account_id=p_account
    and s.shared_by=p_owner and s.revoked_at is null
 )
$$;
revoke all on function private.has_shared_account(text,uuid,uuid) from public,anon;
grant execute on function private.has_shared_account(text,uuid,uuid) to authenticated;

create policy team_account_shares_read on public.team_account_shares
 for select to authenticated
 using(private.is_team_member(team_id));
grant select on public.team_account_shares to authenticated;

-- Only owner may grant/revoke a share; account must belong to them.
create or replace function public.share_team_account(p_team_id uuid,p_type text,p_account_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_owner uuid := auth.uid();
begin
 if v_owner is null or not private.is_team_member(p_team_id) then
  raise exception 'Not a team member' using errcode='42501'; end if;
 if not ((p_type='challenge' and exists(
  select 1 from public.challenge_accounts where id=p_account_id and user_id=v_owner))
 or (p_type='funded' and exists(
  select 1 from public.funded_accounts where id=p_account_id and user_id=v_owner)))
 then raise exception 'Account not owned or invalid type' using errcode='42501'; end if;
 insert into public.team_account_shares(team_id,account_type,account_id,shared_by)
 values(p_team_id,p_type,p_account_id,v_owner)
 returning id into v_id;
 return v_id;
end $$;

create or replace function public.revoke_team_account_share(p_share_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
 update public.team_account_shares set revoked_at=now()
 where id=p_share_id and shared_by=auth.uid() and revoked_at is null;
 if not found then raise exception 'Share not found or not owned' using errcode='42501'; end if;
end $$;
revoke all on function public.share_team_account(uuid,text,uuid) from public,anon;
revoke all on function public.revoke_team_account_share(uuid) from public,anon;
grant execute on function public.share_team_account(uuid,text,uuid) to authenticated;
grant execute on function public.revoke_team_account_share(uuid) to authenticated;

-- These policies add only SELECT access. Existing owner-only write policies
-- on all financial tables are preserved unchanged.
create policy challenge_team_read on public.challenge_accounts for select to authenticated
 using(private.has_shared_account('challenge',id,user_id));
create policy funded_team_read on public.funded_accounts for select to authenticated
 using(private.has_shared_account('funded',id,user_id));
create policy trades_team_read on public.trades for select to authenticated
 using(private.has_shared_account('challenge',account_id,user_id)
    or private.has_shared_account('funded',account_id,user_id));
create policy payouts_team_read on public.payouts for select to authenticated
 using(private.has_shared_account('funded',funded_account_id,user_id));
