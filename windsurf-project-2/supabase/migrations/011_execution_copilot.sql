-- Execution Desk: user-confirmed (not broker-executed) trades and audit events.
create table if not exists public.execution_positions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 symbol text not null check (symbol='XAU/USD'), timeframe text not null,
 side smallint not null check (side in (-1,1)),
 title text not null, entry numeric not null check (entry>0),
 sl numeric not null check (sl>0), tp numeric not null check (tp>0),
 reason text not null default '', source_candle_time bigint,
 status text not null default 'open' check (status in ('open','closed')),
 committed_at timestamptz not null default now(), closed_at timestamptz,
 last_checked_at timestamptz, last_candle_time bigint,
 constraint execution_stop_direction check ((side=1 and sl<entry and tp>entry) or (side=-1 and sl>entry and tp<entry))
);
create unique index if not exists execution_one_open_per_user on public.execution_positions(user_id) where status='open';
create index if not exists execution_positions_open_idx on public.execution_positions(status,committed_at);
alter table public.execution_positions enable row level security;
create policy execution_positions_select_own on public.execution_positions for select using (auth.uid()=user_id);
create policy execution_positions_insert_own on public.execution_positions for insert with check (auth.uid()=user_id);
create policy execution_positions_update_own on public.execution_positions for update using (auth.uid()=user_id);
create table if not exists public.execution_alerts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 position_id uuid not null references public.execution_positions(id) on delete cascade,
 candle_time bigint not null,
 kind text not null check(kind in ('stop_touched','target_touched','both_touched','structure_warning')),
 message text not null,
 created_at timestamptz not null default now(),
 unique(position_id,candle_time,kind)
);
create index if not exists execution_alerts_position_idx on public.execution_alerts(position_id,created_at desc);
alter table public.execution_alerts enable row level security;
create policy execution_alerts_select_own on public.execution_alerts for select using(auth.uid()=user_id);
-- Alerts only written by trusted server; authenticated users cannot forge these events.
