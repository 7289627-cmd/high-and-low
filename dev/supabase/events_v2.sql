-- High & Low analytics v2. Paste the whole file into the Supabase SQL editor and press Run.
-- Safe to run more than once. It never deletes rows and never drops a table.
-- Run supabase/events.sql first if the table "events" does not exist yet.
--
-- NOTE ON THE EDITOR WARNING: the block below that replaces the CHECK list contains the words
-- "drop constraint". Supabase may show "Potential issue: destructive operation". It only removes
-- the old list of allowed event names and adds the new, longer list right after. No rows are touched.
-- Choose "Run this query" if asked.

-- 1) Allowed event names (this is the one list the test test/track.js reads, keep the format) ----
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.events'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ilike '%ev = any%'
  loop
    execute format('alter table public.events drop constraint %I', c.conname);
  end loop;
  alter table public.events add constraint events_ev_check check (ev in (
    'open','play_tap','host','join','practice','game_start','game_end','leave','power','again','ad','noads',
    'rated','share','qleave','noads_tap','report'
  ));
end $$;

-- 2) Access is NOT touched here: the insert-only policy and the column grants from events.sql stay as they are.

-- 3) Clean rows. Every view reads this one, so a junk row sent by a stranger (the anon key is public)
--    can never break a view: numbers are only parsed when they look like numbers. Dates are UTC.
create or replace view public.events_x with (security_invoker = true) as
select e.id, e.at, (e.at at time zone 'utc')::date as day, e.ev, e.sid,
  case when e.props->>'kind' in ('play','practice','friends') then e.props->>'kind' end as kind,
  case when e.props->>'m' in ('s','m','l') then e.props->>'m'
       when e.props->>'max' = '100' then 's' when e.props->>'max' = '10000' then 'm'
       when e.props->>'max' = '100000' then 'l' end as mode,
  case when e.props->>'secs'  ~ '^[0-9]{1,6}$' then (e.props->>'secs')::int  end as secs,
  case when e.props->>'t'     ~ '^[0-9]{1,3}$' then (e.props->>'t')::int     end as turns,
  case when e.props->>'w'     ~ '^[0-9]{1,3}$' then (e.props->>'w')::int     end as wait_secs,
  case when e.props->>'bots'  ~ '^[0-9]{1,2}$' then (e.props->>'bots')::int  end as bots,
  case when e.props->>'n'     ~ '^[0-9]{1,2}$' then (e.props->>'n')::int     end as players_n,
  case when e.props->>'won'   in ('0','1')     then (e.props->>'won')::int   end as won,
  case when e.props->>'elo'   ~ '^[0-9]{3,4}$' then (e.props->>'elo')::int   end as elo_bucket,
  case when e.props->>'app'   in ('0','1')     then (e.props->>'app')::int   end as app,
  case when e.props->>'inv'   in ('0','1')     then (e.props->>'inv')::int   end as invited,
  case when e.props->>'s'     in ('show','close','fail') then e.props->>'s'  end as ad_state,
  case when e.props->>'b'     ~ '^[0-9a-z.]{1,12}$' then e.props->>'b'       end as build
from public.events e;

-- first time each sid was ever seen (used by retention and new vs returning)
create or replace view public.sid_first with (security_invoker = true) as
select sid, min(at) as first_at, (min(at) at time zone 'utc')::date as first_day,
  (array_agg(id order by at, id))[1] as first_id
from public.events group by sid;

-- 4) Views for the dashboard ------------------------------------------------------------------------
-- Same columns as before, but safe against junk rows. Still one row per day.
create or replace view public.stats_daily with (security_invoker = true) as
select day,
  count(distinct sid) as players,
  count(*) filter (where ev = 'open') as opens,
  count(*) filter (where ev = 'play_tap') as play_taps,
  count(*) filter (where ev = 'game_start') as games_started,
  count(*) filter (where ev = 'game_end') as games_finished,
  count(*) filter (where ev = 'leave') as left_early,
  round(avg(secs) filter (where ev = 'game_end')) as avg_game_secs,
  count(*) filter (where ev = 'power') as powers_used
from public.events_x group by day order by day desc;

-- Open -> Play tap -> game start -> game end, unique players per day (steps are counted per day, not strictly in order)
create or replace view public.funnel_daily with (security_invoker = true) as
select x.day,
  count(distinct x.sid) filter (where x.ev = 'open') as opened,
  count(distinct x.sid) filter (where x.ev = 'play_tap') as tapped_play,
  count(distinct x.sid) filter (where x.ev = 'game_start') as started_game,
  count(distinct x.sid) filter (where x.ev = 'game_end') as finished_game,
  count(distinct x.sid) filter (where x.ev = 'open' and f.first_day = x.day) as new_players,
  round(100.0 * count(distinct x.sid) filter (where x.ev = 'play_tap')
        / nullif(count(distinct x.sid) filter (where x.ev = 'open'), 0), 1) as pct_tapped_play,
  round(100.0 * count(distinct x.sid) filter (where x.ev = 'game_end')
        / nullif(count(distinct x.sid) filter (where x.ev = 'open'), 0), 1) as pct_finished
from public.events_x x join public.sid_first f using (sid)
group by x.day order by x.day desc;

-- Return rate by the day a player was first seen. D1 = came back on exactly the next UTC day.
-- A rate stays empty (null) until that day is fully over.
create or replace view public.retention with (security_invoker = true) as
with d as (select distinct sid, day from public.events_x)
select f.first_day, count(distinct f.sid) as players,
  count(distinct f.sid) filter (where d.day - f.first_day = 1) as back_d1,
  count(distinct f.sid) filter (where d.day - f.first_day = 3) as back_d3,
  count(distinct f.sid) filter (where d.day - f.first_day = 7) as back_d7,
  case when f.first_day + 1 < current_date then round(100.0 * count(distinct f.sid) filter (where d.day - f.first_day = 1) / count(distinct f.sid), 1) end as d1_pct,
  case when f.first_day + 3 < current_date then round(100.0 * count(distinct f.sid) filter (where d.day - f.first_day = 3) / count(distinct f.sid), 1) end as d3_pct,
  case when f.first_day + 7 < current_date then round(100.0 * count(distinct f.sid) filter (where d.day - f.first_day = 7) / count(distinct f.sid), 1) end as d7_pct
from public.sid_first f join d using (sid)
group by f.first_day order by f.first_day desc;

-- Which Play mode people pick (s = 1-100, m = 1-10000, l = 1-100000)
create or replace view public.modes_daily with (security_invoker = true) as
select day, mode,
  count(*) filter (where ev = 'play_tap') as play_taps,
  count(*) filter (where ev = 'game_start' and kind = 'play') as games_started,
  count(*) filter (where ev = 'game_end' and kind = 'play') as games_finished,
  count(*) filter (where ev = 'leave' and kind = 'play') as left_early,
  count(*) filter (where ev = 'qleave') as gave_up_waiting,
  count(*) filter (where ev = 'again') as play_again
from public.events_x
where mode is not null and ev in ('play_tap','game_start','game_end','leave','qleave','again')
group by day, mode order by day desc, mode;

-- How long finding an opponent takes, and how often it is a real player (bots = 0) or a fill-in
create or replace view public.match_wait with (security_invoker = true) as
select day, mode,
  count(*) as matches,
  round(100.0 * count(*) filter (where bots = 0) / count(*), 1) as pct_real_opponent,
  percentile_cont(0.5) within group (order by wait_secs) as median_wait_secs,
  percentile_cont(0.9) within group (order by wait_secs) as p90_wait_secs,
  percentile_cont(0.5) within group (order by wait_secs) filter (where bots = 0) as median_wait_real,
  percentile_cont(0.5) within group (order by wait_secs) filter (where bots > 0) as median_wait_fill
from public.events_x
where ev = 'game_start' and kind = 'play' and wait_secs is not null
group by day, mode order by day desc, mode;

-- How long a finished Play duel lasts (turns and seconds), plus how often the player won
create or replace view public.duel_length with (security_invoker = true) as
select day, mode,
  count(*) as duels,
  percentile_cont(0.5) within group (order by turns) as median_turns,
  percentile_cont(0.9) within group (order by turns) as p90_turns,
  percentile_cont(0.5) within group (order by secs) as median_secs,
  round(100.0 * count(*) filter (where won = 1) / count(*), 1) as pct_won
from public.events_x
where ev = 'game_end' and kind = 'play' and turns is not null
group by day, mode order by day desc, mode;

-- Ratings: where players sit (rounded to 100) after rated games, and win rate per bucket
create or replace view public.rating_buckets with (security_invoker = true) as
select elo_bucket, count(*) as rated_games, count(distinct sid) as players,
  round(100.0 * count(*) filter (where won = 1) / count(*), 1) as pct_won
from public.events_x where ev = 'rated' and elo_bucket is not null
group by elo_bucket order by elo_bucket;

-- Ads (app builds only; old rows without a state count as shown) and Remove Ads
create or replace view public.ads_daily with (security_invoker = true) as
select day,
  count(*) filter (where ev = 'ad' and (ad_state = 'show' or ad_state is null)) as ads_shown,
  count(*) filter (where ev = 'ad' and ad_state = 'close') as ads_closed,
  count(*) filter (where ev = 'ad' and ad_state = 'fail') as ads_failed,
  count(*) filter (where ev = 'noads_tap') as remove_ads_taps,
  count(*) filter (where ev = 'noads') as remove_ads_bought,
  count(*) filter (where ev = 'game_end') as games_finished,
  round(100.0 * count(*) filter (where ev = 'ad' and ad_state = 'fail')
        / nullif(count(*) filter (where ev = 'ad' and ad_state = 'show'), 0), 1) as pct_ads_failed
from public.events_x group by day order by day desc;

-- Opens per day: first-ever open vs returning, app vs web, and build
create or replace view public.opens_daily with (security_invoker = true) as
select x.day, case when x.app = 1 then 'app' else 'web' end as platform, x.build,
  count(*) as opens,
  count(*) filter (where x.id = f.first_id) as first_opens,
  count(*) filter (where x.id <> f.first_id) as returning_opens
from public.events_x x join public.sid_first f using (sid)
where x.ev = 'open'
group by x.day, 2, x.build order by x.day desc, 2, x.build;

-- Only the owner (dashboard / service role) may read the views
revoke all on public.events_x, public.sid_first, public.stats_daily, public.funnel_daily, public.retention,
  public.modes_daily, public.match_wait, public.duel_length, public.rating_buckets, public.ads_daily,
  public.opens_daily from anon, authenticated;

-- 5) OPTIONAL, not run by default: keep only the last 180 days. Remove the leading "-- " to use it.
-- delete from public.events where at < now() - interval '180 days';
