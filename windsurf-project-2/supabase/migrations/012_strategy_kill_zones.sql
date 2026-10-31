alter table public.lab_strategies add column if not exists allowed_kill_zones text[] not null default array['Asian','London','New York']::text[];
alter table public.lab_observations add column if not exists entry_at timestamptz;
alter table public.lab_observations add column if not exists kill_zone text check (kill_zone in ('Asian','London','New York','Outside'));
create index if not exists lab_observations_entry_at_idx on public.lab_observations(strategy_id,entry_at);
