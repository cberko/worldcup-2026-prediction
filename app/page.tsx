import { createClient } from "@/lib/supabase/server";
import { MatchCard } from "@/components/MatchCard";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/scoring";
import type { Match, ScorePick, Stage } from "@/lib/types";

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

  // Current user's existing predictions → map match_id -> {home, away}
  const predByMatch = new Map<string, ScorePick>();
  if (user) {
    const { data: preds } = await supabase
      .from("predictions")
      .select("match_id,pred_home,pred_away")
      .eq("user_id", user.id);
    (preds ?? []).forEach((p) =>
      predByMatch.set(p.match_id, { home: p.pred_home, away: p.pred_away })
    );
  }

  const all = (matches ?? []) as Match[];

  if (all.length === 0) {
    return <EmptyState />;
  }

  // Group by stage, preserving stage order.
  const byStage = new Map<Stage, Match[]>();
  for (const m of all) {
    if (!byStage.has(m.stage)) byStage.set(m.stage, []);
    byStage.get(m.stage)!.push(m);
  }

  return (
    <div className="space-y-10">
      <Hero loggedIn={!!user} />

      {STAGE_ORDER.filter((s) => byStage.has(s)).map((stage) => (
        <section key={stage}>
          <div className="pitch-stripes mb-4 flex items-center gap-3 rounded-xl border border-white/5 px-4 py-2.5">
            <h2 className="font-display text-lg font-bold tracking-tight">
              {STAGE_LABELS[stage]}
            </h2>
            <span className="text-xs text-emerald-100/40">
              {byStage.get(stage)!.length} matches
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {byStage.get(stage)!.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                initialPred={predByMatch.get(m.id) ?? null}
                loggedIn={!!user}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Hero({ loggedIn }: { loggedIn: boolean }) {
  return (
    <div className="card relative overflow-hidden p-6 sm:p-8">
      <div className="pitch-stripes pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative">
        <span className="chip bg-grass-500/15 text-grass-300">World Cup 2026 · Jun 11 – Jul 19</span>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Predict the scores, <span className="text-grass-400">climb the table</span>.
        </h1>
        <p className="mt-2 max-w-xl text-sm text-emerald-100/60">
          Pick a <b>scoreline</b> for every match. Right side <b>+5</b>, right goal
          difference <b>+6</b>, exact score <b>+7</b>. Same across every round —
          picks lock the moment kickoff begins.
        </p>
        {!loggedIn && (
          <div className="mt-4 inline-block rounded-xl border border-grass-500/40 bg-grass-500/10 px-4 py-2 text-sm font-semibold text-grass-300">
            Hit “Sign In” above to start →
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card p-8 text-center">
      <div className="text-4xl">📡</div>
      <h1 className="mt-3 font-display text-2xl font-bold">No matches yet</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-emerald-100/60">
        Fixtures appear here once they sync from football-data.org. To run the first
        sync, call the <code className="rounded bg-white/10 px-1.5 py-0.5">/api/cron/sync</code>{" "}
        endpoint with your <code>CRON_SECRET</code> (see the README). For local testing
        you can load <code className="rounded bg-white/10 px-1.5 py-0.5">supabase/seed.sql</code>.
      </p>
    </div>
  );
}
