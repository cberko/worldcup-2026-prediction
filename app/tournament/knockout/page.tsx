import { createClient } from "@/lib/supabase/server";
import { BracketTree, type KOMatch } from "@/components/BracketTree";
import { BracketStats, type StageStat } from "@/components/BracketStats";
import { buildBracketRounds, numberKnockout, r32TeamsKnown } from "@/lib/bracket";
import type { Match, Stage } from "@/lib/types";

export const dynamic = "force-dynamic";

const KO_STAGES = ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"];
const STAT_STAGES: { key: Stage; label: string }[] = [
  { key: "LAST_32", label: "R32" },
  { key: "LAST_16", label: "R16" },
  { key: "QUARTER_FINALS", label: "QF" },
  { key: "SEMI_FINALS", label: "SF" },
  { key: "FINAL", label: "Champion" },
];

export default async function KnockoutPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: koData } = await supabase.from("matches").select("*").in("stage", KO_STAGES);
  const koMatches = (koData ?? []) as Match[];

  // team → crest, from every match (group fixtures carry all 48 teams' crests)
  const { data: crestRows } = await supabase
    .from("matches")
    .select("home_team,home_crest,away_team,away_crest");
  const crestByTeam: Record<string, string> = {};
  for (const r of crestRows ?? []) {
    if (r.home_crest) crestByTeam[r.home_team] = r.home_crest;
    if (r.away_crest) crestByTeam[r.away_team] = r.away_crest;
  }

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
  let stats: StageStat[] = [];
  let totalBracket = 0;
  if (user) {
    const { data: bp } = await supabase
      .from("bracket_predictions")
      .select("match_id,predicted_team,points_awarded")
      .eq("user_id", user.id);
    const rows = bp ?? [];
    rows.forEach((p) => {
      bracketPicks[p.match_id] = p.predicted_team;
    });

    const stageById = Object.fromEntries(koMatches.map((m) => [m.id, m.stage]));
    stats = STAT_STAGES.map(({ key, label }) => {
      const inStage = rows.filter((p) => stageById[p.match_id] === key);
      const points = inStage.reduce((s, p) => s + (p.points_awarded ?? 0), 0);
      const correct = inStage.filter((p) => (p.points_awarded ?? 0) > 0).length;
      const stageMatches = koMatches.filter((m) => m.stage === key);
      const decided = stageMatches.filter((m) => m.status === "FINISHED").length;
      return { label, points, correct, decided, total: stageMatches.length };
    });
    totalBracket = stats.reduce((s, x) => s + x.points, 0);
  }
  const hasPicks = Object.keys(bracketPicks).length > 0;

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

      {hasPicks && <BracketStats stats={stats} total={totalBracket} />}

      {/* full-bleed so the tree has room and doesn't need horizontal scrolling on desktop */}
      <div className="mx-[calc(50%-50vw)] px-4 sm:px-8">
        <BracketTree
          rounds={rounds}
          num2id={num2id}
          matchById={matchById}
          crestByTeam={crestByTeam}
          initialPicks={bracketPicks}
          locked={bracketLocked}
          ready={ready}
          loggedIn={!!user}
        />
      </div>
    </div>
  );
}
