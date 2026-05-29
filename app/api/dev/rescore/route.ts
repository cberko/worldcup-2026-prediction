import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scorePrediction } from "@/lib/scoring";
import type { Match } from "@/lib/types";

export const dynamic = "force-dynamic";

// Recomputes points for every prediction on every FINISHED match, straight from
// the scores already stored in the DB — no external API call. Handy for local
// testing with seeded data (load supabase/seed.sql, then hit this endpoint).
// Protected by CRON_SECRET.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .eq("status", "FINISHED");

  let scoredPredictions = 0;
  for (const match of (matches ?? []) as Match[]) {
    const { data: preds } = await supabase
      .from("predictions")
      .select("id,pred_home,pred_away")
      .eq("match_id", match.id);
    for (const p of (preds ?? []) as { id: string; pred_home: number; pred_away: number }[]) {
      const pts = scorePrediction(match, p.pred_home, p.pred_away);
      if (pts === null) continue;
      await supabase.from("predictions").update({ points_awarded: pts }).eq("id", p.id);
      scoredPredictions++;
    }
  }

  return NextResponse.json({
    ok: true,
    finishedMatches: matches?.length ?? 0,
    scoredPredictions,
  });
}
