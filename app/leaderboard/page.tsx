import { createClient } from "@/lib/supabase/server";
import type { LeaderboardRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("leaderboard")
    .select("*")
    .order("total_points", { ascending: false })
    .order("correct_count", { ascending: false });

  const rows = (data ?? []) as LeaderboardRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-4xl sm:text-5xl">Leaderboard</h1>
        <p className="mt-2 text-sm text-emerald-100/60">
          Ranked by total points. Every round counts the same: side +5, goal diff +6, exact +7.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-emerald-100/60">
          No points yet. The table fills up as the first matches are played.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-emerald-100/40">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Player</th>
                <th className="px-4 py-3 text-right font-medium">Hits</th>
                <th className="px-4 py-3 text-right font-medium">Points</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const me = user?.id === r.user_id;
                const medal = ["🥇", "🥈", "🥉"][i] ?? null;
                return (
                  <tr
                    key={r.user_id}
                    className={`border-b border-white/5 last:border-0 ${
                      me ? "bg-grass-500/10" : ""
                    }`}
                  >
                    <td className="tnum px-4 py-3 text-emerald-100/50">
                      {medal ?? i + 1}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {r.display_name}
                      {me && <span className="ml-2 text-xs text-grass-300">(you)</span>}
                    </td>
                    <td className="tnum px-4 py-3 text-right text-emerald-100/60">
                      {r.correct_count}/{r.total_predictions}
                    </td>
                    <td className="tnum px-4 py-3 text-right text-lg font-bold text-grass-300">
                      {r.total_points}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
