import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GroupPredictor, type GroupData } from "@/components/GroupPredictor";

export const dynamic = "force-dynamic";

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

  const predByGroup = new Map<string, string[]>();
  const ptsByGroup = new Map<string, number | null>();
  if (user) {
    const { data: gp } = await supabase
      .from("group_predictions")
      .select("group_name,predicted,points_awarded")
      .eq("user_id", user.id);
    (gp ?? []).forEach((p) => {
      predByGroup.set(p.group_name, p.predicted as string[]);
      ptsByGroup.set(p.group_name, p.points_awarded);
    });
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

  return (
    <div className="space-y-8">
      <div>
        <span className="chip bg-gold-500/15 text-gold-300">Bracket · Group Stage</span>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Group Standings</h1>
        <p className="mt-2 max-w-2xl text-sm text-emerald-100/60">
          Order all 12 groups 1→4 — <b>+1 for every correct placement</b>. Locks at the first
          kickoff; once results come in this becomes a live table with your hits in green, misses in
          red. The <Link href="/tournament/knockout" className="text-gold-300 underline">Knockout
          Stage</Link> opens after the groups finish.
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="card p-8 text-center text-sm text-emerald-100/60">
          Group line-ups will appear once standings sync from football-data.
        </div>
      ) : (
        <GroupPredictor groups={groups} locked={locked} loggedIn={!!user} />
      )}
    </div>
  );
}
