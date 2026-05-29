import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scorePrediction } from "@/lib/scoring";
import { scoreBracketPrediction, scoreGroupPrediction } from "@/lib/scoring2";
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

    // Mode 2: bracket picks on finished knockout matches
    if (match.stage !== "GROUP_STAGE") {
      const { data: bp } = await supabase
        .from("bracket_predictions")
        .select("id,predicted_team")
        .eq("match_id", match.id);
      for (const b of (bp ?? []) as { id: string; predicted_team: string }[]) {
        const pts = scoreBracketPrediction(match, b.predicted_team);
        if (pts === null) continue;
        await supabase.from("bracket_predictions").update({ points_awarded: pts }).eq("id", b.id);
      }
    }
  }

  // Mode 2: group placements against any FINAL group standings
  let groupPredsScored = 0;
  const { data: gsRows } = await supabase
    .from("group_standings")
    .select("group_name,standings,final")
    .eq("final", true);
  for (const gs of (gsRows ?? []) as { group_name: string; standings: { position: number; team: string }[] }[]) {
    const actual = [...gs.standings].sort((a, b) => a.position - b.position).map((r) => r.team);
    const { data: gp } = await supabase
      .from("group_predictions")
      .select("id,predicted")
      .eq("group_name", gs.group_name);
    for (const p of (gp ?? []) as { id: string; predicted: string[] }[]) {
      const pts = scoreGroupPrediction(p.predicted, actual);
      await supabase.from("group_predictions").update({ points_awarded: pts }).eq("id", p.id);
      groupPredsScored++;
    }
  }

  return NextResponse.json({
    ok: true,
    finishedMatches: matches?.length ?? 0,
    scoredPredictions,
    groupPredsScored,
  });
}
