# High & Low analytics guide (one page)

No names, no emails, no room codes are stored. Each phone has a random 12-character id, and every row is a small event with numbers and short codes. Test tabs (`#player=`) send nothing.

## One-time setup
1. Supabase dashboard, your project, **SQL Editor**, **New query**.
2. If the table `events` is new, paste and run `supabase/events.sql` first.
3. Paste all of `supabase/events_v2.sql` and press **Run**. It is safe to run again. If the editor warns about "drop constraint", choose to run it anyway: it only swaps the list of allowed event names for the longer one and deletes no rows.
4. Ship a build that contains the new tracking code. Until then the new views show only the old events.

## Where to look
Dashboard, **Table Editor**, the table list on the left, section **Views** (open "Views" in the schema dropdown if you only see tables). Click a view to see it as a grid. Days are UTC. The newest day is on top. Only you can read them: the game's key can write rows and nothing else.

| View | What it answers |
|---|---|
| `stats_daily` | Players, opens, games started and finished, leaves, average game length per day |
| `funnel_daily` | Opened, tapped Play, started a game, finished a game (unique phones), plus `new_players` |
| `retention` | By first-seen day: how many came back the next day (d1), day 3, day 7. Percent stays empty until that day is over |
| `modes_daily` | Per mode (s = 1-100, m = 1-10000, l = 1-100000): Play taps, games, leaves, gave up waiting, Play again |
| `match_wait` | Median and 90th percentile wait for an opponent, share of real opponents vs fill-in bots |
| `duel_length` | Median turns and seconds per finished duel, win percent |
| `rating_buckets` | Where ratings sit (rounded to 100) and win rate per bucket |
| `ads_daily` | Ads shown, closed, failed, Remove Ads taps and purchases (app only) |
| `opens_daily` | Opens per day split app vs web, build code, first-ever open vs returning |

Tip: the grid has a Filter button, and "Export" gives a CSV if you want a spreadsheet.

## The 5 numbers to check every day
1. **New players** (`funnel_daily.new_players`). Goal: 100 total by the end of week one, so about 15 a day on average.
2. **Tapped Play %** (`funnel_daily.pct_tapped_play`). People who open and never press Play are the leak.
3. **Finished %** (`funnel_daily.pct_finished`) together with `modes_daily.left_early`. A finished duel is the real "they got it".
4. **Median wait** (`match_wait.median_wait_secs`) and `pct_real_opponent`. With few players most opponents will be fill-in bots. That is expected, but a long wait loses people (see `modes_daily.gave_up_waiting`).
5. **D1 return %** (`retention.d1_pct`), which needs a full day to pass. This is the best single sign of a game people like.

## Rough benchmarks for a casual mobile game, week one
Marked as rough and from memory, not from a source. Treat them as a sanity check, not a target. With under about 50 players, one person can move any percentage a lot.

| Number | Weak | Okay | Good |
|---|---|---|---|
| Opened -> tapped Play | under 50% | 60-75% | 80%+ |
| Started -> finished a duel | under 60% | 70-80% | 85%+ |
| Wait for opponent (median) | over 15 s | 5-10 s | under 5 s (fill-in bots keep this short) |
| D1 return | under 15% | 20-30% | 35%+ |
| D7 return | under 3% | 5-8% | 10%+ |
| Play again after a duel | rare | about 1 in 3 | about 1 in 2 |
| Ads failed (app) | over 10% | 2-5% | under 2% |

Typical duel length is a design question more than a benchmark. If the median is under 5 turns the game may feel too short, over 20 may feel long.

## What to do with it
- Few opens: the problem is getting people to the link, not the game.
- Many opens, few Play taps: the home screen is not clear. Look at `opens_daily` for web vs app first.
- Many leaves or "gave up waiting": the wait is too long. Fill-in bots can come sooner.
- Good D1 but few new players: the game is fine, spread it. Bad D1: fix the game first.

## Housekeeping
- Version: every row carries the build code `b` (set in `src/track.js`, `HL_VER`). Bump it each release so `opens_daily` shows who is on which build.
- First-ever open vs returning is worked out from each phone's first row. Clearing site data or reinstalling makes a phone look new.
- The bottom of `events_v2.sql` has a commented-out statement that deletes rows older than 180 days. Only run it if you decide you do not need old data.
