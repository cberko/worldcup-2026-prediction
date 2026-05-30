// End-to-end pipeline check against the LOCAL stack.
//   setup: create a test user + known predictions
//   check: read the leaderboards and compare to expected points
//   node --env-file=.env.local sim/selftest.mjs setup|check
import { readFileSync } from "node:fs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const mode = process.argv[2];

async function rest(path, opts = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(opts.prefer ? { Prefer: opts.prefer } : {}) },
    method: opts.method || "GET",
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${path} ${r.status} ${t}`);
  return t ? JSON.parse(t) : null;
}

const R = JSON.parse(readFileSync(new URL("./results.json", import.meta.url)));
const TEST_EMAIL = "simtest@example.com";

if (mode === "setup") {
  // create (or reuse) a confirmed auth user → trigger makes a profile
  const admin = await fetch(`${SB_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: TEST_EMAIL, password: "simtest1234", email_confirm: true, user_metadata: { display_name: "SimTester" } }),
  });
  const au = await admin.json();
  const uid = au.id || au.user?.id;
  if (!uid) throw new Error("could not create user: " + JSON.stringify(au).slice(0, 200));

  // pick sample matches
  const groupIds = Object.keys(R.matches).filter((id) => R.matches[id].stage === "GROUP_STAGE");
  const exactM = groupIds.find((id) => R.matches[id].winner === "HOME"); // decisive
  const wrongM = groupIds.find((id) => id !== exactM && R.matches[id].winner === "HOME");
  const ex = R.matches[exactM];
  const wr = R.matches[wrongM];

  // Mode 1: exact (+9) and wrong-side (0)
  await rest("predictions", { method: "POST", prefer: "resolution=merge-duplicates", body: [
    { user_id: uid, match_id: exactM, pred_home: ex.home_score, pred_away: ex.away_score },
    { user_id: uid, match_id: wrongM, pred_home: wr.away_score, pred_away: wr.home_score + 1 }, // flip → away win predicted vs home win actual
  ]});

  // Mode 2 group: exact final order of one group (+4)
  const g = Object.keys(R.groupStandings)[0];
  await rest("group_predictions", { method: "POST", prefer: "resolution=merge-duplicates",
    body: [{ user_id: uid, group_name: g, predicted: R.groupStandings[g] }] });

  // Mode 2 bracket: an R32 winner (+2) and the champion via the Final match (+32)
  const r32Id = R.num2id["73"];
  const finalId = R.num2id["104"];
  await rest("bracket_predictions", { method: "POST", prefer: "resolution=merge-duplicates", body: [
    { user_id: uid, match_id: r32Id, predicted_team: R.matches[r32Id].winner === "HOME" ? R.matches[r32Id].home : R.matches[r32Id].away },
    { user_id: uid, match_id: finalId, predicted_team: R.champion },
  ]});

  console.log(JSON.stringify({
    uid, exactM, wrongM,
    expected: { match: 9, group: 4, bracket: 2 + 32, note: "+9 exact, 0 wrong, +4 group order, +2 R32, +32 champion" },
  }, null, 2));
} else if (mode === "check") {
  const lb = await rest(`leaderboard?display_name=eq.SimTester`);
  const tlb = await rest(`tournament_leaderboard?display_name=eq.SimTester`);
  console.log("Match Picks leaderboard:", JSON.stringify(lb));
  console.log("Tournament leaderboard:", JSON.stringify(tlb));
  const m = lb?.[0]?.total_points, t = tlb?.[0];
  const ok = m === 9 && t?.group_points === 4 && t?.bracket_points === 34 && t?.total_points === 38;
  console.log(ok ? "✅ PASS — points match expected (match 9, group 4, bracket 34, total 38)" : "❌ MISMATCH vs expected (9 / 4 / 34 / 38)");
} else {
  console.error("usage: selftest.mjs setup|check");
  process.exit(1);
}
