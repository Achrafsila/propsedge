-- ============================================================
-- PropEdge — Migration 008: challenge funded-at timestamp
-- Run this once in your Supabase SQL editor.
-- Idempotent — safe to run multiple times.
-- ============================================================
-- Adds:
--   • challenge_accounts.converted_to_funded_at — timestamp a
--     challenge (root or its Step 2) became funded, used by the
--     Average Time to Funded dashboard KPI. created_at/updated_at
--     already exist from migration 001 and need no changes here.
-- ============================================================

alter table public.challenge_accounts
  add column if not exists converted_to_funded_at timestamptz;
