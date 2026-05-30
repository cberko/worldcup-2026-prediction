# 🎮 Local Tournament Simulation

Play a full, randomized World Cup 2026 against the **local** stack — predict, then
fast-forward the tournament stage by stage and watch points land. **100% local, isolated
from production, nothing deployed.**

A random outcome is already generated (`sim/results.json`) and the local DB is seeded with
the open, pre-tournament state. The Next dev server runs at **http://localhost:3300**.

## Play

1. Open **http://localhost:3300** → **Sign In → Continue as guest** (set a name).
2. **Match Picks** (`/`): type score predictions for matches.
3. **Bracket** (`/tournament`): drag-order the 12 groups (Save order). The knockout bracket
   is locked (“opens after the group stage”) until you advance the groups.
4. **Fast-forward** in this terminal (each step finishes a round, scores it, and reveals the
   next round's teams):
   ```bash
   node --env-file=.env.local sim/advance.mjs groups   # → scores group order + group scores, opens R32
   #  ↑ now go predict the BRACKET (R32→champion) before advancing R32 — it locks at R32!
   node --env-file=.env.local sim/advance.mjs r32       # locks bracket, scores R32
   node --env-file=.env.local sim/advance.mjs r16
   node --env-file=.env.local sim/advance.mjs qf
   node --env-file=.env.local sim/advance.mjs sf
   node --env-file=.env.local sim/advance.mjs final
   # or everything at once:
   node --env-file=.env.local sim/advance.mjs all
   ```
5. Watch **Leaderboard** (Match Picks) and **Bracket → Leaderboard** + **My Picks** update.

> Scoring: Match Picks — side +5 · diff +6 · exact +9. Bracket — each group placement +1,
> R32 +2 · R16 +4 · QF +8 · SF +16 · Champion +32.

## Re-roll / reset

```bash
node --env-file=.env.local sim/generate.mjs   # new random tournament (new results.json)
node --env-file=.env.local sim/seed.mjs       # wipe predictions + re-open everything
```

## Start / stop the local stack

```bash
# if the dev server isn't running:
PORT=3300 npm run dev

# local Supabase (Docker) — already running; to stop/remove it entirely:
npx supabase stop
```

## How it works (no app changes for time)

- `generate.mjs` simulates a random tournament respecting the real 2026 fixtures + the FIFA
  bracket tree (`lib/bracket.ts`) → `results.json` (the hidden “truth”).
- `seed.mjs` loads the **open** state (future kickoffs, group teams known, knockout TBD).
- `advance.mjs` reveals one stage at a time: sets those matches FINISHED with their results,
  pushes their kickoff into the past (so locks engage), reveals the next round's matchups,
  then calls `/api/dev/rescore` to score everything — exactly the app's own scoring logic.
