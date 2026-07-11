-- ============================================================
-- PropEdge — Migration 009: daily_contracts
-- Run this once in your Supabase SQL editor.
-- ============================================================
-- EdgePilot V2 Daily Trading Contract — the plan the trader commits to
-- each morning (max risk/trades, allowed session/instruments, stop rule),
-- persisted so the Accountability Engine can audit actual trades against
-- it later in the day and across weeks. One row per account per calendar
-- day; account_id is TEXT (not a FK) because Personal Accounts are
-- localStorage-only (see PersonalAccountsContext) and have no DB row to
-- reference — same "no FK, app-level id" convention trades.account_id
-- would use if it supported personal accounts.

create table if not exists public.daily_contracts (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,

  -- Account link (no FK — spans challenge_accounts, funded_accounts, and
  -- client-side-only personal accounts)
  account_id           text not null,
  account_type         text not null check (account_type in ('challenge', 'funded', 'personal')),

  -- Trading day this contract applies to — local "YYYY-MM-DD", same
  -- convention as trades.entry_date / todayDateString()
  contract_date        date not null,

  -- The plan
  primary_objective     text,
  max_risk_per_trade    numeric,
  max_trades            integer,
  stop_after_losses     integer,
  allowed_sessions      text[] not null default '{}',
  allowed_instruments   text[] not null default '{}',
  special_rules         text,

  committed_at          timestamptz not null default now(),
  created_at            timestamptz not null default now(),

  unique (user_id, account_type, account_id, contract_date)
);

-- Indexes
create index if not exists idx_daily_contracts_user_id
  on public.daily_contracts(user_id);

create index if not exists idx_daily_contracts_contract_date
  on public.daily_contracts(contract_date);

-- Row Level Security
alter table public.daily_contracts enable row level security;

create policy "daily_contracts_select_own"
  on public.daily_contracts for select
  using (auth.uid() = user_id);

create policy "daily_contracts_insert_own"
  on public.daily_contracts for insert
  with check (auth.uid() = user_id);

create policy "daily_contracts_update_own"
  on public.daily_contracts for update
  using (auth.uid() = user_id);

create policy "daily_contracts_delete_own"
  on public.daily_contracts for delete
  using (auth.uid() = user_id);
