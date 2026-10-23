-- Local PostgreSQL-only test fixture, never run on production.
do $ begin create role authenticated nologin; exception when duplicate_object then null; end $;
do $ begin create role anon nologin; exception when duplicate_object then null; end $;
create schema auth;
create table auth.users (
 id uuid primary key,
 email text,
 email_confirmed_at timestamptz
);
create or replace function auth.uid() returns uuid
 language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
 $$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
create table public.challenge_accounts(
 id uuid primary key, user_id uuid not null references auth.users(id),
 account_name text not null, status text not null, account_size numeric not null
);
create table public.funded_accounts(
 id uuid primary key, user_id uuid not null references auth.users(id),
 account_name text not null, status text not null, account_size numeric not null,
 current_balance numeric not null
);
create table public.trades(
 id uuid primary key, user_id uuid not null references auth.users(id),
 account_id uuid not null, account_type text not null,
 symbol text not null, entry_date date not null, pnl numeric not null, status text not null
);
create table public.payouts(
 id uuid primary key, user_id uuid not null references auth.users(id),
 funded_account_id uuid not null, payout_date date not null,
 requested_amount numeric not null, received_amount numeric not null, status text not null
);
alter table public.challenge_accounts enable row level security;
alter table public.funded_accounts enable row level security;
alter table public.trades enable row level security;
alter table public.payouts enable row level security;
create policy own_challenges on public.challenge_accounts for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy own_funded on public.funded_accounts for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy own_trades on public.trades for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy own_payouts on public.payouts for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,insert,update,delete on public.challenge_accounts,public.funded_accounts,public.trades,public.payouts to authenticated;
insert into auth.users values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','alice@example.com',now()),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bob@example.com',now()),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','charlie@example.com',now());
insert into public.challenge_accounts values
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Alice Challenge','active',50000),
 ('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Alice Private','active',100000);
insert into public.funded_accounts values
 ('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Alice Funded','active',50000,52000);
insert into public.trades values
 ('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','challenge','XAUUSD',current_date,500,'win'),
 ('55555555-5555-4555-8555-555555555555','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','challenge','NAS100',current_date,600,'win'),
 ('66666666-6666-4666-8666-666666666666','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333','funded','XAUUSD',current_date,700,'win');
insert into public.payouts values
 ('77777777-7777-4777-8777-777777777777','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333',current_date,1000,800,'paid');
