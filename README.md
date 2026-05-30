# ⚽ World Cup 2026 — Prediction League

Predict the scoreline of every World Cup 2026 match, earn points, and climb the leaderboard.

- **Every match:** pick a **scoreline** (e.g. `2-1`) — group stage and knockouts alike.
- **Scoring (flat, every round counts the same):**
  - Correct side (winner / draw) → **+5**
  - Correct side **and** (signed) goal difference → **+6**
  - Exact score → **+9**
  - Wrong side → **0** (the difference is signed — a 3–1 pick on a team that lost 1–3 scores nothing)
- Matches are pulled live from the football-data.org API (not static).
- Picks **lock** at kickoff; scores and points **update automatically** after a match finishes.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Postgres + Auth) · Vercel

---

## Quick start: test locally (no deploy needed)

You still need a free Supabase project (for the database + login), but you do **not** need a
football-data token to try the app — sample data is provided.

1. **Create a Supabase project** at [supabase.com](https://supabase.com).
2. **SQL Editor → New query** → paste & run [`supabase/schema.sql`](supabase/schema.sql).
3. In the same editor, run [`supabase/seed.sql`](supabase/seed.sql) to load sample matches
   (finished, open, and a locked one).
4. **Authentication → Sign In / Providers → enable “Anonymous sign-ins.”**
   This powers the one-click **“Continue as guest”** button for testing.
5. Copy env and fill in your Supabase values (the football-data token can stay as a placeholder
   for local testing):
   ```bash
   cp .env.example .env.local
   # set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
   #     SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET (any random string)
   ```
6. Install & run:
   ```bash
   npm install
   npm run dev          # http://localhost:3000
   ```
7. Click **Sign In → Continue as guest**, then try each flow:
   - **Make a pick** on an open match (Brazil–Morocco / France–USA).
   - **Lock:** try to pick on the locked match (Argentina–Japan) — it’s blocked.
   - **Scoring:** to see points land, do this once —
     1. Make a guest pick on an **open** match (say `seed-4`).
     2. In Supabase, edit that row: set `status = 'FINISHED'` and a `home_score`/`away_score`.
     3. Trigger scoring (no API needed):
        ```bash
        curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/dev/rescore
        ```
   - Check **Leaderboard** and **My Picks** — the 5/6/9 points should appear.

---

## Going live: deploy to Vercel

### 1. football-data.org token
Register free at [football-data.org/client/register](https://www.football-data.org/client/register)
and use the API token as `FOOTBALL_DATA_TOKEN`. (Free tier: 10 req/min, World Cup included.)

### 2. Push to GitHub & import to Vercel
[vercel.com](https://vercel.com) → **Add New → Project** → import the repo.

### 3. Set environment variables in Vercel

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key (secret) |
| `FOOTBALL_DATA_TOKEN` | football-data.org token |
| `CRON_SECRET` | a long random string |

### 4. Supabase Auth URLs
**Authentication → URL Configuration:** set Site URL to your Vercel domain and add
`https://your-app.vercel.app/auth/callback` to Redirect URLs.

### 5. Automatic score updates (every 10 min, free)
Vercel Hobby crons run only once/day, so a **GitHub Actions** workflow
([`.github/workflows/sync.yml`](.github/workflows/sync.yml)) pings the sync endpoint frequently.
In your GitHub repo → **Settings → Secrets and variables → Actions**, add:

- `SYNC_URL` = `https://your-app.vercel.app/api/cron/sync`
- `CRON_SECRET` = the **same** value as in Vercel

Run the first sync now: GitHub → **Actions → Sync World Cup matches → Run workflow**.

> Alternative: use [cron-job.org](https://cron-job.org) to hit the same URL with an
> `Authorization: Bearer <CRON_SECRET>` header every few minutes.

---

## How it works

- `app/api/cron/sync` — pulls all matches from football-data, upserts them into `matches`,
  and scores predictions for matches that just finished.
- `app/api/predictions` — saves a predicted scoreline; **rejects on the server** if kickoff has
  passed (the lock).
- `app/api/dev/rescore` — recomputes points for all finished matches from the DB (no API call);
  for local testing.
- The frontend reads from Supabase (fast, no rate limits).
- Scoring lives in `lib/scoring.ts`; match mapping in `lib/footballData.ts`.

## Notes

- The knockout bracket fills in after the group stage ends; `/bracket` may be empty/partial until then.
- football-data’s free tier can lag a little on live scores — a 10-minute sync is plenty.
