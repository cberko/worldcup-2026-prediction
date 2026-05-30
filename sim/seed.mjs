// Seed the LOCAL Supabase with the pre-tournament (open) state from sim/fixtures.json.
// Wipes matches/standings/predictions for a clean run.
//   node --env-file=.env.local sim/seed.mjs
import { readFileSync } from "node:fs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !KEY) throw new Error("missing local Supabase env (run with --env-file=.env.local)");

async function sb(path, { method = "GET", body, prefer } = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${await r.text()}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}

const { fixtures, groupStandingsOpen } = JSON.parse(
  readFileSync(new URL("./fixtures.json", import.meta.url))
);

// clean slate (cascade clears predictions/bracket_predictions)
await sb("bracket_predictions?id=not.is.null", { method: "DELETE" });
await sb("predictions?id=not.is.null", { method: "DELETE" });
await sb("group_predictions?id=not.is.null", { method: "DELETE" });
await sb("group_standings?group_name=not.is.null", { method: "DELETE" });
await sb("matches?id=not.is.null", { method: "DELETE" });

await sb("matches", { method: "POST", body: fixtures, prefer: "resolution=merge-duplicates" });
await sb("group_standings", {
  method: "POST",
  body: groupStandingsOpen.map((g) => ({ ...g, final: false })),
  prefer: "resolution=merge-duplicates",
});

console.log(`Seeded ${fixtures.length} fixtures (open) + ${groupStandingsOpen.length} groups into local Supabase.`);
console.log("Now: npm run dev → sign in as guest → make predictions → node --env-file=.env.local sim/advance.mjs groups");
