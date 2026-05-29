import { createClient } from "@/lib/supabase/server";
import { MatchCard } from "@/components/MatchCard";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/scoring";
import type { Match, ScorePick, Stage } from "@/lib/types";

export const dynamic = "force-dynamic";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export default async function HomePage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .order("kickoff", { ascending: true });

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
  if (all.length === 0) return <EmptyState />;

  const byStage = new Map<Stage, Match[]>();
  for (const m of all) {
    if (!byStage.has(m.stage)) byStage.set(m.stage, []);
    byStage.get(m.stage)!.push(m);
  }
  const stages = STAGE_ORDER.filter((s) => byStage.has(s));

  const renderCards = (list: Match[]) => (
    <div className="grid gap-3 sm:grid-cols-2">
      {list.map((m) => (
        <MatchCard
          key={m.id}
          match={m}
          initialPred={predByMatch.get(m.id) ?? null}
          loggedIn={!!user}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-12">
      <Hero loggedIn={!!user} total={all.length} />

      {/* stage jump-nav */}
      <nav className="flex flex-wrap gap-2">
        {stages.map((s) => (
          <a
            key={s}
            href={`#${slug(STAGE_LABELS[s])}`}
            className="chip border border-white/10 bg-white/5 text-emerald-100/70 transition hover:border-grass-500/40 hover:text-grass-300"
          >
            {STAGE_LABELS[s]}
          </a>
        ))}
      </nav>

      {stages.map((stage) => {
        const list = byStage.get(stage)!;
        return (
          <section key={stage} id={slug(STAGE_LABELS[stage])} className="scroll-mt-24">
            <StageBand label={STAGE_LABELS[stage]} count={list.length} />
            {stage === "GROUP_STAGE" ? (
              <div className="space-y-8">
                {groupByMatchday(list).map(([md, games]) => (
                  <div key={md}>
                    <div className="mb-3 flex items-center gap-3">
                      <h3 className="display text-xl text-grass-300">Matchday {md}</h3>
                      <span className="h-px flex-1 bg-white/10" />
                      <span className="tnum text-xs text-emerald-100/40">{games.length}</span>
                    </div>
                    {renderCards(games)}
                  </div>
                ))}
              </div>
            ) : (
              renderCards(list)
            )}
          </section>
        );
      })}
    </div>
  );
}

// group stage matches → [matchday, games][] sorted ascending (null matchday last)
function groupByMatchday(list: Match[]): [number | string, Match[]][] {
  const m = new Map<number | string, Match[]>();
  for (const g of list) {
    const k = g.matchday ?? "—";
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(g);
  }
  return [...m.entries()].sort((a, b) => {
    if (typeof a[0] !== "number") return 1;
    if (typeof b[0] !== "number") return -1;
    return a[0] - b[0];
  });
}

function StageBand({ label, count }: { label: string; count: number }) {
  return (
    <div className="pitch-stripes mb-5 flex items-baseline gap-3 overflow-hidden rounded-xl border border-white/5 bg-pitch-900/40 px-4 py-3">
      <h2 className="display text-2xl sm:text-3xl">{label}</h2>
      <span className="tnum text-xs text-emerald-100/40">{count} matches</span>
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
            ["Right side", `+${5}`],
            ["Goal difference", `+${6}`],
            ["Exact score", `+${7}`],
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
