-- ============================================================
-- PropEdge — Migration 003: trades
-- Run this once in your Supabase SQL editor.
-- ============================================================

create table if not exists public.trades (
  -- Identity
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,

  -- Account link (no FK — can point to challenge_accounts or funded_accounts)
  account_id    uuid not null,
  account_type  text not null check (account_type in ('challenge', 'funded')),

  -- Timing
  entry_date    date not null,
  exit_date     date,
  entry_time    text,
  exit_time     text,
  session       text check (session in ('London', 'New York', 'Asian')),

  -- Trade details
  symbol        text not null,
  direction     text not null default 'long',
  entry_price   numeric not null default 0,
  exit_price    numeric not null default 0,
  quantity      numeric not null default 0,

  -- P&L
  pnl           numeric not null,
  status        text not null check (status in ('win', 'loss', 'breakeven')),

  -- Optional
  notes         text,
  picture       text,

  -- Timestamps
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Indexes
create index if not exists idx_trades_user_id
  on public.trades(user_id);

create index if not exists idx_trades_account_id
  on public.trades(account_id);

create index if not exists idx_trades_entry_date
  on public.trades(entry_date);

-- Row Level Security
alter table public.trades enable row level security;

create policy "trades_select_own"
  on public.trades for select
  using (auth.uid() = user_id);

create policy "trades_insert_own"
  on public.trades for insert
  with check (auth.uid() = user_id);

create policy "trades_update_own"
  on public.trades for update
  using (auth.uid() = user_id);

create policy "trades_delete_own"
  on public.trades for delete
  using (auth.uid() = user_id);
