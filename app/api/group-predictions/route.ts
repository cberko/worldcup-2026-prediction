import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must sign in" }, { status: 401 });

  let body: { group_name?: string; ordering?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  const { group_name, ordering } = body;
  if (
    !group_name ||
    !Array.isArray(ordering) ||
    ordering.length !== 4 ||
    ordering.some((t) => typeof t !== "string" || !t)
  ) {
    return NextResponse.json({ error: "group_name and a 4-team ordering are required" }, { status: 400 });
  }
  if (new Set(ordering).size !== 4) {
    return NextResponse.json({ error: "ordering must list each team once" }, { status: 400 });
  }

  // Lock: group predictions close at the tournament's first kickoff.
  const { data: first } = await supabase
    .from("matches")
    .select("kickoff")
    .order("kickoff", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (first && new Date(first.kickoff).getTime() <= Date.now()) {
    return NextResponse.json({ error: "Group predictions are locked (tournament started)" }, { status: 409 });
  }

  // Validate the ordering matches this group's actual 4 teams.
  const { data: gs } = await supabase
    .from("group_standings")
    .select("standings")
    .eq("group_name", group_name)
    .maybeSingle();
  if (gs) {
    const teams = new Set(((gs.standings as { team: string }[]) ?? []).map((r) => r.team));
    if (teams.size === 4 && ordering.some((t) => !teams.has(t))) {
      return NextResponse.json({ error: "teams don't match this group" }, { status: 400 });
    }
  }

  const { error } = await supabase.from("group_predictions").upsert(
    {
      user_id: user.id,
      group_name,
      predicted: ordering,
      points_awarded: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,group_name" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, group_name, ordering });
}
