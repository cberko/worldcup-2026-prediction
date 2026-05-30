import { createClient } from "@/lib/supabase/server";
import { StandingsTable, medal } from "@/components/StandingsTable";

export const dynamic = "force-dynamic";

type TournamentRow = {
  user_id: string;
  display_name: string;
  group_points: number;
  bracket_points: number;
  total_points: number;
};

export default async function TournamentLeaderboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("tournament_leaderboard")
    .select("*")
    .order("total_points", { ascending: false });
  const rows = (data ?? []) as TournamentRow[];

  return (
    <div className="space-y-6">
      <div>
        <span className="chip bg-gold-500/15 text-gold-300">Bracket</span>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Leaderboard</h1>
        <p className="mt-2 text-sm text-emerald-100/60">
          Group placements (+1 each) plus knockout advancement (R32 +2 → champion +32).
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-emerald-100/60">
          No tournament points yet — predict the groups to get on the board.
        </div>
      ) : (
        <StandingsTable
          accent="gold"
          head={["#", "Player", "Groups", "Bracket", "Total"]}
          rows={rows.map((r, i) => ({
            me: user?.id === r.user_id,
            cells: [medal(i), r.display_name, r.group_points, r.bracket_points, r.total_points],
          }))}
        />
      )}
    </div>
  );
}
