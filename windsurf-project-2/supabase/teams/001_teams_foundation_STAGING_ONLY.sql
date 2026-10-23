-- PropsEdge T1: Teams foundation. NOT APPLIED to production.
-- Migration history must be reconciled before applying.
-- Security boundary: membership grants team visibility, never financial write access.

create table if not exists public.teams (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(trim(name)) between 2 and 100),
 owner_user_id uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.team_members (
 team_id uuid not null references public.teams(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('owner','admin','member')),
 joined_at timestamptz not null default now(),
 primary key(team_id,user_id)
);
create unique index if not exists team_one_owner_per_team on public.team_members(team_id) where role='owner';
create index if not exists team_members_by_user on public.team_members(user_id,team_id);

-- Keep these tables inaccessible until tested RLS policies and atomic team creation
-- RPC are introduced. An empty policy set means authenticated clients cannot
-- access team data, even if schema grants are present.
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
revoke all on public.teams from anon, authenticated;
revoke all on public.team_members from anon, authenticated;

-- Deliberately no direct client INSERT on teams or team_members:
-- team creation must insert the team + its sole owner atomically.
-- This schema is a staging artifact, not a completed T1 deployment.
