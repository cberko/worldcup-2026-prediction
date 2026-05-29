import { NextRequest, NextResponse } from "next/server";
import { fetchAllMatches } from "@/lib/footballData";
import { createAdminClient } from "@/lib/supabase/admin";
import { scorePrediction } from "@/lib/scoring";
import type { Match } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Authorize via either the Authorization: Bearer <CRON_SECRET> header
// (GitHub Actions / cron-job.org) or Vercel's cron header.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  // Vercel Cron sends this header on scheduled invocations.
  if (req.headers.get("x-vercel-cron")) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // 1. Pull fixtures from football-data.org
  let matches: Match[];
  try {
    matches = await fetchAllMatches();
  } catch (e) {
    return NextResponse.json(
      { error: "fetch failed", detail: String(e) },
      { status: 502 }
    );
  }
  if (matches.length === 0) {
    return NextResponse.json({ ok: true, synced: 0, note: "no matches returned yet" });
  }

  // 2. Detect which matches BECAME finished since last sync (to score predictions).
  const ids = matches.map((m) => m.id);
  const { data: existing } = await supabase
    .from("matches")
    .select("id,status")
    .in("id", ids);
  const prevStatus = new Map((existing ?? []).map((r) => [r.id, r.status as string]));

  // 3. Upsert all matches.
  const { error: upsertErr } = await supabase.from("matches").upsert(matches, {
    onConflict: "id",
  });
  if (upsertErr) {
    return NextResponse.json({ error: "upsert failed", detail: upsertErr.message }, { status: 500 });
  }

  // 4. Score predictions for matches that are finished but weren't before
  //    (or were finished but never scored — safe to recompute).
  const newlyFinished = matches.filter(
    (m) => m.status === "FINISHED" && prevStatus.get(m.id) !== "FINISHED"
  );

  let scoredMatches = 0;
  let scoredPredictions = 0;
  for (const match of newlyFinished) {
    const { data: preds } = await supabase
      .from("predictions")
      .select("id,pred_home,pred_away")
      .eq("match_id", match.id);
    if (!preds || preds.length === 0) {
      scoredMatches++;
      continue;
    }
    for (const p of preds as { id: string; pred_home: number; pred_away: number }[]) {
      const pts = scorePrediction(match, p.pred_home, p.pred_away);
      if (pts === null) continue;
      await supabase.from("predictions").update({ points_awarded: pts }).eq("id", p.id);
      scoredPredictions++;
    }
    scoredMatches++;
  }

  return NextResponse.json({
    ok: true,
    synced: matches.length,
    newlyFinished: newlyFinished.length,
    scoredMatches,
    scoredPredictions,
  });
}
