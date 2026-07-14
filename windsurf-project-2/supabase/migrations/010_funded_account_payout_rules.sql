-- ============================================================
-- PropEdge — Migration 010: funded account funding path + payout rules
-- Run this once in your Supabase SQL editor.
-- Idempotent — safe to run multiple times.
-- ============================================================
-- Supersedes an earlier, never-applied draft of this migration that added
-- these concepts to challenge_accounts instead — Instant Funded (and any
-- future non-evaluation funding path) is a FundedAccount from creation, not
-- a Challenge, per the Option B architecture decision. See
-- src/lib/analytics/payoutEligibility.ts for how these columns are read.
--
-- Adds:
--   • funded_accounts.funding_path — how the account was obtained:
--     'evaluation' (default, every existing row — passed a Challenge),
--     'instant', 'giveaway', 'affiliate', 'internal'. UI/analytics concern
--     only — never drives eligibility logic, only badges/filtering.
--   • funded_accounts.trading_environment — 'cfd' or 'futures'.
--   • Payout-eligibility rule columns (flat at the DB layer; the app layer
--     exposes these as a single structured PayoutRules object — see
--     rowToFundedAccount in src/lib/supabase/funded_accounts.ts):
--     consistency requirement + limit, minimum trading days + count,
--     minimum qualifying daily profit type + value. All nullable/default
--     false — irrelevant for a plain converted account with no native rules
--     (those fall back to its source Challenge's legacy rule fields).
--   • funded_accounts.purchase_cost — what was actually paid to obtain a
--     non-evaluation-path account (Instant Funded, giveaway, etc.). Null for
--     converted accounts, whose cost is already tracked on their source
--     Challenge row — see getROIStats in src/context/AccountsContext.tsx for
--     why this is only summed for fundingPath !== 'evaluation' rows, to
--     avoid double-counting.
-- ============================================================

alter table public.funded_accounts
  add column if not exists funding_path text not null default 'evaluation'
    check (funding_path in ('evaluation', 'instant', 'giveaway', 'affiliate', 'internal'));

alter table public.funded_accounts
  add column if not exists trading_environment text
    check (trading_environment in ('cfd', 'futures'));

alter table public.funded_accounts
  add column if not exists consistency_required boolean not null default false;

alter table public.funded_accounts
  add column if not exists consistency_limit numeric;

alter table public.funded_accounts
  add column if not exists minimum_trading_days_required boolean not null default false;

alter table public.funded_accounts
  add column if not exists minimum_trading_days integer;

alter table public.funded_accounts
  add column if not exists minimum_daily_profit_type text
    check (minimum_daily_profit_type in ('fixed', 'percentage'));

alter table public.funded_accounts
  add column if not exists minimum_daily_profit_value numeric;

alter table public.funded_accounts
  add column if not exists purchase_cost numeric;

create index if not exists idx_funded_accounts_funding_path
  on public.funded_accounts(funding_path);
