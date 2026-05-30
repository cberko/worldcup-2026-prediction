// Advance the simulated tournament one stage at a time (the "fast-forward").
// Reveals results from sim/results.json into the LOCAL Supabase, opens the next
// round's matchups, then triggers the app's scoring endpoint.
//
//   node --env-file=.env.local sim/advance.mjs <groups|r32|r16|qf|sf|final|all>
//
// The Next dev server must be running (for scoring). Override its URL with SIM_APP_URL.
import { readFileSync } from "node:fs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SECRET = process.env.CRON_SECRET;
const APP = process.env.SIM_APP_URL || "http://localhost:3000";
if (!SB_URL || !KEY) throw new Error("missing local Supabase env (run with --env-file=.env.local)");

const stageArg = (process.argv[2] || "").toLowerCase();
const ORDER = ["groups", "r32", "r16", "qf", "sf", "final"];
const isDate = /^\d{4}-\d{2}-\d{2}$/.test(stageArg);
if (!isDate && ![...ORDER, "all"].includes(stageArg)) {
  console.error("usage: advance.mjs <groups|r32|r16|qf|sf|final|all | YYYY-MM-DD>");
  process.exit(1);
}

const STAGE_OF = { groups: "GROUP_STAGE", r32: "LAST_32", r16: "LAST_16", qf: "QUARTER_FINALS", sf: "SEMI_FINALS", final: "FINAL" };
const NEXT = { groups: "LAST_32", r32: "LAST_16", r16: "QUARTER_FINALS", qf: "SEMI_FINALS", sf: "FINAL" };

const { groupStandings, matches: R } = JSON.parse(readFileSync(new URL("./results.json", import.meta.url)));
const { fixtures, groupStandingsOpen } = JSON.parse(readFileSync(new URL("./fixtures.json", import.meta.url)));
const kickoffById = Object.fromEntries(fixtures.map((f) => [f.id, f.kickoff]));
const groupById = Object.fromEntries(fixtures.map((f) => [f.id, f.group_name]));
const teamsOfGroup = Object.fromEntries(groupStandingsOpen.map((g) => [g.group_name, g.standings.map((r) => r.team)]));

// live group standings from the finished (due) group matches in results
function computeStandings(due) {
  const acc = {}; // group -> team -> {played,points,gd}
  for (const [g, teams] of Object.entries(teamsOfGroup)) {
    acc[g] = {};
    for (const t of teams) acc[g][t] = { played: 0, points: 0, gd: 0 };
  }
  for (const id of Object.keys(R)) {
    if (R[id].stage !== "GROUP_STAGE" || !due(id)) continue;
    const g = groupById[id];
    const m = R[id];
    if (!acc[g] || !acc[g][m.home] || !acc[g][m.away]) continue;
    acc[g][m.home].played++; acc[g][m.away].played++;
    acc[g][m.home].gd += m.home_score - m.away_score;
    acc[g][m.away].gd += m.away_score - m.home_score;
    acc[g][m.home].points += m.home_score > m.away_score ? 3 : m.home_score === m.away_score ? 1 : 0;
    acc[g][m.away].points += m.away_score > m.home_score ? 3 : m.home_score === m.away_score ? 1 : 0;
  }
  const out = {};
  for (const [g, tbl] of Object.entries(acc)) {
    out[g] = Object.entries(tbl)
      .map(([team, s]) => ({ team, ...s }))
      .sort((a, b) => b.points - a.points || b.gd - a.gd)
      .map((r, i) => ({ position: i + 1, team: r.team, played: r.played, points: r.points, gd: r.gd }));
  }
  return out;
}
// team → crest (group fixtures carry crests; knockout reveals reuse them)
const crestByTeam = {};
for (const f of fixtures) {
  if (f.home_crest) crestByTeam[f.home_team] = f.home_crest;
  if (f.away_crest) crestByTeam[f.away_team] = f.away_crest;
}
const crest = (t) => crestByTeam[t] ?? null;
const past = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

async function sb(path, { method = "GET", body, prefer } = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${await r.text()}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}

const resultCode = (w) => (w === "HOME" ? "1" : w === "AWAY" ? "2" : "X");

async function finishStage(stageKey) {
  const stage = STAGE_OF[stageKey];
  const ids = Object.keys(R).filter((id) => R[id].stage === stage);
  for (const id of ids) {
    const m = R[id];
    await sb(`matches?id=eq.${id}`, {
      method: "PATCH",
      body: {
        home_team: m.home, away_team: m.away,
        home_crest: crest(m.home), away_crest: crest(m.away),
        home_score: m.home_score, away_score: m.away_score,
        winner: m.winner, result: resultCode(m.winner),
        status: "FINISHED", kickoff: past, updated_at: new Date().toISOString(),
      },
    });
  }
  if (stageKey === "groups") {
    const table = computeStandings(() => true); // all group matches played
    for (const [g, rows] of Object.entries(table)) {
      await sb(`group_standings?group_name=eq.${g}`, {
        method: "PATCH",
        body: { standings: rows, final: true, updated_at: new Date().toISOString() },
      });
    }
  }
  return ids.length;
}

async function revealNext(stageKey) {
  const next = NEXT[stageKey];
  if (!next) return 0;
  const ids = Object.keys(R).filter((id) => R[id].stage === next);
  for (const id of ids) {
    const m = R[id];
    await sb(`matches?id=eq.${id}`, { method: "PATCH", body: { home_team: m.home, away_team: m.away, home_crest: crest(m.home), away_crest: crest(m.away) } });
  }
  // when revealing the FINAL, also reveal the third-place match teams
  if (next === "FINAL") {
    const tp = Object.keys(R).filter((id) => R[id].stage === "THIRD_PLACE");
    for (const id of tp) await sb(`matches?id=eq.${id}`, { method: "PATCH", body: { home_team: R[id].home, away_team: R[id].away, home_crest: crest(R[id].home), away_crest: crest(R[id].away) } });
  }
  return ids.length;
}

async function score() {
  try {
    const r = await fetch(`${APP}/api/dev/rescore`, { headers: { Authorization: `Bearer ${SECRET}` } });
    const j = await r.json().catch(() => ({}));
    console.log("  scored:", JSON.stringify(j));
  } catch (e) {
    console.log("  (scoring skipped — is the dev server running at", APP, "? set SIM_APP_URL)");
  }
}

// finish every match whose real kickoff is on/before the end of `dateStr` (Pacific)
const STAGE_SEQ = ["GROUP_STAGE", "LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"];
async function finishByDate(dateStr) {
  const cutoff = new Date(`${dateStr}T23:59:59-07:00`).getTime();
  const due = (id) => kickoffById[id] && new Date(kickoffById[id]).getTime() <= cutoff;
  const stageDone = (st) =>
    Object.keys(R).filter((id) => R[id].stage === st).every(due);

  const ids = Object.keys(R).filter(due);
  for (const id of ids) {
    const m = R[id];
    await sb(`matches?id=eq.${id}`, {
      method: "PATCH",
      body: {
        home_team: m.home, away_team: m.away,
        home_crest: crest(m.home), away_crest: crest(m.away),
        home_score: m.home_score, away_score: m.away_score,
        winner: m.winner, result: resultCode(m.winner),
        status: "FINISHED", kickoff: past, updated_at: new Date().toISOString(),
      },
    });
  }
  {
    // live (partial or final) group standings from finished group matches
    const finalGroups = stageDone("GROUP_STAGE");
    const table = computeStandings(due);
    for (const [g, rows] of Object.entries(table)) {
      await sb(`group_standings?group_name=eq.${g}`, {
        method: "PATCH",
        body: { standings: rows, final: finalGroups, updated_at: new Date().toISOString() },
      });
    }
  }
  // reveal a knockout round's teams once its feeder round is fully played
  for (let i = 1; i < STAGE_SEQ.length; i++) {
    if (!stageDone(STAGE_SEQ[i - 1])) continue;
    const st = STAGE_SEQ[i];
    const rids = Object.keys(R).filter((id) => R[id].stage === st && !due(id));
    for (const id of rids) await sb(`matches?id=eq.${id}`, { method: "PATCH", body: { home_team: R[id].home, away_team: R[id].away, home_crest: crest(R[id].home), away_crest: crest(R[id].away) } });
    if (st === "FINAL") {
      const tp = Object.keys(R).filter((id) => R[id].stage === "THIRD_PLACE" && !due(id));
      for (const id of tp) await sb(`matches?id=eq.${id}`, { method: "PATCH", body: { home_team: R[id].home, away_team: R[id].away, home_crest: crest(R[id].home), away_crest: crest(R[id].away) } });
    }
  }
  return ids.length;
}

if (isDate) {
  const n = await finishByDate(stageArg);
  console.log(`▶ advanced to end of ${stageArg}: finished ${n} matches`);
} else {
  const steps = stageArg === "all" ? ORDER : [stageArg];
  for (const s of steps) {
    const fin = await finishStage(s);
    const rev = await revealNext(s);
    console.log(`▶ ${s}: finished ${fin} matches${rev ? `, revealed ${rev} next-round matchups` : ""}`);
  }
}
await score();
console.log("Done.");
