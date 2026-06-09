# Site Evaluation — June 2026 (Playwright)

Driven with Playwright against the **live site** (`https://wc2026predict.vercel.app`) plus an
isolated local component preview. Desktop (1366px) and mobile (390px). The app is in its
**pre-tournament** state: 104 real fixtures synced, all kickoffs in the future, group + knockout
predictions open (knockout intentionally gated until the group stage ends).

## What was investigated first: "saved score/bracket can't change"

The reported symptom was that a saved pick couldn't be changed. **Functionally it can** — verified
end-to-end by signing in as a guest, saving a match pick `2–1`, reloading (showed `2–1`), changing
it to `3–0`, and reloading again (persisted `3–0`). All write paths (`/api/predictions`,
`/api/group-predictions`, `/api/bracket-predictions`) already `upsert` on `(user_id, match_id)`.

The real problems behind the perception:

1. **Hydration errors on every page (React #418 / #425 / #423).** `lib/format.ts::formatKickoff`
   formatted kickoff times with no fixed `timeZone`, so the server (UTC) and the browser rendered
   different strings. For any visitor outside UTC, React tore down the server HTML and re-rendered
   client-side on load — flicker and flaky-feeling interactions. (`components/MatchBoard.tsx` already
   pinned a timezone for day grouping; the per-card formatter did not.)
2. **Weak edit affordance.** Once saved, the control showed a disabled `✓ Saved` button — it read as
   *locked*, with no signal that the pick was still editable.
3. **Tiny inputs.** Score entry used small −/+ steppers, the opposite of the large, tappable score
   boxes the user wanted (ref: akiloyunu.com/games/predict).

## Page-by-page findings

| Page | State | Notes |
|------|-------|-------|
| `/` Match Picks | OK, but heavy | **Home page was ~20,000px tall** — all 104 matches rendered at once in "Upcoming". |
| `/tournament` Group | Good | 12 group cards, 3-col grid, editable 1→4 order. Had a manual Save button. |
| `/tournament/knockout` | Correct | "Locked until the group stage ends" overlay (expected pre-tournament). |
| `/bracket` Results | Good | Read-only actual knockout tree. |
| `/leaderboard`, `/tournament/leaderboard` | Good | Clean tables. |
| Mobile | Good | Cards reflow to one column; bracket scales to fit. |

## Changes shipped in this pass

- **Hydration fix** — kickoff times render in the **viewer's local timezone** (the previous
  behavior) but hydration-safely: `components/KickoffTime.tsx` renders a fixed-timezone string
  (`lib/format.ts`, ET) during SSR and the first client paint, then swaps to local time right after
  mount. SSR and first-paint markup are identical, so the React #418/#425/#423 errors are gone.
  Verified: server sent `Sat 06 Jun, 20:07 ET`; in an Istanbul-tz browser it became
  `Sun, Jun 07, 03:07` with zero hydration errors.
- **MatchCard redesign** (`components/MatchCard.tsx`) — large "scoreboard" score boxes with ▲/▼
  chevron steppers (still typeable), a **live countdown-to-lock chip** (`⏳ 2d 11h`, client-only so
  it's hydration-safe), and **debounced auto-save** (650ms) with an explicit status line
  (`Saving… → ✓ Saved · change anytime`). The "Saved" state now says picks are editable instead of
  looking locked.
- **GroupPredictor** (`components/GroupPredictor.tsx`) — same auto-save + status treatment
  (`✓ Saved · reorder anytime`); removed the manual Save button for consistency.
- **Shorter home** (`components/MatchBoard.tsx`) — Upcoming/Results reveal day groups incrementally
  ("Show more days · N left") and the grid is denser (3 columns on large screens).

Verification: `tsc --noEmit` clean, `next build` succeeds, autosave POST + status transition
confirmed via Playwright network interception on a component preview.

## Recommended follow-ups (not done here)

- **Autosave failure UX.** On a failed save the boxes keep the new value but the row only shows an
  error; consider a retry affordance or revert-to-saved.
- **Bracket/group live tables** polish from the older `UI-REPORT.md` backlog still applies.
- **Deploy + re-test on the live URL** — these changes were validated locally (the live site still
  runs the previous build).
