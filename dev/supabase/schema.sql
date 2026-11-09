-- High & Low accounts: coins, wins and look follow the signed-in player.
-- Players can only read and edit their own row. Coins and wins change only
-- through claim_win() and spend_coins(), never by direct update.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Player' check (char_length(name) between 1 and 12),
  coins integer not null default 0 check (coins >= 0),
  wins integer not null default 0 check (wins >= 0),
  look jsonb,
  last_win_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id and coins = 0 and wins = 0);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Only name and look can be written directly.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, name, look) on public.profiles to authenticated;
grant update (name, look) on public.profiles to authenticated;

-- Each finished game can pay out once.
create table if not exists public.claimed_wins (
  game_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  claimed_at timestamptz not null default now()
);
alter table public.claimed_wins enable row level security;
revoke all on public.claimed_wins from anon, authenticated;

-- +1 win and +5 coins for a game id not claimed before, at most once a minute.
create or replace function public.claim_win(p_game text)
returns public.profiles
language plpgsql security definer set search_path = public
as $$
declare r public.profiles;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_game is null or length(p_game) < 4 or length(p_game) > 64 then raise exception 'bad game id'; end if;
  select * into r from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'no profile'; end if;
  if r.last_win_at is not null and r.last_win_at > now() - interval '60 seconds' then return r; end if;
  insert into public.claimed_wins(game_id, user_id) values (p_game, auth.uid()) on conflict do nothing;
  if not found then return r; end if;
  update public.profiles
     set wins = wins + 1, coins = coins + 5, last_win_at = now(), updated_at = now()
   where id = auth.uid()
  returning * into r;
  return r;
end $$;

-- Spend coins on a power. Fails if the balance is too low.
create or replace function public.spend_coins(p_amount integer)
returns public.profiles
language plpgsql security definer set search_path = public
as $$
declare r public.profiles;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 20 then raise exception 'bad amount'; end if;
  update public.profiles
     set coins = coins - p_amount, updated_at = now()
   where id = auth.uid() and coins >= p_amount
  returning * into r;
  if not found then raise exception 'not enough coins'; end if;
  return r;
end $$;

revoke all on function public.claim_win(text) from public, anon;
revoke all on function public.spend_coins(integer) from public, anon;
grant execute on function public.claim_win(text) to authenticated;
grant execute on function public.spend_coins(integer) to authenticated;
