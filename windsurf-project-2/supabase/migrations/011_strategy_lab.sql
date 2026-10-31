-- Strategy Lab: private per-user playbooks and replay observations.
create table if not exists public.lab_strategies (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null, instrument text not null default 'XAUUSD', session text not null default 'Asia',
 context_tf text not null default 'H1', execution_tf text not null default 'M5',
 description text not null default '', rules jsonb not null default '[]'::jsonb,
 be_trigger numeric not null default 1 check (be_trigger > 0), created_at timestamptz not null default now()
);
create table if not exists public.lab_observations (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 strategy_id uuid not null references public.lab_strategies(id) on delete cascade,
 max_r numeric not null check (max_r >= 0), outcome text not null check(outcome in ('sl','be','open')),
 liquidity text not null default 'na' check(liquidity in ('hit','miss','na')),
 checklist jsonb not null default '[]'::jsonb, created_at timestamptz not null default now()
);
create index if not exists lab_strategies_user_idx on public.lab_strategies(user_id);
create index if not exists lab_observations_strategy_idx on public.lab_observations(strategy_id,created_at desc);
alter table public.lab_strategies enable row level security;
alter table public.lab_observations enable row level security;
create policy "lab_strategies_owner" on public.lab_strategies for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "lab_observations_owner" on public.lab_observations for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid() and exists (select 1 from public.lab_strategies s where s.id=strategy_id and s.user_id=auth.uid()));
