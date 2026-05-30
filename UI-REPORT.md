# UI Review & Beautify Report

Reviewed the live app via Playwright (`sim/screens/*.png`, desktop 1366px + mobile 390px) in the
post-tournament sim state. Match Picks is in good shape; the **Bracket screen and Group prediction
panel are the weak points**. Below: each issue you raised, the current state, and the proposed fix —
then a design pass.

---

## 1. Match Picks — sort order of played vs unplayed
**Now:** *Upcoming* groups unplayed matches nearest→furthest (good). *All matches* lists everything
strictly ascending by kickoff, so finished games sit at the top in old→new order.

**Want:** unplayed = nearest date first (keep); **played = most-recently-played first** (new→old).

**Fix:** in `components/MatchBoard.tsx`
- Keep *Upcoming* as is (not-finished, ascending day groups).
- Add a **Results** view (or split *All*): finished matches sorted **descending** by kickoff,
  grouped by day (newest day on top). Cleanest is a third tab: **Upcoming · Results · All**, where
  Results = `status==='FINISHED'` sorted desc. This directly matches “what just happened” at a glance.

---

## 2. Bracket screen — the main problem
**Observed (`03-tournament.png`, `04-tournament-mobile.png`):**
- The knockout tree is a row of equal-height columns with **empty boxes** to the right (later rounds
  show nothing until you pick). It reads as broken/sparse rather than “to be filled”.
- **No connector lines** between rounds, so it doesn’t feel like a bracket — just stacked lists.
- Vertical rhythm is off: R32 has 16 tall items, later rounds float at the top leaving big empty space.
- **Doesn’t fit** comfortably — 5 columns + sticky header force horizontal scroll on laptop and it’s
  cramped on mobile (the whole page is extremely tall).
- Prediction tree and **actual results are mixed into one place**; you asked to separate them.

**Proposed structure:**
- **Two distinct surfaces:**
  - **Bracket → Predict** (`/tournament`): the interactive tree you fill (your picks).
  - **Bracket → Results** (`/bracket`, already exists): the *actual* knockout outcomes, read-only.
  Make this split obvious in the Bracket sub-nav (it’s already there as “Results” — lean into it).
- **A real bracket visual** for the predict tree:
  - SVG/CSS **connector lines** joining each pair of feeders to their next-round slot.
  - **Vertically center** each round’s slots between their two feeders (classic bracket spacing) so
    the tree reads diagonally inward to a single Champion node.
  - Empty downstream slots become **“Winner of M73” placeholder chips** (intentional, not blank).
  - A prominent **Champion** node at the right with a trophy + gold glow.
- **Fit:** cap the on-screen tree to a horizontally-scrollable rail with a faded edge + “scroll”
  affordance; on mobile, switch to a **round-by-round stepper** (tabs: R32/R16/QF/SF/Final) instead of
  the full tree, so each round is a clean single column.

---

## 3. Group prediction → live POINTS TABLE (not a list)
**Observed:** each group is a plain ordered list of 4 teams with up/down arrows; once locked it just
shows the order. No actual standings, no points, no right/wrong feedback.

**Want / Proposed:** turn each group card into a **live standings table**:
- Columns: `#  ·  Team  ·  P (played)  ·  Pts` (optionally GD), reflecting **actual** results as they come in.
- Overlay the user’s **predicted** order; mark each row **green if the team’s real finishing position
  matches your prediction, red if not** (per-position, matching the +1 scoring).
- Before kickoff it’s the editable predictor; after results it becomes the scored table with the
  green/red marks and the `+N pts` chip — same card, two phases.
- Data: actual standings already live in `group_standings` (synced); join with `group_predictions`.

---

## 4. Design beautify pass (frontend-design lens)
The dark “broadcast/dossier” theme (Anton + Hanken + Space Mono, grain, green/gold) is solid — keep
it. Targeted upgrades:

- **Bracket as the hero artifact.** Give it connectors, depth (subtle inner shadows on slots), and a
  gold champion finale. This is the screen people screenshot — make it the memorable one.
- **Group tables:** tighten to mono numerals for P/Pts (`.tnum`), thin row dividers, a left accent bar
  on row 1–2 (qualifiers) vs 3–4 (out), and green/red placement dots.
- **Match Picks Results:** show the actual scoreline big (mono) with a subtle “FT” tag and your pick +
  earned points as a compact gold/red chip; finished cards slightly dimmed vs open ones.
- **Motion:** stagger-in per day/round on load (you already have `animate-fade-up`); add a gold pulse
  when a pick is saved and a brief confetti/flag flourish on the Champion node.
- **Density:** the tournament page is very long — collapse groups into a 3-col grid of compact tables
  and let the bracket own the vertical space.

---

## Suggested priority
1. **Bracket redesign** (connectors + vertical centering + champion + mobile stepper) — biggest impact.
2. **Group live points table** with green/red marking.
3. **Match Picks Results view** (played newest-first).
4. Polish pass (motion, dimming, mono numerals).

> Also worth shipping regardless: the **fetch-cache fix** already made locally (`lib/supabase/admin.ts`
> + `server.ts` now use `cache:'no-store'`) — it fixes stale reads in the production cron.
