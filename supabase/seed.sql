-- ============================================================================
-- Sample data for LOCAL TESTING (run AFTER schema.sql).
-- Lets you try the full flow without the football-data API:
--   • finished matches → test scoring (run GET /api/dev/rescore afterwards)
--   • open matches     → test making/editing picks
--   • a locked match   → see the kickoff lock in action
-- Kickoff times are relative to load time (now()), so they stay realistic.
-- Re-runnable (upserts). Flags via flagcdn.com.
-- ============================================================================

insert into public.matches
  (id, stage, group_name, matchday, home_team, home_crest, away_team, away_crest,
   kickoff, status, home_score, away_score, result, winner)
values
  -- FINISHED group games (for scoring tests)
  ('seed-1', 'GROUP_STAGE', 'GROUP A', 1, 'Mexico', 'https://flagcdn.com/w80/mx.png',
   'South Africa', 'https://flagcdn.com/w80/za.png',
   now() - interval '2 days', 'FINISHED', 2, 1, '1', 'HOME'),

  ('seed-2', 'GROUP_STAGE', 'GROUP B', 1, 'Canada', 'https://flagcdn.com/w80/ca.png',
   'Croatia', 'https://flagcdn.com/w80/hr.png',
   now() - interval '1 day', 'FINISHED', 1, 1, 'X', null),

  -- LOCKED but not finished (kickoff already passed) — shows the lock
  ('seed-3', 'GROUP_STAGE', 'GROUP C', 2, 'Argentina', 'https://flagcdn.com/w80/ar.png',
   'Japan', 'https://flagcdn.com/w80/jp.png',
   now() - interval '20 minutes', 'TIMED', null, null, null, null),

  -- OPEN games (make / edit a prediction here)
  ('seed-4', 'GROUP_STAGE', 'GROUP D', 2, 'Brazil', 'https://flagcdn.com/w80/br.png',
   'Morocco', 'https://flagcdn.com/w80/ma.png',
   now() + interval '3 hours', 'TIMED', null, null, null, null),

  ('seed-5', 'GROUP_STAGE', 'GROUP E', 3, 'France', 'https://flagcdn.com/w80/fr.png',
   'USA', 'https://flagcdn.com/w80/us.png',
   now() + interval '1 day', 'SCHEDULED', null, null, null, null),

  -- A finished KNOCKOUT game — flat scoring applies the same here
  ('seed-6', 'LAST_16', null, null, 'Spain', 'https://flagcdn.com/w80/es.png',
   'Portugal', 'https://flagcdn.com/w80/pt.png',
   now() - interval '6 hours', 'FINISHED', 3, 2, '1', 'HOME'),

  -- Open final (future)
  ('seed-7', 'FINAL', null, null, 'Germany', 'https://flagcdn.com/w80/de.png',
   'Netherlands', 'https://flagcdn.com/w80/nl.png',
   now() + interval '20 days', 'SCHEDULED', null, null, null, null)

on conflict (id) do update set
  stage = excluded.stage,
  group_name = excluded.group_name,
  matchday = excluded.matchday,
  home_team = excluded.home_team,
  home_crest = excluded.home_crest,
  away_team = excluded.away_team,
  away_crest = excluded.away_crest,
  kickoff = excluded.kickoff,
  status = excluded.status,
  home_score = excluded.home_score,
  away_score = excluded.away_score,
  result = excluded.result,
  winner = excluded.winner,
  updated_at = now();
