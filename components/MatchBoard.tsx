"use client";

import { useMemo, useState } from "react";
import { MatchCard } from "./MatchCard";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/scoring";
import type { Match, ScorePick, Stage } from "@/lib/types";

type Props = {
  matches: Match[];
  preds: Record<string, ScorePick>;
  loggedIn: boolean;
};

type View = "upcoming" | "results" | "all";

// Group by the tournament's host-region day (fixed tz) so SSR and client agree
// (no hydration mismatch) and each match lands on its real "match day".
const TZ = "America/New_York";
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TZ,
  }).format(new Date(iso));
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

const DAYS_STEP = 4; // how many day-groups to reveal at a time

export function MatchBoard({ matches, preds, loggedIn }: Props) {
  const [view, setView] = useState<View>("upcoming");
  const [shownDays, setShownDays] = useState(DAYS_STEP);

  // reset the reveal window whenever the active view changes
  const setViewReset = (v: View) => {
    setView(v);
    setShownDays(DAYS_STEP);
  };

  const cards = (list: Match[]) => (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((m) => (
        <MatchCard key={m.id} match={m} initialPred={preds[m.id] ?? null} loggedIn={loggedIn} />
      ))}
    </div>
  );

  const ShowMore = ({ total }: { total: number }) =>
    shownDays < total ? (
      <div className="flex justify-center pt-2">
        <button
          onClick={() => setShownDays((n) => n + DAYS_STEP)}
          className="rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-emerald-100/70 transition hover:border-grass-500/40 hover:text-grass-300"
        >
          Show more days · {total - shownDays} left
        </button>
      </div>
    ) : null;

  // ----- Upcoming: not-finished matches grouped by local day -----
  const days = useMemo(() => {
    const upcoming = matches
      .filter((m) => m.status !== "FINISHED")
      .sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff));
    const map = new Map<string, { label: string; games: Match[] }>();
    for (const m of upcoming) {
      const k = dayKey(m.kickoff);
      if (!map.has(k)) map.set(k, { label: dayLabel(m.kickoff), games: [] });
      map.get(k)!.games.push(m);
    }
    return [...map.values()];
  }, [matches]);

  // ----- Results: finished matches, most-recent day first (newest → oldest) -----
  const resultDays = useMemo(() => {
    const fin = matches
      .filter((m) => m.status === "FINISHED")
      .sort((a, b) => +new Date(b.kickoff) - +new Date(a.kickoff));
    const map = new Map<string, { label: string; games: Match[] }>();
    for (const m of fin) {
      const k = dayKey(m.kickoff);
      if (!map.has(k)) map.set(k, { label: dayLabel(m.kickoff), games: [] });
      map.get(k)!.games.push(m);
    }
    return [...map.values()];
  }, [matches]);

  // ----- All: by stage, group stage split by matchday -----
  const byStage = useMemo(() => {
    const m = new Map<Stage, Match[]>();
    for (const x of [...matches].sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff))) {
      if (!m.has(x.stage)) m.set(x.stage, []);
      m.get(x.stage)!.push(x);
    }
    return m;
  }, [matches]);
  const stages = STAGE_ORDER.filter((s) => byStage.has(s));

  return (
    <div className="space-y-8">
      {/* tabs */}
      <div className="flex items-center gap-2">
        <Tab active={view === "upcoming"} onClick={() => setViewReset("upcoming")}>
          Upcoming
        </Tab>
        <Tab active={view === "results"} onClick={() => setViewReset("results")}>
          Results
        </Tab>
        <Tab active={view === "all"} onClick={() => setViewReset("all")}>
          All matches
        </Tab>
        {view === "all" && (
          <nav className="ml-auto hidden flex-wrap gap-1.5 sm:flex">
            {stages.map((s) => (
              <a
                key={s}
                href={`#${slug(STAGE_LABELS[s])}`}
                className="chip border border-white/10 bg-white/5 text-emerald-100/60 transition hover:border-grass-500/40 hover:text-grass-300"
              >
                {STAGE_LABELS[s]}
              </a>
            ))}
          </nav>
        )}
      </div>

      {view === "upcoming" ? (
        days.length === 0 ? (
          <div className="card p-10 text-center text-sm text-emerald-100/60">
            No upcoming matches — the tournament is over. Check the{" "}
            <a href="/leaderboard" className="text-grass-300 underline">
              leaderboard
            </a>
            .
          </div>
        ) : (
          <div className="space-y-10">
            {days.slice(0, shownDays).map((d, i) => (
              <section key={d.label} className="animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                <DayHeader label={d.label} count={d.games.length} first={i === 0} />
                {cards(d.games)}
              </section>
            ))}
            <ShowMore total={days.length} />
          </div>
        )
      ) : view === "results" ? (
        resultDays.length === 0 ? (
          <div className="card p-10 text-center text-sm text-emerald-100/60">
            No matches played yet — results show here newest first.
          </div>
        ) : (
          <div className="space-y-10">
            {resultDays.slice(0, shownDays).map((d, i) => (
              <section key={d.label} className="animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                <DayHeader label={d.label} count={d.games.length} first={false} />
                {cards(d.games)}
              </section>
            ))}
            <ShowMore total={resultDays.length} />
          </div>
        )
      ) : (
        <div className="space-y-12">
          {stages.map((stage) => {
            const list = byStage.get(stage)!;
            return (
              <section key={stage} id={slug(STAGE_LABELS[stage])} className="scroll-mt-24">
                <div className="pitch-stripes mb-5 flex items-baseline gap-3 overflow-hidden rounded-xl border border-white/5 bg-pitch-900/40 px-4 py-3">
                  <h2 className="display text-2xl sm:text-3xl">{STAGE_LABELS[stage]}</h2>
                  <span className="tnum text-xs text-emerald-100/40">{list.length} matches</span>
                </div>
                {stage === "GROUP_STAGE" ? (
                  <div className="space-y-8">
                    {groupByMatchday(list).map(([md, games]) => (
                      <div key={String(md)}>
                        <div className="mb-3 flex items-center gap-3">
                          <h3 className="display text-xl text-grass-300">Matchday {md}</h3>
                          <span className="h-px flex-1 bg-white/10" />
                          <span className="tnum text-xs text-emerald-100/40">{games.length}</span>
                        </div>
                        {cards(games)}
                      </div>
                    ))}
                  </div>
                ) : (
                  cards(list)
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
        active
          ? "bg-grass-500 text-pitch-950"
          : "border border-white/10 bg-white/5 text-emerald-100/60 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function DayHeader({ label, count, first }: { label: string; count: number; first: boolean }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className={`h-2 w-2 rounded-full ${first ? "animate-pulse-dot bg-grass-400" : "bg-emerald-100/30"}`} />
      <h2 className="display text-2xl sm:text-3xl">{label}</h2>
      {first && <span className="chip bg-grass-500/15 text-grass-300">Next up</span>}
      <span className="h-px flex-1 bg-white/10" />
      <span className="tnum text-xs text-emerald-100/40">{count} matches</span>
    </div>
  );
}

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
