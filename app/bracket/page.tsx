import { createClient } from "@/lib/supabase/server";
import { STAGE_LABELS } from "@/lib/scoring";
import type { Match, Stage } from "@/lib/types";

export const dynamic = "force-dynamic";

const KO_ORDER: Stage[] = ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"];

function TeamRow({
  name,
  crest,
  advanced,
  score,
}: {
  name: string;
  crest: string | null;
  advanced: boolean;
  score: number | null;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 ${
        advanced ? "bg-grass-500/15" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        {crest ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={crest} alt={name} className="h-5 w-5 object-contain" loading="lazy" />
        ) : (
          <span className="text-xs">🏳️</span>
        )}
        <span className={`truncate text-xs ${advanced ? "font-bold text-grass-200" : ""}`}>
          {name}
        </span>
      </div>
      {score !== null && <span className="tnum text-xs text-emerald-100/60">{score}</span>}
    </div>
  );
}

export default async function BracketPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("matches")
    .select("*")
    .in("stage", KO_ORDER)
    .order("kickoff", { ascending: true });

  const matches = (data ?? []) as Match[];
  const byStage = new Map<Stage, Match[]>();
  for (const m of matches) {
    if (!byStage.has(m.stage)) byStage.set(m.stage, []);
    byStage.get(m.stage)!.push(m);
  }

  const hasAny = matches.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-4xl sm:text-5xl">Bracket</h1>
        <p className="mt-2 text-sm text-emerald-100/60">
          The road from the Round of 32 to the final. The advancing team is highlighted in green.
        </p>
      </div>

      {!hasAny ? (
        <div className="card p-8 text-center text-sm text-emerald-100/60">
          Knockout fixtures aren&apos;t set yet (they fill in once the group stage ends).
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {KO_ORDER.map((stage) => {
            const list = byStage.get(stage) ?? [];
            return (
              <div key={stage} className="flex w-56 shrink-0 flex-col gap-3">
                <div className="display sticky top-0 text-center text-base text-gold-300">
                  {STAGE_LABELS[stage]}
                </div>
                {list.length === 0 ? (
                  <div className="card flex-1 p-3 text-center text-xs text-emerald-100/30">
                    —
                  </div>
                ) : (
                  list.map((m) => (
                    <div key={m.id} className="card space-y-1 p-2">
                      <TeamRow
                        name={m.home_team}
                        crest={m.home_crest}
                        advanced={m.winner === "HOME"}
                        score={m.home_score}
                      />
                      <TeamRow
                        name={m.away_team}
                        crest={m.away_crest}
                        advanced={m.winner === "AWAY"}
                        score={m.away_score}
                      />
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
