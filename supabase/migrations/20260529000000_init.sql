-- ============================================================================
-- World Cup 2026 Prediction — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query → Run).
-- Safe to re-run.
-- ============================================================================

-- ---------- enums ----------
do $$ begin
  create type match_stage as enum (
    'GROUP_STAGE', 'LAST_32', 'LAST_16', 'QUARTER_FINALS',
    'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'
  );
exception when duplicate_object then null; end $$;

-- ---------- profiles ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now()
);

-- ---------- matches (synced from football-data.org by the cron job) ----------
create table if not exists public.matches (
  id          text primary key,                 -- football-data match id
  stage       match_stage not null,
  group_name  text,                              -- e.g. "GROUP A" (null for knockout)
  matchday    int,
  home_team   text not null,
  home_crest  text,
  away_team   text not null,
  away_crest  text,
  kickoff     timestamptz not null,
  status      text not null,                     -- SCHEDULED/TIMED/IN_PLAY/PAUSED/FINISHED...
  home_score  int,
  away_score  int,
  result      text,                              -- '1' | 'X' | '2' (group, when finished)
  winner      text,                              -- 'HOME' | 'AWAY' (knockout, who advances)
  updated_at  timestamptz not null default now()
);

create index if not exists matches_kickoff_idx on public.matches (kickoff);
create index if not exists matches_stage_idx on public.matches (stage);

-- ---------- predictions ----------
create table if not exists public.predictions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  match_id        text not null references public.matches(id) on delete cascade,
  pred_home       int not null check (pred_home between 0 and 99),
  pred_away       int not null check (pred_away between 0 and 99),
  points_awarded  int,                           -- null = not scored yet (0/5/6/7 once scored)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, match_id)
);

create index if not exists predictions_match_idx on public.predictions (match_id);
create index if not exists predictions_user_idx on public.predictions (user_id);

-- ---------- leaderboard view ----------
create or replace view public.leaderboard as
  select
    p.id                                        as user_id,
    p.display_name,
    coalesce(sum(pr.points_awarded), 0)::int    as total_points,
    count(pr.id) filter (where pr.points_awarded > 0)::int as correct_count,
    count(pr.id)::int                           as total_predictions
  from public.profiles p
  left join public.predictions pr on pr.user_id = p.id
  group by p.id, p.display_name;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles    enable row level security;
alter table public.matches     enable row level security;
alter table public.predictions enable row level security;

-- profiles: everyone can read (leaderboard names); user manages own row
drop policy if exists "profiles read all" on public.profiles;
create policy "profiles read all" on public.profiles
  for select using (true);

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update using (auth.uid() = id);

-- matches: public read. Writes only via service role (cron) which bypasses RLS.
drop policy if exists "matches read all" on public.matches;
create policy "matches read all" on public.matches
  for select using (true);

-- predictions: anyone can read (so everyone sees others' picks + leaderboard detail);
-- a user may only create/modify their OWN predictions. The kickoff lock is enforced
-- server-side in the API route (service role), this is the ownership guard.
drop policy if exists "predictions read all" on public.predictions;
create policy "predictions read all" on public.predictions
  for select using (true);

drop policy if exists "predictions insert own" on public.predictions;
create policy "predictions insert own" on public.predictions
  for insert with check (auth.uid() = user_id);

drop policy if exists "predictions update own" on public.predictions;
create policy "predictions update own" on public.predictions
  for update using (auth.uid() = user_id);

-- ============================================================================
-- Auto-create a profile when a new auth user signs up
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
