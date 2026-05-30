# UI improvement notes (from user feedback)

Captured during the local simulation — to implement later.

## 1. Match Picks — hide undetermined (TBD) knockout matches
Knockout matches whose teams aren't known yet (`home_team`/`away_team` = `"TBD"`) should
**not** appear in Match Picks (Upcoming or All) — you can't predict a score for "TBD vs TBD".
Show a knockout match only once its teams are set (i.e. after the previous round is played).
e.g. on June 28 the later rounds (R16/QF/…) should still be hidden until their teams exist.
→ Filter `home_team !== "TBD" && away_team !== "TBD"` in `components/MatchBoard.tsx`.

## 2. Group Standings → live POINTS TABLE with correct/wrong marking
Today the group section is just a reorderable 1–4 list. It should become a **live points table**:
- show the **actual** current standings as group matches are played (played, points, maybe GD),
- alongside the user's **predicted** order,
- mark each placement **green if correct**, **red if wrong** (per position),
- not only a ranking — a real standings/points panel that updates with results.
Example: in Group A we predicted Czechia, South Africa, South Korea, Mexico; once the first
matches are played, show the real table and color the user's hits/misses.

## 3. Bracket mode — live points table + show current predictions
The Bracket view should also surface a **live points/standings table** and the user's **current
bracket predictions inline** (not only the interactive builder). i.e. a points panel within the
Bracket section, like a scoreboard, showing what you picked and what you've earned so far.
