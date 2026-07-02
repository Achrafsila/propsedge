-- ============================================================
-- PropEdge — Migration 007: prevent orphan trades
-- Run this once in your Supabase SQL editor.
-- Idempotent — safe to run multiple times.
-- ============================================================
-- trades.account_id is a polymorphic reference (challenge_accounts OR
-- funded_accounts — see migration 003), so it can't carry a normal foreign
-- key with ON DELETE CASCADE. These triggers give it an equivalent
-- guarantee at the database level: deleting a challenge or funded account
-- always deletes its linked trades first, no matter which code path
-- performed the delete (app, admin tooling, SQL editor, ...).
--
-- Runs with the caller's own privileges (no SECURITY DEFINER) so the
-- trigger's DELETE on public.trades is still subject to the
-- "trades_delete_own" RLS policy — it only ever removes trades the
-- deleting user already owns.
-- ============================================================

create or replace function public.delete_trades_for_challenge_account()
returns trigger
language plpgsql
as $$
begin
  delete from public.trades
  where account_id = old.id
    and account_type = 'challenge';
  return old;
end;
$$;

drop trigger if exists trg_delete_trades_for_challenge_account on public.challenge_accounts;
create trigger trg_delete_trades_for_challenge_account
  before delete on public.challenge_accounts
  for each row execute function public.delete_trades_for_challenge_account();

create or replace function public.delete_trades_for_funded_account()
returns trigger
language plpgsql
as $$
begin
  delete from public.trades
  where account_id = old.id
    and account_type = 'funded';
  return old;
end;
$$;

drop trigger if exists trg_delete_trades_for_funded_account on public.funded_accounts;
create trigger trg_delete_trades_for_funded_account
  before delete on public.funded_accounts
  for each row execute function public.delete_trades_for_funded_account();
