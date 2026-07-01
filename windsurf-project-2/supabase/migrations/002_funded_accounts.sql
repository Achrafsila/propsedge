-- ============================================================
-- PropEdge — Migration 002: funded_accounts
-- Run this once in your Supabase SQL editor.
-- ============================================================

create table if not exists public.funded_accounts (
  -- Identity
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,

  -- Origin
  source_challenge_id uuid,          -- null for manually-added accounts

  -- Core fields
  prop_firm           text    not null,
  account_name        text    not null,
  account_size        numeric not null,
  plan_type           text,

  -- Balance / P&L
  funding_date        date    not null,
  initial_balance     numeric not null,
  current_balance     numeric not null,
  current_profit      numeric not null default 0,

  -- Risk
  max_drawdown        numeric not null,
  remaining_buffer    numeric not null,   -- maps to TS remainingDrawdown

  -- State
  status              text    not null default 'active'
                        check (status in ('active', 'breached', 'closed')),

  -- Timestamps
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Indexes
create index if not exists idx_funded_accounts_user_id
  on public.funded_accounts(user_id);

create index if not exists idx_funded_accounts_status
  on public.funded_accounts(status);

-- Row Level Security
alter table public.funded_accounts enable row level security;

create policy "funded_select_own"
  on public.funded_accounts for select
  using (auth.uid() = user_id);

create policy "funded_insert_own"
  on public.funded_accounts for insert
  with check (auth.uid() = user_id);

create policy "funded_update_own"
  on public.funded_accounts for update
  using (auth.uid() = user_id);

create policy "funded_delete_own"
  on public.funded_accounts for delete
  using (auth.uid() = user_id);
