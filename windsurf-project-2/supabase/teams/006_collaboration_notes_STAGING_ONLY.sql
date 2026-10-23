-- T3 collaboration notes: team members may write notes; financial records remain owner-only.
-- Staging only. Apply after 001–005, verify RLS with separate identities.
create table if not exists public.team_notes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  account_type text not null check (account_type in ('challenge','funded')),
  account_id uuid not null,
  author_user_id uuid not null references auth.users(id),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists team_notes_account_idx
  on public.team_notes(team_id,account_type,account_id,created_at desc);
alter table public.team_notes enable row level security;
revoke all on public.team_notes from public,anon,authenticated;
-- V1 UI supports creating and deleting notes only. No UPDATE permission: prevents
-- changing an existing note's account/team reference or author identity.
grant select,insert,delete on public.team_notes to authenticated;

-- Only members of the team may read/write notes for an ACTIVE share in that team.
-- Membership alone never grants visibility to unrelated private accounts.
create policy team_notes_read on public.team_notes for select to authenticated
 using (
   private.is_team_member(team_id) and exists (
     select 1 from public.team_account_shares s
     where s.team_id=team_notes.team_id and s.account_type=team_notes.account_type
       and s.account_id=team_notes.account_id and s.revoked_at is null
   )
 );
create policy team_notes_insert on public.team_notes for insert to authenticated
 with check (
   author_user_id=(select auth.uid()) and private.is_team_member(team_id)
   and exists (
     select 1 from public.team_account_shares s
     where s.team_id=team_notes.team_id and s.account_type=team_notes.account_type
       and s.account_id=team_notes.account_id and s.revoked_at is null
   )
 );
create policy team_notes_delete on public.team_notes for delete to authenticated
 using (author_user_id=(select auth.uid()) and private.is_team_member(team_id));
