-- High & Low anonymous play statistics. Write-only from the game; read it in the Supabase dashboard.
create table if not exists public.events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  ev text not null check (ev in ('open','play_tap','host','join','practice','game_start','game_end','leave','power','again','ad','noads')),
  sid text not null check (sid ~ '^[a-z0-9]{12}$'),
  props jsonb not null default '{}'::jsonb check (pg_column_size(props) < 400)
);
create index if not exists events_at_idx on public.events (at);
create index if not exists events_ev_at_idx on public.events (ev, at);
alter table public.events enable row level security;
drop policy if exists "events: insert only" on public.events;
create policy "events: insert only" on public.events for insert to anon, authenticated with check (true);
revoke all on public.events from anon, authenticated;
grant insert (ev, sid, props) on public.events to anon, authenticated;

-- Daily numbers: players, games, average length, how many leave early.
create or replace view public.stats_daily with (security_invoker = true) as
select date_trunc('day', at)::date as day,
  count(distinct sid) as players,
  count(*) filter (where ev = 'open') as opens,
  count(*) filter (where ev = 'play_tap') as play_taps,
  count(*) filter (where ev = 'game_start') as games_started,
  count(*) filter (where ev = 'game_end') as games_finished,
  count(*) filter (where ev = 'leave') as left_early,
  round(avg((props->>'secs')::int) filter (where ev = 'game_end')) as avg_game_secs,
  count(*) filter (where ev = 'power') as powers_used
from public.events group by 1 order by 1 desc;
revoke all on public.stats_daily from anon, authenticated;
