"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { BracketRound, BracketSlot } from "@/lib/bracket";

export type KOMatch = {
  home_team: string;
  away_team: string;
  winner: "HOME" | "AWAY" | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
};

type Props = {
  rounds: BracketRound[];
  num2id: Record<number, string>;
  matchById: Record<string, KOMatch>;
  crestByTeam: Record<string, string>;
  initialPicks: Record<string, string>;
  locked: boolean;
  ready: boolean;
  loggedIn: boolean;
};

// Two-sided (mirrored) bracket: left half flows right, right half flows left, Final in the centre.
const LEFT = [
  { stage: "LAST_32", nums: [74, 77, 73, 75, 83, 84, 81, 82] },
  { stage: "LAST_16", nums: [89, 90, 93, 94] },
  { stage: "QUARTER_FINALS", nums: [97, 98] },
  { stage: "SEMI_FINALS", nums: [101] },
];
const RIGHT = [
  { stage: "SEMI_FINALS", nums: [102] },
  { stage: "QUARTER_FINALS", nums: [99, 100] },
  { stage: "LAST_16", nums: [91, 92, 95, 96] },
  { stage: "LAST_32", nums: [76, 78, 79, 80, 86, 88, 85, 87] },
];
const STAGE_LABEL: Record<string, string> = {
  LAST_32: "R32",
  LAST_16: "R16",
  QUARTER_FINALS: "QF",
  SEMI_FINALS: "SF",
};

const COL_W = 150;
const GAP = 10;
const PITCH = 60; // vertical per R32 row (8 rows per side)

export function BracketTree({
  rounds,
  num2id,
  matchById,
  crestByTeam,
  initialPicks,
  locked,
  ready,
  loggedIn,
}: Props) {
  const [picks, setPicks] = useState<Record<string, string>>(initialPicks);
  const [error, setError] = useState<string | null>(null);

  const slotByNum: Record<number, BracketSlot> = {};
  for (const rd of rounds) for (const s of rd.slots) slotByNum[s.matchNumber] = s;

  const fitRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [paths, setPaths] = useState<string[]>([]);
  const [scale, setScale] = useState(1);

  function teamsFor(slot: BracketSlot): [string | null, string | null] {
    const m = slot.matchId ? matchById[slot.matchId] : null;
    if (m && m.home_team && m.home_team !== "TBD" && m.away_team && m.away_team !== "TBD") {
      return [m.home_team, m.away_team];
    }
    if (slot.stage === "LAST_32") return [slot.homeTeam, slot.awayTeam];
    if (!slot.feeders) return [null, null];
    const [f1, f2] = slot.feeders;
    return [picks[num2id[f1]] ?? null, picks[num2id[f2]] ?? null];
  }

  function recompute(p: Record<string, string>): Record<string, string> {
    let changed = true;
    const next = { ...p };
    while (changed) {
      changed = false;
      for (const rd of rounds) {
        for (const slot of rd.slots) {
          if (!slot.matchId || slot.stage === "LAST_32" || !slot.feeders) continue;
          const m = matchById[slot.matchId];
          if (m && m.home_team !== "TBD" && m.away_team !== "TBD") continue;
          const cur = next[slot.matchId];
          if (!cur) continue;
          const [f1, f2] = slot.feeders;
          const a = next[num2id[f1]] ?? null;
          const b = next[num2id[f2]] ?? null;
          if (cur !== a && cur !== b) {
            delete next[slot.matchId];
            changed = true;
          }
        }
      }
    }
    return next;
  }

  async function pick(slot: BracketSlot, team: string) {
    if (!loggedIn) return window.dispatchEvent(new Event("open-auth"));
    const next = recompute({ ...picks, [slot.matchId!]: team });
    setPicks(next);
    setError(null);
    const res = await fetch("/api/bracket-predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match_id: slot.matchId, team }),
    });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Could not save");
  }

  useLayoutEffect(() => {
    function layout() {
      const inner = innerRef.current;
      const fit = fitRef.current;
      if (!inner || !fit) return;
      // connectors from offset positions (transform-independent)
      const at = (n: number) => {
        const el = slotRefs.current[n];
        if (!el) return null;
        return { l: el.offsetLeft, r: el.offsetLeft + el.offsetWidth, cy: el.offsetTop + el.offsetHeight / 2, cx: el.offsetLeft + el.offsetWidth / 2 };
      };
      const out: string[] = [];
      for (const rd of rounds) {
        for (const slot of rd.slots) {
          if (!slot.feeders) continue;
          const to = at(slot.matchNumber);
          if (!to) continue;
          for (const f of slot.feeders) {
            const from = at(f);
            if (!from) continue;
            const fromPt = from.cx < to.cx ? { x: from.r, y: from.cy } : { x: from.l, y: from.cy };
            const toPt = from.cx < to.cx ? { x: to.l, y: to.cy } : { x: to.r, y: to.cy };
            const midX = (fromPt.x + toPt.x) / 2;
            out.push(`M${fromPt.x},${fromPt.y} H${midX} V${toPt.y} H${toPt.x}`);
          }
        }
      }
      setPaths(out);
      const natural = inner.offsetWidth;
      const avail = fit.clientWidth;
      setScale(natural > avail ? avail / natural : 1);
    }
    layout();
    const ro = new ResizeObserver(layout);
    if (fitRef.current) ro.observe(fitRef.current);
    window.addEventListener("resize", layout);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", layout);
    };
  }, [picks, ready, rounds, matchById]);

  const finalSlot = slotByNum[104];
  const finalM = finalSlot?.matchId ? matchById[finalSlot.matchId] : null;
  const actualChampion =
    finalM?.status === "FINISHED" && finalM.winner
      ? finalM.winner === "HOME"
        ? finalM.home_team
        : finalM.away_team
      : undefined;
  const pickedChampion = finalSlot?.matchId ? picks[finalSlot.matchId] : undefined;
  const champion = actualChampion ?? pickedChampion;
  const champCorrect = actualChampion && pickedChampion ? actualChampion === pickedChampion : null;

  const colHeight = 8 * PITCH;
  const naturalW = 9 * COL_W + 8 * GAP;

  const renderCol = (col: { stage: string; nums: number[] }, key: string) => (
    <div key={key} className="flex shrink-0 flex-col justify-around" style={{ width: COL_W, height: colHeight }}>
      <div className="display mb-0.5 text-center text-[10px] text-gold-300/80">{STAGE_LABEL[col.stage]}</div>
      {col.nums.map((n) => (
        <Slot
          key={n}
          slot={slotByNum[n]}
          matchById={matchById}
          crestByTeam={crestByTeam}
          picks={picks}
          teamsFor={teamsFor}
          locked={locked}
          ready={ready}
          onPick={pick}
          slotRefs={slotRefs}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-3">
      <div ref={fitRef} className="relative w-full overflow-hidden">
        {!ready && (
          <div className="absolute inset-0 z-20 grid place-items-center rounded-2xl bg-pitch-950/75 backdrop-blur-sm">
            <div className="card max-w-xs p-6 text-center">
              <div className="text-3xl">🔒</div>
              <p className="display mt-2 text-lg">Locked until the group stage ends</p>
              <p className="mt-1 text-xs text-emerald-100/55">
                The knockout bracket opens once the 32 qualifiers are decided.
              </p>
            </div>
          </div>
        )}

        {/* scale-to-fit wrapper: the whole tree always fits the width — never scrolls */}
        <div style={{ height: colHeight * scale + 24 }}>
          <div ref={innerRef} style={{ width: naturalW, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <div className="relative flex items-start gap-2.5">
              <svg className="pointer-events-none absolute inset-0 z-0" width={naturalW} height={colHeight + 24} fill="none">
                {paths.map((d, i) => (
                  <path key={i} d={d} stroke="rgba(245,197,66,0.22)" strokeWidth={1.5} />
                ))}
              </svg>

              {LEFT.map((c, i) => renderCol(c, "L" + i))}

              {/* centre: Final + Champion */}
              <div className="z-10 flex shrink-0 flex-col justify-center" style={{ width: COL_W, height: colHeight }}>
                <div className="display mb-0.5 text-center text-[10px] text-gold-300/80">Final</div>
                {finalSlot && (
                  <Slot
                    slot={finalSlot}
                    matchById={matchById}
                    crestByTeam={crestByTeam}
                    picks={picks}
                    teamsFor={teamsFor}
                    locked={locked}
                    ready={ready}
                    onPick={pick}
                    slotRefs={slotRefs}
                  />
                )}
                <div
                  className={`mt-2 rounded-xl border p-2 text-center ${
                    actualChampion ? "border-gold-500/60 bg-gold-500/15 shadow-glow" : "border-dashed border-white/10 bg-pitch-900/40"
                  }`}
                >
                  <div className="text-lg leading-none">🏆</div>
                  <div className={`display mt-1 truncate text-xs ${champion ? "text-gold-300" : "text-emerald-100/25"}`}>
                    {champion ?? "—"}
                  </div>
                  {champCorrect !== null && pickedChampion && (
                    <div className={`text-[8px] uppercase ${champCorrect ? "text-grass-300" : "text-rose-300"}`}>
                      {champCorrect ? "✓ called it" : "✗ missed"}
                    </div>
                  )}
                </div>
              </div>

              {RIGHT.map((c, i) => renderCol(c, "R" + i))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-emerald-100/45">
        <span><span className="text-gold-300">▲ gold</span> = advanced (real)</span>
        <span><span className="text-grass-300">green</span> = your correct call</span>
        <span><span className="text-rose-300">red</span> = miss</span>
      </div>
      {error && <p className="text-xs text-rose-300">{error}</p>}
      {!loggedIn && ready && !locked && (
        <p className="text-[11px] text-emerald-100/40">Sign in to fill your bracket.</p>
      )}
    </div>
  );
}

function Slot({
  slot,
  matchById,
  crestByTeam,
  picks,
  teamsFor,
  locked,
  ready,
  onPick,
  slotRefs,
}: {
  slot: BracketSlot;
  matchById: Record<string, KOMatch>;
  crestByTeam: Record<string, string>;
  picks: Record<string, string>;
  teamsFor: (s: BracketSlot) => [string | null, string | null];
  locked: boolean;
  ready: boolean;
  onPick: (s: BracketSlot, team: string) => void;
  slotRefs: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
}) {
  const m = slot.matchId ? matchById[slot.matchId] : null;
  const finished = m?.status === "FINISHED";
  const [ta, tb] = teamsFor(slot);
  const actualWinner = finished && m ? (m.winner === "HOME" ? m.home_team : m.away_team) : null;
  const userPick = slot.matchId ? picks[slot.matchId] : null;
  const editable = !locked && ready && !finished && !!ta && !!tb;
  const miss = finished && userPick && userPick !== actualWinner;

  return (
    <div
      ref={(el) => {
        slotRefs.current[slot.matchNumber] = el;
      }}
      className="relative z-10 my-1 overflow-hidden rounded-md border border-white/10 bg-pitch-900/80 shadow-card"
    >
      <Row team={ta} crest={ta ? crestByTeam[ta] : undefined} isWinner={!!actualWinner && ta === actualWinner} isPick={!!userPick && ta === userPick} editable={editable} onPick={() => ta && onPick(slot, ta)} />
      <div className="h-px bg-white/5" />
      <Row team={tb} crest={tb ? crestByTeam[tb] : undefined} isWinner={!!actualWinner && tb === actualWinner} isPick={!!userPick && tb === userPick} editable={editable} onPick={() => tb && onPick(slot, tb)} />
      {miss && (
        <div className="bg-rose-500/10 px-1.5 py-0.5 text-[8px] uppercase tracking-wide text-rose-300">
          ✗ you: {userPick!.split(" ")[0]}
        </div>
      )}
    </div>
  );
}

function Row({
  team,
  crest,
  isWinner,
  isPick,
  editable,
  onPick,
}: {
  team: string | null;
  crest?: string;
  isWinner: boolean;
  isPick: boolean;
  editable: boolean;
  onPick: () => void;
}) {
  return (
    <button
      disabled={!team || !editable}
      onClick={onPick}
      title={team ?? undefined}
      className={`flex w-full items-center gap-1.5 px-1.5 py-1 text-left text-[11px] transition ${
        isWinner
          ? "bg-gold-500/20 font-bold text-gold-100"
          : isPick
            ? "bg-grass-500/12 font-semibold text-grass-200"
            : team
              ? editable
                ? "hover:bg-white/5"
                : ""
              : "italic text-emerald-100/25"
      }`}
    >
      {team && crest ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={crest} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" loading="lazy" />
      ) : (
        <span className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="truncate">{team ?? "winner"}</span>
      {isWinner && <span className="ml-auto shrink-0 text-[9px] text-gold-300">▲</span>}
      {isPick && !isWinner && <span className="ml-auto shrink-0 text-[8px] text-grass-300">you</span>}
    </button>
  );
}
