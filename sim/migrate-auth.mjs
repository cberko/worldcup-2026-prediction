#!/usr/bin/env node
/**
 * One-off migration: give every EXISTING (non-anonymous) user a username-based
 * synthetic email (`<username>@wcpredict.app`) + a random password, so they can
 * log in with the new username/password UI. No email is ever sent.
 *
 *   user_id is preserved → all predictions / leaderboard standing survive.
 *
 * Usage (run from the repo root, with the PRODUCTION service-role key):
 *
 *   SUPABASE_URL=https://sxbrtwdxwswkyihlnsfr.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<prod service_role key> \
 *   node sim/migrate-auth.mjs            # DRY RUN — prints what it would do
 *
 *   ...same env... node sim/migrate-auth.mjs --execute   # actually apply + write CSV
 *
 * Idempotent: users already on @wcpredict.app are skipped; anonymous/guest
 * accounts are skipped (they are per-device and have nothing to log in with).
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EXECUTE = process.argv.includes("--execute");
const DOMAIN = "wcpredict.app";

if (!URL || !KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

// --- slug logic: MUST match lib/username.ts byte-for-byte ---
const TR = { ç:"c", ğ:"g", ı:"i", ö:"o", ş:"s", ü:"u", Ç:"c", Ğ:"g", "İ":"i", Ö:"o", Ş:"s", Ü:"u" };
function slugify(raw) {
  return (raw || "")
    .trim()
    .replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => TR[c] ?? c)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 32);
}

function randomPassword(len = 10) {
  // unambiguous alphabet (no 0/O/1/l/I)
  const a = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  const bytes = randomBytes(len);
  for (let i = 0; i < len; i++) s += a[bytes[i] % a.length];
  return s;
}

const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// fetch all users
async function allUsers() {
  const out = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    out.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return out;
}

const users = (await allUsers()).sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
const used = new Set();
// reserve already-migrated usernames first so we never collide with them
for (const u of users) {
  if (u.email?.endsWith("@" + DOMAIN)) used.add(u.email.split("@")[0]);
}

function uniqueUsername(base) {
  let cand = base || "player";
  let n = 1;
  while (cand.length < 3 || used.has(cand)) {
    n++;
    cand = (base || "player") + n;
  }
  used.add(cand);
  return cand;
}

const plan = [];
for (const u of users) {
  const display = u.user_metadata?.display_name || u.user_metadata?.full_name || "";
  if (u.is_anonymous) { plan.push({ id: u.id, display, action: "skip (anonymous/guest)" }); continue; }
  if (u.email?.endsWith("@" + DOMAIN)) { plan.push({ id: u.id, display, username: u.email.split("@")[0], action: "skip (already migrated)" }); continue; }
  const username = uniqueUsername(slugify(display || u.email?.split("@")[0] || ""));
  const password = randomPassword();
  plan.push({ id: u.id, display, oldEmail: u.email ?? "(none)", username, password, newEmail: `${username}@${DOMAIN}`, action: EXECUTE ? "MIGRATE" : "would migrate" });
}

const toMigrate = plan.filter((p) => p.password);
console.log(`\n${users.length} users · ${toMigrate.length} to migrate · ${plan.length - toMigrate.length} skipped\n`);
for (const p of plan) {
  if (p.password) console.log(`  ${p.action.padEnd(14)} "${p.display || "—"}"  →  ${p.username} / ${p.password}   (was ${p.oldEmail})`);
  else console.log(`  ${p.action.padEnd(28)} "${p.display || "—"}"`);
}

if (!EXECUTE) {
  console.log(`\nDRY RUN — nothing changed. Re-run with --execute to apply.\n`);
  process.exit(0);
}

console.log("\nApplying…");
let ok = 0, fail = 0;
for (const p of toMigrate) {
  const { error } = await admin.auth.admin.updateUserById(p.id, {
    email: p.newEmail,
    password: p.password,
    email_confirm: true,
    user_metadata: { display_name: p.display || p.username },
  });
  if (error) { fail++; console.log(`  ✗ ${p.username}: ${error.message}`); }
  else { ok++; }
}
const csv = "username,password,display_name\n" + toMigrate.map((p) => `${p.username},${p.password},"${(p.display || p.username).replace(/"/g, '""')}"`).join("\n") + "\n";
const file = `sim/credentials-${Date.now()}.csv`;
writeFileSync(file, csv);
console.log(`\nDone: ${ok} migrated, ${fail} failed. Credentials written to ${file}\n`);
