-- ============================================================================
-- Mode 2 — Tournament Predictor (Bracket Challenge)
-- Adds group-standings predictions (+1 per correct placement) and knockout
-- bracket predictions (R32 +2 → champion +32). Independent of Mode 1.
-- Safe to re-run.
-- ============================================================================

-- Actual final group tables, synced from football-data /standings
create table if not exists public.group_standings (
  group_name text primary key,                 -- e.g. "Group A"
  standings  jsonb not null default '[]',       -- [{ "position": 1, "team": "Mexico" }, ...]
  final      boolean not null default false,     -- true once the whole group stage is FINISHED
  updated_at timestamptz not null default now()
);

-- A user's predicted 1→4 ordering for a group
create table if not exists public.group_predictions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  group_name     text not null,
  predicted      jsonb not null,                -- ["team@1","team@2","team@3","team@4"]
  points_awarded int,                           -- null = not scored; else 0..4 (+1 per correct position)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, group_name)
);

-- A user's predicted advancing team for one knockout match
create table if not exists public.bracket_predictions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  match_id       text not null references public.matches(id) on delete cascade,
  predicted_team text not null,
  points_awarded int,                           -- null = not scored; else 0 or stage points
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, match_id)
);

create index if not exists group_predictions_user_idx on public.group_predictions (user_id);
create index if not exists bracket_predictions_user_idx on public.bracket_predictions (user_id);
create index if not exists bracket_predictions_match_idx on public.bracket_predictions (match_id);

-- Mode 2 leaderboard: group points + bracket points (separate from Mode 1)
create or replace view public.tournament_leaderboard as
  select
    p.id                                         as user_id,
    p.display_name,
    coalesce(gp.pts, 0)::int                     as group_points,
    coalesce(bp.pts, 0)::int                     as bracket_points,
    (coalesce(gp.pts, 0) + coalesce(bp.pts, 0))::int as total_points
  from public.profiles p
  left join (
    select user_id, sum(points_awarded) as pts from public.group_predictions group by user_id
  ) gp on gp.user_id = p.id
  left join (
    select user_id, sum(points_awarded) as pts from public.bracket_predictions group by user_id
  ) bp on bp.user_id = p.id;

-- ---------------- RLS ----------------
alter table public.group_standings     enable row level security;
alter table public.group_predictions   enable row level security;
alter table public.bracket_predictions enable row level security;

drop policy if exists "group_standings read all" on public.group_standings;
create policy "group_standings read all" on public.group_standings for select using (true);

drop policy if exists "group_predictions read all" on public.group_predictions;
create policy "group_predictions read all" on public.group_predictions for select using (true);
drop policy if exists "group_predictions insert own" on public.group_predictions;
create policy "group_predictions insert own" on public.group_predictions
  for insert with check (auth.uid() = user_id);
drop policy if exists "group_predictions update own" on public.group_predictions;
create policy "group_predictions update own" on public.group_predictions
  for update using (auth.uid() = user_id);

drop policy if exists "bracket_predictions read all" on public.bracket_predictions;
create policy "bracket_predictions read all" on public.bracket_predictions for select using (true);
drop policy if exists "bracket_predictions insert own" on public.bracket_predictions;
create policy "bracket_predictions insert own" on public.bracket_predictions
  for insert with check (auth.uid() = user_id);
drop policy if exists "bracket_predictions update own" on public.bracket_predictions;
create policy "bracket_predictions update own" on public.bracket_predictions
  for update using (auth.uid() = user_id);
