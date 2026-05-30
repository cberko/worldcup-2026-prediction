import { createClient } from "@/lib/supabase/server";
import { BracketTree, type KOMatch } from "@/components/BracketTree";
import { buildBracketRounds, numberKnockout, r32TeamsKnown } from "@/lib/bracket";
import type { Match } from "@/lib/types";

export const dynamic = "force-dynamic";

const KO_STAGES = ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"];

export default async function KnockoutPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: koData } = await supabase.from("matches").select("*").in("stage", KO_STAGES);
  const koMatches = (koData ?? []) as Match[];

  const rounds = buildBracketRounds(koMatches);
  const { num2id } = numberKnockout(koMatches);
  const ready = r32TeamsKnown(koMatches);

  const matchById: Record<string, KOMatch> = {};
  for (const m of koMatches) {
    matchById[m.id] = {
      home_team: m.home_team,
      away_team: m.away_team,
      winner: m.winner,
      status: m.status,
      home_score: m.home_score,
      away_score: m.away_score,
    };
  }

  const r32Kicks = koMatches
    .filter((m) => m.stage === "LAST_32")
    .map((m) => new Date(m.kickoff).getTime())
    .sort((a, b) => a - b);
  const bracketLocked = r32Kicks.length > 0 && r32Kicks[0] <= Date.now();

  const bracketPicks: Record<string, string> = {};
  if (user) {
    const { data: bp } = await supabase
      .from("bracket_predictions")
      .select("match_id,predicted_team")
      .eq("user_id", user.id);
    (bp ?? []).forEach((p) => {
      bracketPicks[p.match_id] = p.predicted_team;
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <span className="chip bg-gold-500/15 text-gold-300">Bracket · Knockout</span>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Knockout Stage</h1>
        <p className="mt-2 max-w-2xl text-sm text-emerald-100/60">
          One tree, both stories: the real results and your predictions side by side. Gold ▲ = who
          actually advanced; green = your correct calls, red = misses. R32 +2 · R16 +4 · QF +8 · SF
          +16 · Champion +32.
        </p>
      </div>

      {/* full-bleed so the tree has room and doesn't need horizontal scrolling on desktop */}
      <div className="mx-[calc(50%-50vw)] px-4 sm:px-8">
        <BracketTree
          rounds={rounds}
          num2id={num2id}
          matchById={matchById}
          initialPicks={bracketPicks}
          locked={bracketLocked}
          ready={ready}
          loggedIn={!!user}
        />
      </div>
    </div>
  );
}
