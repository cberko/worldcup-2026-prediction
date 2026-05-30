// Generate a random but structurally-valid World Cup 2026 outcome.
// Fetches the real 2026 fixtures + group line-ups from football-data, simulates
// random group results → qualifiers → R32 assignment → knockout cascade → champion.
// Writes sim/fixtures.json (open/pre-tournament state) and sim/results.json (the "truth").
//
//   FOOTBALL_DATA_TOKEN=xxx node sim/generate.mjs
import { writeFileSync } from "node:fs";

const TOKEN = process.env.FOOTBALL_DATA_TOKEN;
if (!TOKEN) throw new Error("set FOOTBALL_DATA_TOKEN");
const BASE = "https://api.football-data.org/v4/competitions/WC";

// --- FIFA 2026 bracket adjacency (match numbers) — mirrors lib/bracket.ts ---
const STAGE_BASE = {
  LAST_32: { base: 73, count: 16 },
  LAST_16: { base: 89, count: 8 },
  QUARTER_FINALS: { base: 97, count: 4 },
  SEMI_FINALS: { base: 101, count: 2 },
  THIRD_PLACE: { base: 103, count: 1 },
  FINAL: { base: 104, count: 1 },
};
const ADJ = {
  89: [74, 77], 90: [73, 75], 91: [76, 78], 92: [79, 80],
  93: [83, 84], 94: [81, 82], 95: [86, 88], 96: [85, 87],
  97: [89, 90], 98: [93, 94], 99: [91, 92], 100: [95, 96],
  101: [97, 98], 102: [99, 100], 104: [101, 102],
};

const rint = (n) => Math.floor(Math.random() * n);
const goals = () => rint(4); // 0..3

async function fd(path) {
  const r = await fetch(`${BASE}${path}`, { headers: { "X-Auth-Token": TOKEN } });
  if (!r.ok) throw new Error(`football-data ${r.status} ${path}`);
  return r.json();
}

const { matches } = await fd("/matches");
const groupMatches = matches.filter((m) => m.stage === "GROUP_STAGE");
const koMatches = matches.filter((m) => m.stage !== "GROUP_STAGE");

// number knockout matches by per-stage id order (same rule as the app)
const num2id = {};
for (const [stage, info] of Object.entries(STAGE_BASE)) {
  koMatches
    .filter((m) => m.stage === stage)
    .sort((a, b) => a.id - b.id)
    .forEach((m, i) => (num2id[info.base + i] = String(m.id)));
}

// ---------- simulate group stage ----------
const teamsByGroup = {}; // GROUP_A -> { team: {pts,gd,gf} }
const results = { groupStandings: {}, matches: {} };

for (const m of groupMatches) {
  const g = m.group;
  const home = m.homeTeam?.name ?? "TBD";
  const away = m.awayTeam?.name ?? "TBD";
  const hs = goals();
  const as = goals();
  results.matches[String(m.id)] = {
    stage: "GROUP_STAGE",
    home,
    away,
    home_score: hs,
    away_score: as,
    winner: hs > as ? "HOME" : as > hs ? "AWAY" : null,
  };
  teamsByGroup[g] ??= {};
  for (const [t, gf, ga] of [[home, hs, as], [away, as, hs]]) {
    teamsByGroup[g][t] ??= { pts: 0, gd: 0, gf: 0 };
    teamsByGroup[g][t].gf += gf;
    teamsByGroup[g][t].gd += gf - ga;
  }
  teamsByGroup[g][home].pts += hs > as ? 3 : hs === as ? 1 : 0;
  teamsByGroup[g][away].pts += as > hs ? 3 : hs === as ? 1 : 0;
}

const cmp = (a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || (Math.random() - 0.5);
const groupOrder = {}; // GROUP_A -> [t1,t2,t3,t4]
const thirds = [];
for (const [g, tbl] of Object.entries(teamsByGroup)) {
  const ordered = Object.entries(tbl)
    .map(([team, s]) => ({ team, ...s }))
    .sort(cmp);
  groupOrder[g] = ordered.map((x) => x.team);
  results.groupStandings[g] = ordered.map((x) => ({ team: x.team, played: 3, points: x.pts, gd: x.gd }));
  thirds.push({ ...ordered[2], group: g });
}
// best 8 third-placed teams
thirds.sort(cmp);
const bestThirds = thirds.slice(0, 8).map((x) => x.team);

// 32 qualifiers: winners, runners-up, best thirds
const winners = Object.values(groupOrder).map((o) => o[0]);
const runners = Object.values(groupOrder).map((o) => o[1]);
const qualifiers = [...winners, ...runners, ...bestThirds]; // 12 + 12 + 8 = 32

// assign qualifiers to R32 slots (#73..88) — arbitrary-but-valid pairing for the sim
const r32Teams = {}; // matchNumber -> {home, away}
for (let i = 0; i < 16; i++) {
  r32Teams[73 + i] = { home: qualifiers[i * 2], away: qualifiers[i * 2 + 1] };
}

// ---------- simulate knockout cascade ----------
const koWinner = {}; // matchNumber -> team name
function playKO(num, home, away) {
  let hs = goals();
  let as = goals();
  if (hs === as) hs += 1; // no draws in knockout — give home the edge
  const winnerSide = hs > as ? "HOME" : "AWAY";
  const team = winnerSide === "HOME" ? home : away;
  results.matches[num2id[num]] = {
    stage: stageOf(num),
    home,
    away,
    home_score: hs,
    away_score: as,
    winner: winnerSide,
  };
  koWinner[num] = team;
  return team;
}
function stageOf(num) {
  if (num <= 88) return "LAST_32";
  if (num <= 96) return "LAST_16";
  if (num <= 100) return "QUARTER_FINALS";
  if (num <= 102) return "SEMI_FINALS";
  if (num === 103) return "THIRD_PLACE";
  return "FINAL";
}

// R32
for (let n = 73; n <= 88; n++) playKO(n, r32Teams[n].home, r32Teams[n].away);
// R16, QF, SF, Final via adjacency
for (const n of [89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 104]) {
  const [f1, f2] = ADJ[n];
  playKO(n, koWinner[f1], koWinner[f2]);
}
// third place (SF losers)
const sfLosers = [101, 102].map((n) => {
  const [f1, f2] = ADJ[n];
  const fin = koWinner[n];
  return koWinner[f1] === fin ? koWinner[f2] : koWinner[f1];
});
playKO(103, sfLosers[0], sfLosers[1]);

const champion = koWinner[104];

// ---------- fixtures.json (open / pre-tournament state) ----------
const STAGE_NORM = {
  GROUP_STAGE: "GROUP_STAGE", LAST_32: "LAST_32", LAST_16: "LAST_16",
  QUARTER_FINALS: "QUARTER_FINALS", SEMI_FINALS: "SEMI_FINALS",
  THIRD_PLACE: "THIRD_PLACE", FINAL: "FINAL",
};
const fixtures = matches.map((m) => {
  const ko = m.stage !== "GROUP_STAGE";
  return {
    id: String(m.id),
    stage: STAGE_NORM[m.stage] ?? "GROUP_STAGE",
    group_name: m.group ? m.group.toUpperCase().replace(/\s+/g, "_") : null,
    matchday: m.matchday ?? null,
    home_team: ko ? "TBD" : (m.homeTeam?.name ?? "TBD"),
    away_team: ko ? "TBD" : (m.awayTeam?.name ?? "TBD"),
    home_crest: ko ? null : (m.homeTeam?.crest ?? null),
    away_crest: ko ? null : (m.awayTeam?.crest ?? null),
    kickoff: m.utcDate,
    status: "TIMED",
    home_score: null, away_score: null, result: null, winner: null,
  };
});

// group_standings open state: the 4 teams per group, ordered by football-data seeding
const { standings } = await fd("/standings");
const groupStandingsOpen = standings
  .filter((s) => s.type === "TOTAL" && s.group)
  .map((s) => ({
    group_name: s.group.toUpperCase().replace(/\s+/g, "_"),
    standings: s.table.map((r, i) => ({ position: i + 1, team: r.team.name, played: 0, points: 0, gd: 0 })),
  }));

writeFileSync(new URL("./fixtures.json", import.meta.url), JSON.stringify({ fixtures, groupStandingsOpen }, null, 2));
writeFileSync(new URL("./results.json", import.meta.url), JSON.stringify({ ...results, num2id, champion }, null, 2));

console.log(`Generated. Champion: ${champion}`);
console.log(`Group winners: ${winners.join(", ")}`);
console.log(`Files: sim/fixtures.json, sim/results.json`);
