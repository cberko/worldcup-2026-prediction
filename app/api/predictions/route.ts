import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isLocked } from "@/lib/types";

export const dynamic = "force-dynamic";

function validGoals(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 99;
}

export async function POST(req: NextRequest) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must sign in" }, { status: 401 });
  }

  let body: { match_id?: string; home?: number; away?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  const { match_id, home, away } = body;
  if (!match_id || !validGoals(home) || !validGoals(away)) {
    return NextResponse.json({ error: "match_id and a valid score (0-99) are required" }, { status: 400 });
  }

  // Load the match (server-authoritative: kickoff + status).
  const { data: match, error: matchErr } = await supabase
    .from("matches")
    .select("id,kickoff,status")
    .eq("id", match_id)
    .single();
  if (matchErr || !match) {
    return NextResponse.json({ error: "match not found" }, { status: 404 });
  }

  // The lock: reject once kickoff has passed (or match already started/finished).
  if (isLocked({ kickoff: match.kickoff, status: match.status })) {
    return NextResponse.json({ error: "Match is locked — picks can't be changed" }, { status: 409 });
  }

  // Upsert the user's predicted scoreline for this match.
  const { error: upErr } = await supabase.from("predictions").upsert(
    {
      user_id: user.id,
      match_id,
      pred_home: home,
      pred_away: away,
      points_awarded: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,match_id" }
  );
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, match_id, home, away });
}
