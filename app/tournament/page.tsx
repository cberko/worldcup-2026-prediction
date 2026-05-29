import { createClient } from "@/lib/supabase/server";
import { GroupPredictor, type GroupData } from "@/components/GroupPredictor";

export const dynamic = "force-dynamic";

type StandingRow = { position: number; team: string };

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
    const rows = [...((g.standings as StandingRow[]) ?? [])].sort((a, b) => a.position - b.position);
    const teams = rows.map((r) => r.team);
    return {
      group_name: g.group_name,
      teams,
      predicted: predByGroup.get(g.group_name) ?? null,
      points: ptsByGroup.get(g.group_name) ?? null,
      actual: g.final ? teams : null, // when final, standings are the actual order
    };
  });

  return (
    <div className="space-y-10">
      {/* hero */}
      <div className="card relative overflow-hidden">
        <div className="pitch-stripes pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative p-6 sm:p-9">
          <span className="chip bg-gold-500/15 text-gold-300">Mode 2 · Tournament Predictor</span>
          <h1 className="display mt-4 text-4xl sm:text-6xl">Bracket Challenge</h1>
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
          <span className="tnum text-xs text-emerald-100/40">R32 +2 → Champion +32</span>
        </div>
        <div className="card p-8 text-center">
          <div className="text-4xl">🏆</div>
          <h3 className="display mt-3 text-2xl">Opens after the group stage</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-emerald-100/60">
            Once the 32 qualifiers are set, you&apos;ll pick every knockout winner from the Round of
            32 through to lifting the trophy — locked at the first R32 kickoff.
          </p>
        </div>
      </section>
    </div>
  );
}
