-- ============================================================
-- PropEdge — Migration 001: challenge_accounts
-- Run this once in your Supabase SQL editor.
-- ============================================================

-- UUID support (already enabled on most Supabase projects)
create extension if not exists "pgcrypto";

-- ============================================================
-- Table
-- ============================================================
create table if not exists public.challenge_accounts (
  -- Identity
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,

  -- Required core fields (from spec)
  prop_firm           text    not null,
  account_name        text    not null,
  account_size        numeric not null,
  plan_type           text,                   -- challengeType (e.g. "Flex Plan 50K")
  purchase_cost       numeric not null,
  purchase_date       date    not null,
  profit_target       numeric not null,
  current_profit      numeric not null default 0,
  max_drawdown        numeric not null,
  remaining_drawdown  numeric not null,
  deadline            date,
  status              text    not null default 'active'
                        check (status in ('active', 'failed', 'passed', 'refunded')),

  -- Extended challenge fields
  challenge_kind      text check (challenge_kind in ('1-step', '2-step', 'instant')),
  challenge_step      text check (challenge_step in ('1', '2', 'instant')),
  step1_profit_target numeric,
  step2_profit_target numeric,
  converted_to_funded boolean not null default false,
  funded_account_id   uuid,
  preset_id           text,

  -- Rule fields (copied from preset at creation time)
  drawdown_mode       text check (drawdown_mode in ('EOD', 'Daily', 'Trailing')),
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

  -- Timestamps
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================
create index if not exists idx_challenge_accounts_user_id
  on public.challenge_accounts(user_id);

create index if not exists idx_challenge_accounts_status
  on public.challenge_accounts(status);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.challenge_accounts enable row level security;

-- SELECT — users see only their own rows
create policy "challenges_select_own"
  on public.challenge_accounts for select
  using (auth.uid() = user_id);

-- INSERT — users can only insert rows for themselves
create policy "challenges_insert_own"
  on public.challenge_accounts for insert
  with check (auth.uid() = user_id);

-- UPDATE — users can only update their own rows
create policy "challenges_update_own"
  on public.challenge_accounts for update
  using (auth.uid() = user_id);

-- DELETE — users can only delete their own rows
create policy "challenges_delete_own"
  on public.challenge_accounts for delete
  using (auth.uid() = user_id);
