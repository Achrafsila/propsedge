-- ============================================================
-- PropEdge — Migration 006: 2-step challenge workflow
-- Run this once in your Supabase SQL editor.
-- Idempotent — safe to run multiple times.
-- ============================================================
-- Adds:
--   • challenge_accounts.parent_challenge_id — links a Step 2
--     challenge back to the Step 1 challenge it was created from.
--   • 'step1_completed' as a valid challenge_accounts.status value,
--     used to mark a Step 1 challenge done without altering its
--     historical trades/profit/drawdown.
-- ============================================================

alter table public.challenge_accounts
  add column if not exists parent_challenge_id uuid references public.challenge_accounts(id) on delete set null;

create index if not exists idx_challenge_accounts_parent_challenge_id
  on public.challenge_accounts(parent_challenge_id);

alter table public.challenge_accounts
  drop constraint if exists challenge_accounts_status_check;

alter table public.challenge_accounts
  add constraint challenge_accounts_status_check
  check (status in ('active', 'failed', 'passed', 'refunded', 'step1_completed'));
