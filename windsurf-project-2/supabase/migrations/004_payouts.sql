-- ============================================================
-- PropEdge — Migration 004: payouts
-- Run this once in your Supabase SQL editor.
-- ============================================================

create table if not exists public.payouts (
  -- Identity
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,

  -- Account link (no FK constraint — mirrors challenge/trade approach)
  funded_account_id   uuid not null,

  -- Payout details
  payout_date         date not null,
  generated_profit    numeric not null default 0,
  requested_amount    numeric not null,
  received_amount     numeric not null default 0,
  prop_firm_split     numeric not null default 0,   -- percentage, e.g. 10 = 10%

  -- State
  status              text not null default 'pending'
                        check (status in ('pending', 'paid', 'rejected')),

  -- Optional
  notes               text,

  -- Timestamps
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Indexes
create index if not exists idx_payouts_user_id
  on public.payouts(user_id);

create index if not exists idx_payouts_funded_account_id
  on public.payouts(funded_account_id);

create index if not exists idx_payouts_status
  on public.payouts(status);

-- Row Level Security
alter table public.payouts enable row level security;

create policy "payouts_select_own"
  on public.payouts for select
  using (auth.uid() = user_id);

create policy "payouts_insert_own"
  on public.payouts for insert
  with check (auth.uid() = user_id);

create policy "payouts_update_own"
  on public.payouts for update
  using (auth.uid() = user_id);

create policy "payouts_delete_own"
  on public.payouts for delete
  using (auth.uid() = user_id);
