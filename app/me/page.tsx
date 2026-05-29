import { createClient } from "@/lib/supabase/server";
import { STAGE_LABELS } from "@/lib/scoring";
import { formatKickoff } from "@/lib/format";
import type { Match, Stage } from "@/lib/types";

export const dynamic = "force-dynamic";

type Row = {
  pred_home: number;
  pred_away: number;
  points_awarded: number | null;
  matches: Match;
};

export default async function MePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="card p-8 text-center">
        <h1 className="font-display text-2xl font-bold">Please sign in</h1>
        <p className="mt-2 text-sm text-emerald-100/60">
          Use “Sign In” at the top right to view your picks.
        </p>
      </div>
    );
  }

  const { data } = await supabase
    .from("predictions")
    .select("pred_home,pred_away,points_awarded,matches(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.matches);
  const total = rows.reduce((s, r) => s + (r.points_awarded ?? 0), 0);
  const scored = rows.filter((r) => r.points_awarded !== null);
  const correct = scored.filter((r) => (r.points_awarded ?? 0) > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl sm:text-5xl">My Picks</h1>
          <p className="mt-2 text-sm text-emerald-100/60">{rows.length} picks made.</p>
        </div>
        <div className="flex gap-3">
          <Stat label="Total Points" value={total} accent />
          <Stat label="Hits" value={`${correct}/${scored.length}`} />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-emerald-100/60">
          No picks yet. <a href="/" className="text-grass-300 underline">Go to matches →</a>
        </div>
      ) : (
        <div className="card divide-y divide-white/5">
          {rows.map((r) => {
            const m = r.matches;
            const decided = r.points_awarded !== null;
            const win = (r.points_awarded ?? 0) > 0;
            return (
              <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {m.home_team} <span className="text-emerald-100/40">vs</span> {m.away_team}
                  </div>
                  <div className="mt-0.5 text-xs text-emerald-100/45">
                    {STAGE_LABELS[m.stage as Stage]} · {formatKickoff(m.kickoff)}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-medium text-grass-200">
                    Pick: <span className="tnum">{r.pred_home}–{r.pred_away}</span>
                    {m.home_score !== null && m.away_score !== null && (
                      <span className="tnum ml-2 text-emerald-100/40">
                        (final {m.home_score}–{m.away_score})
                      </span>
                    )}
                  </div>
                  {decided && (
                    <div
                      className={`text-xs font-semibold ${win ? "text-grass-300" : "text-rose-300"}`}
                    >
                      {win ? `✓ +${r.points_awarded} pts` : "✗ 0 pts"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="card px-4 py-2.5 text-center">
      <div className={`tnum text-2xl font-bold ${accent ? "text-grass-300" : ""}`}>{value}</div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-emerald-100/40">
        {label}
      </div>
    </div>
  );
}
