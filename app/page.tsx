import { createClient } from "@/lib/supabase/server";
import { MatchBoard } from "@/components/MatchBoard";
import type { Match, ScorePick } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .order("kickoff", { ascending: true });

  const preds: Record<string, ScorePick> = {};
  if (user) {
    const { data: rows } = await supabase
      .from("predictions")
      .select("match_id,pred_home,pred_away")
      .eq("user_id", user.id);
    (rows ?? []).forEach((p) => {
      preds[p.match_id] = { home: p.pred_home, away: p.pred_away };
    });
  }

  const all = (matches ?? []) as Match[];
  if (all.length === 0) return <EmptyState />;

  return (
    <div className="space-y-10">
      <Hero loggedIn={!!user} total={all.length} />
      <MatchBoard matches={all} preds={preds} loggedIn={!!user} />
    </div>
  );
}

function Hero({ loggedIn, total }: { loggedIn: boolean; total: number }) {
  return (
    <div className="card relative overflow-hidden">
      <div className="pitch-stripes pointer-events-none absolute inset-0 opacity-40" />
      <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-grass-500/10 blur-3xl" />
      <div className="relative p-6 sm:p-10">
        <span className="chip bg-grass-500/15 text-grass-300">World Cup 2026 · Jun 11 – Jul 19</span>
        <h1 className="display mt-4 text-5xl text-emerald-50 sm:text-7xl">
          Predict the scores.
          <br />
          <span className="text-grass-400">Climb the table.</span>
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-emerald-100/60">
          Call a scoreline for all {total} matches — group stage and knockouts alike.
          Picks lock at kickoff and points settle the moment the final whistle blows.
        </p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          {[
            ["Right side", "+5"],
            ["Goal difference", "+6"],
            ["Exact score", "+9"],
          ].map(([label, pts]) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5"
            >
              <span className="tnum text-lg font-bold text-gold-300">{pts}</span>
              <span className="text-xs text-emerald-100/60">{label}</span>
            </div>
          ))}
        </div>
        {!loggedIn && (
          <div className="mt-5 inline-block rounded-lg border border-grass-500/40 bg-grass-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-grass-300">
            Hit “Sign In” above to start →
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card p-10 text-center">
      <div className="text-5xl">📡</div>
      <h1 className="display mt-4 text-3xl">No matches yet</h1>
      <p className="mx-auto mt-3 max-w-md text-sm text-emerald-100/60">
        Fixtures appear here once they sync from football-data.org. Trigger the first sync by
        calling <code className="rounded bg-white/10 px-1.5 py-0.5">/api/cron/sync</code> with your{" "}
        <code>CRON_SECRET</code>.
      </p>
    </div>
  );
}
