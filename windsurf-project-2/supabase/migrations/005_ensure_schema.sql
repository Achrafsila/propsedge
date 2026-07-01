-- ============================================================
-- PropEdge — Migration 005: Ensure full schema (idempotent)
-- ============================================================
-- Run this once in the Supabase SQL editor.
-- It is safe to run multiple times: every statement uses
-- IF NOT EXISTS / IF EXISTS guards.
--
-- Use this if you are seeing:
--   • "relation does not exist" errors
--   • records appearing then disappearing after add
--   • dashboard showing 0 for all KPIs after login
-- ============================================================

-- Enable UUID support (already on by default in Supabase)
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. challenge_accounts
-- ============================================================
create table if not exists public.challenge_accounts (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        not null references auth.users(id) on delete cascade,
  prop_firm           text        not null,
  account_name        text        not null,
  account_size        numeric     not null,
  plan_type           text,
  purchase_cost       numeric     not null,
  purchase_date       date        not null,
  profit_target       numeric     not null,
  current_profit      numeric     not null default 0,
  max_drawdown        numeric     not null,
  remaining_drawdown  numeric     not null,
  deadline            date,
  status              text        not null default 'active'
                        check (status in ('active', 'failed', 'passed', 'refunded')),
  challenge_kind      text        check (challenge_kind in ('1-step', '2-step', 'instant')),
  challenge_step      text        check (challenge_step in ('1', '2', 'instant')),
  step1_profit_target numeric,
  step2_profit_target numeric,
  converted_to_funded boolean     not null default false,
  funded_account_id   uuid,
  preset_id           text,
  drawdown_mode       text        check (drawdown_mode in ('EOD', 'Daily', 'Trailing')),
  daily_drawdown      numeric,
  max_contracts       integer,
  min_trading_days    integer,
  consistency_rule    text,
  news_trading        text,
  payout_days         integer,
  min_payout          numeric,
  max_payout_request  numeric,
  payout_split        numeric,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Patch any columns that might be missing if an older schema was used
alter table public.challenge_accounts
  add column if not exists plan_type           text,
  add column if not exists challenge_kind      text,
  add column if not exists challenge_step      text,
  add column if not exists step1_profit_target numeric,
  add column if not exists step2_profit_target numeric,
  add column if not exists preset_id           text,
  add column if not exists drawdown_mode       text,
  add column if not exists daily_drawdown      numeric,
  add column if not exists max_contracts       integer,
  add column if not exists min_trading_days    integer,
  add column if not exists consistency_rule    text,
  add column if not exists news_trading        text,
  add column if not exists payout_days         integer,
  add column if not exists min_payout          numeric,
  add column if not exists max_payout_request  numeric,
  add column if not exists payout_split        numeric,
  add column if not exists notes               text,
  add column if not exists deadline            date,
  add column if not exists funded_account_id   uuid,
  add column if not exists converted_to_funded boolean not null default false;

create index if not exists idx_challenge_accounts_user_id on public.challenge_accounts(user_id);
create index if not exists idx_challenge_accounts_status  on public.challenge_accounts(status);

alter table public.challenge_accounts enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'challenge_accounts' and policyname = 'challenges_select_own'
  ) then
    create policy "challenges_select_own" on public.challenge_accounts
      for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'challenge_accounts' and policyname = 'challenges_insert_own'
  ) then
    create policy "challenges_insert_own" on public.challenge_accounts
      for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'challenge_accounts' and policyname = 'challenges_update_own'
  ) then
    create policy "challenges_update_own" on public.challenge_accounts
      for update using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'challenge_accounts' and policyname = 'challenges_delete_own'
  ) then
    create policy "challenges_delete_own" on public.challenge_accounts
      for delete using (auth.uid() = user_id);
  end if;
end $$;

-- ============================================================
-- 2. funded_accounts
-- ============================================================
create table if not exists public.funded_accounts (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        not null references auth.users(id) on delete cascade,
  source_challenge_id uuid,
  prop_firm           text        not null,
  account_name        text        not null,
  account_size        numeric     not null,
  plan_type           text,
  funding_date        date        not null,
  initial_balance     numeric     not null,
  current_balance     numeric     not null,
  current_profit      numeric     not null default 0,
  max_drawdown        numeric     not null,
  remaining_buffer    numeric     not null,
  status              text        not null default 'active'
                        check (status in ('active', 'breached', 'closed')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.funded_accounts
  add column if not exists source_challenge_id uuid,
  add column if not exists plan_type           text;

create index if not exists idx_funded_accounts_user_id on public.funded_accounts(user_id);
create index if not exists idx_funded_accounts_status  on public.funded_accounts(status);

alter table public.funded_accounts enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'funded_accounts' and policyname = 'funded_select_own'
  ) then
    create policy "funded_select_own" on public.funded_accounts
      for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'funded_accounts' and policyname = 'funded_insert_own'
  ) then
    create policy "funded_insert_own" on public.funded_accounts
      for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'funded_accounts' and policyname = 'funded_update_own'
  ) then
    create policy "funded_update_own" on public.funded_accounts
      for update using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'funded_accounts' and policyname = 'funded_delete_own'
  ) then
    create policy "funded_delete_own" on public.funded_accounts
      for delete using (auth.uid() = user_id);
  end if;
end $$;

-- ============================================================
-- 3. trades
-- ============================================================
create table if not exists public.trades (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  account_id   uuid        not null,
  account_type text        not null check (account_type in ('challenge', 'funded')),
  entry_date   date        not null,
  exit_date    date,
  entry_time   text,
  exit_time    text,
  session      text        check (session in ('London', 'New York', 'Asian')),
  symbol       text        not null,
  direction    text        not null default 'long',
  entry_price  numeric     not null default 0,
  exit_price   numeric     not null default 0,
  quantity     numeric     not null default 0,
  pnl          numeric     not null,
  status       text        not null check (status in ('win', 'loss', 'breakeven')),
  notes        text,
  picture      text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_trades_user_id    on public.trades(user_id);
create index if not exists idx_trades_account_id on public.trades(account_id);
create index if not exists idx_trades_entry_date on public.trades(entry_date);

alter table public.trades enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trades' and policyname = 'trades_select_own'
  ) then
    create policy "trades_select_own" on public.trades
      for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trades' and policyname = 'trades_insert_own'
  ) then
    create policy "trades_insert_own" on public.trades
      for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trades' and policyname = 'trades_update_own'
  ) then
    create policy "trades_update_own" on public.trades
      for update using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trades' and policyname = 'trades_delete_own'
  ) then
    create policy "trades_delete_own" on public.trades
      for delete using (auth.uid() = user_id);
  end if;
end $$;

-- ============================================================
-- 4. payouts
-- ============================================================
create table if not exists public.payouts (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  funded_account_id uuid        not null,
  payout_date       date        not null,
  generated_profit  numeric     not null default 0,
  requested_amount  numeric     not null,
  received_amount   numeric     not null default 0,
  prop_firm_split   numeric     not null default 0,
  status            text        not null default 'pending'
                      check (status in ('pending', 'paid', 'rejected')),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_payouts_user_id          on public.payouts(user_id);
create index if not exists idx_payouts_funded_account_id on public.payouts(funded_account_id);
create index if not exists idx_payouts_status           on public.payouts(status);

alter table public.payouts enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'payouts' and policyname = 'payouts_select_own'
  ) then
    create policy "payouts_select_own" on public.payouts
      for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'payouts' and policyname = 'payouts_insert_own'
  ) then
    create policy "payouts_insert_own" on public.payouts
      for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'payouts' and policyname = 'payouts_update_own'
  ) then
    create policy "payouts_update_own" on public.payouts
      for update using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'payouts' and policyname = 'payouts_delete_own'
  ) then
    create policy "payouts_delete_own" on public.payouts
      for delete using (auth.uid() = user_id);
  end if;
end $$;
