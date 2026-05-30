import { createClient } from "@/lib/supabase/server";
import { GroupPredictor, type GroupData } from "@/components/GroupPredictor";
import { BracketBuilder } from "@/components/BracketBuilder";
import { buildBracketRounds, numberKnockout, r32TeamsKnown } from "@/lib/bracket";
import type { Match } from "@/lib/types";

export const dynamic = "force-dynamic";

const KO_STAGES = ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"];

type StandingRow = { position: number; team: string; played?: number; points?: number; gd?: number };

export default async function TournamentPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: gs }, { data: first }] = await Promise.all([
    supabase.from("group_standings").select("group_name,standings,final").order("group_name"),
    supabase.from("matches").select("kickoff").order("kickoff", { ascending: true }).limit(1).maybeSingle(),
  ]);

  const locked = !!first && new Date(first.kickoff).getTime() <= Date.now();

  // user's group predictions
  const predByGroup = new Map<string, string[]>();
  if (user) {
    const { data: gp } = await supabase
      .from("group_predictions")
      .select("group_name,predicted,points_awarded")
      .eq("user_id", user.id);
    (gp ?? []).forEach((p) => predByGroup.set(p.group_name, p.predicted as string[]));
  }
  // points per group (after scoring)
  const ptsByGroup = new Map<string, number | null>();
  if (user) {
    const { data: gp } = await supabase
      .from("group_predictions")
      .select("group_name,points_awarded")
      .eq("user_id", user.id);
    (gp ?? []).forEach((p) => ptsByGroup.set(p.group_name, p.points_awarded));
  }

  const groups: GroupData[] = (gs ?? []).map((g) => {
    const rows = [...((g.standings as StandingRow[]) ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((r) => ({
        position: r.position,
        team: r.team,
        played: r.played ?? 0,
        points: r.points ?? 0,
        gd: r.gd ?? 0,
      }));
    return {
      group_name: g.group_name,
      rows,
      predicted: predByGroup.get(g.group_name) ?? null,
      points: ptsByGroup.get(g.group_name) ?? null,
      final: !!g.final,
    };
  });

  // ---- bracket (knockout) data ----
  const { data: koData } = await supabase
    .from("matches")
    .select("*")
    .in("stage", KO_STAGES);
  const koMatches = (koData ?? []) as Match[];
  const rounds = buildBracketRounds(koMatches);
  const { num2id } = numberKnockout(koMatches);
  const ready = r32TeamsKnown(koMatches);
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
    <div className="space-y-10">
      {/* hero */}
      <div className="card relative overflow-hidden">
        <div className="pitch-stripes pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative p-6 sm:p-9">
          <span className="chip bg-gold-500/15 text-gold-300">Bracket · World Cup 2026</span>
          <h1 className="display mt-4 text-4xl sm:text-6xl">Call the whole tree</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-emerald-100/60">
            Predict how the whole tournament unfolds. Order every group now; once the group stage
            ends you&apos;ll fill the knockout bracket all the way to the champion.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5 text-xs">
            {[
              ["Each group placement", "+1"],
              ["R32", "+2"],
              ["R16", "+4"],
              ["QF", "+8"],
              ["SF", "+16"],
              ["Champion", "+32"],
            ].map(([l, p]) => (
              <div key={l} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5">
                <span className="tnum text-base font-bold text-gold-300">{p}</span>
                <span className="text-emerald-100/60">{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* group standings predictor */}
      <section>
        <div className="pitch-stripes mb-5 flex items-baseline gap-3 overflow-hidden rounded-xl border border-white/5 bg-pitch-900/40 px-4 py-3">
          <h2 className="display text-2xl sm:text-3xl">Group Standings</h2>
          <span className="tnum text-xs text-emerald-100/40">
            {locked ? "locked" : "+1 per correct placement"}
          </span>
        </div>
        {groups.length === 0 ? (
          <div className="card p-8 text-center text-sm text-emerald-100/60">
            Group line-ups will appear once standings sync from football-data.
          </div>
        ) : (
          <GroupPredictor groups={groups} locked={locked} loggedIn={!!user} />
        )}
      </section>

      {/* knockout bracket — opens after group stage */}
      <section>
        <div className="pitch-stripes mb-5 flex items-baseline gap-3 overflow-hidden rounded-xl border border-white/5 bg-pitch-900/40 px-4 py-3">
          <h2 className="display text-2xl sm:text-3xl">Knockout Bracket</h2>
          <span className="tnum text-xs text-emerald-100/40">
            {bracketLocked ? "locked" : "R32 +2 → Champion +32"}
          </span>
        </div>
        <BracketBuilder
          rounds={rounds}
          num2id={num2id}
          initialPicks={bracketPicks}
          locked={bracketLocked}
          ready={ready}
          loggedIn={!!user}
        />
      </section>
    </div>
  );
}
