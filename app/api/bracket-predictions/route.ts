import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const KO_STAGES = ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"];

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
  if (!match_id || typeof team !== "string" || !team) {
    return NextResponse.json({ error: "match_id and team are required" }, { status: 400 });
  }

  const { data: match, error: mErr } = await supabase
    .from("matches")
    .select("id,stage")
    .eq("id", match_id)
    .single();
  if (mErr || !match) return NextResponse.json({ error: "match not found" }, { status: 404 });
  if (!KO_STAGES.includes(match.stage)) {
    return NextResponse.json({ error: "not a knockout match" }, { status: 400 });
  }

  // The bracket opens only once the group stage is done (R32 teams are real).
  const { data: r32 } = await supabase
    .from("matches")
    .select("kickoff,home_team")
    .eq("stage", "LAST_32")
    .order("kickoff", { ascending: true });
  const r32List = r32 ?? [];
  const teamsKnown = r32List.some((m) => m.home_team && m.home_team !== "TBD");
  if (!teamsKnown) {
    return NextResponse.json({ error: "Bracket opens after the group stage" }, { status: 409 });
  }
  // Lock: the whole bracket closes at the first Round-of-32 kickoff.
  const firstKick = r32List[0]?.kickoff;
  if (firstKick && new Date(firstKick).getTime() <= Date.now()) {
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
