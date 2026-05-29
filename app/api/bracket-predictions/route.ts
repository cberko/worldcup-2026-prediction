import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const KO_STAGES = ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "THIRD_PLACE", "FINAL"];

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must sign in" }, { status: 401 });

  let body: { match_id?: string; team?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  const { match_id, team } = body;
  if (!match_id || !team) {
    return NextResponse.json({ error: "match_id and team are required" }, { status: 400 });
  }

  const { data: match, error: mErr } = await supabase
    .from("matches")
    .select("id,stage,home_team,away_team")
    .eq("id", match_id)
    .single();
  if (mErr || !match) return NextResponse.json({ error: "match not found" }, { status: 404 });
  if (!KO_STAGES.includes(match.stage)) {
    return NextResponse.json({ error: "not a knockout match" }, { status: 400 });
  }
  if (team !== match.home_team && team !== match.away_team) {
    return NextResponse.json({ error: "team is not in this match" }, { status: 400 });
  }
  if (match.home_team === "TBD" || match.away_team === "TBD") {
    return NextResponse.json({ error: "teams not determined yet" }, { status: 409 });
  }

  // Lock: the whole bracket closes at the first Round-of-32 kickoff.
  const { data: r32 } = await supabase
    .from("matches")
    .select("kickoff")
    .eq("stage", "LAST_32")
    .order("kickoff", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (r32 && new Date(r32.kickoff).getTime() <= Date.now()) {
    return NextResponse.json({ error: "Bracket is locked (knockouts started)" }, { status: 409 });
  }

  const { error } = await supabase.from("bracket_predictions").upsert(
    {
      user_id: user.id,
      match_id,
      predicted_team: team,
      points_awarded: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,match_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, match_id, team });
}
