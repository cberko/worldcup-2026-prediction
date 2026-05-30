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
  initialPicks: Record<string, string>;
  locked: boolean;
  ready: boolean;
  loggedIn: boolean;
};

const PITCH = 64;

export function BracketTree({ rounds, num2id, matchById, initialPicks, locked, ready, loggedIn }: Props) {
  const [picks, setPicks] = useState<Record<string, string>>(initialPicks);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [paths, setPaths] = useState<string[]>([]);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  // teams entering a slot: actual (once known) else the user's cascade
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
          if (!slot.matchId) continue;
          const m = matchById[slot.matchId];
          const actualKnown = m && m.home_team !== "TBD" && m.away_team !== "TBD";
          if (actualKnown) continue; // don't clear picks once the real match exists
          const cur = next[slot.matchId];
          if (!cur) continue;
          if (slot.stage === "LAST_32") continue;
          const [f1, f2] = slot.feeders!;
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
    function draw() {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const wr = wrap.getBoundingClientRect();
      const at = (n: number, side: "l" | "r") => {
        const el = slotRefs.current[n];
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: (side === "r" ? r.right : r.left) - wr.left, y: r.top - wr.top + r.height / 2 };
      };
      const out: string[] = [];
      for (const rd of rounds) {
        for (const slot of rd.slots) {
          if (!slot.feeders) continue;
          const to = at(slot.matchNumber, "l");
          if (!to) continue;
          for (const f of slot.feeders) {
            const from = at(f, "r");
            if (!from) continue;
            const midX = (from.x + to.x) / 2;
            out.push(`M${from.x},${from.y} H${midX} V${to.y} H${to.x}`);
          }
        }
      }
      setPaths(out);
      setDims({ w: wrap.scrollWidth, h: wrap.scrollHeight });
    }
    draw();
    const ro = new ResizeObserver(draw);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener("resize", draw);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", draw);
    };
  }, [picks, ready, rounds, matchById]);

  const finalId = num2id[104];
  const finalMatch = finalId ? matchById[finalId] : undefined;
  const actualChampion =
    finalMatch?.status === "FINISHED" && finalMatch.winner
      ? finalMatch.winner === "HOME"
        ? finalMatch.home_team
        : finalMatch.away_team
      : undefined;
  const pickedChampion = finalId ? picks[finalId] : undefined;
  const champion = actualChampion ?? pickedChampion;
  const champCorrect = actualChampion && pickedChampion ? actualChampion === pickedChampion : null;
  const totalH = 16 * PITCH;

  return (
    <div className="space-y-3">
      <div className="relative overflow-x-auto">
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

        <div ref={wrapRef} className="relative flex w-full items-stretch gap-3" style={{ minHeight: totalH }}>
          <svg className="pointer-events-none absolute inset-0 z-0" width={dims.w} height={dims.h} fill="none">
            {paths.map((d, i) => (
              <path key={i} d={d} stroke="rgba(245,197,66,0.20)" strokeWidth={1.5} />
            ))}
          </svg>

          {rounds.map((rd) => (
            <div key={rd.stage} className="relative z-10 flex min-w-0 flex-1 flex-col justify-around">
              <div className="display mb-1 text-center text-[11px] text-gold-300/90">{rd.label}</div>
              {rd.slots.map((slot) => {
                const m = slot.matchId ? matchById[slot.matchId] : null;
                const finished = m?.status === "FINISHED";
                const [ta, tb] = teamsFor(slot);
                const actualWinner = finished && m ? (m.winner === "HOME" ? m.home_team : m.away_team) : null;
                const userPick = slot.matchId ? picks[slot.matchId] : null;
                const editable = !locked && ready && !finished && !!ta && !!tb;
                return (
                  <div
                    key={slot.matchNumber}
                    ref={(el) => {
                      slotRefs.current[slot.matchNumber] = el;
                    }}
                    className="my-1 overflow-hidden rounded-lg border border-white/10 bg-pitch-900/70 shadow-card"
                  >
                    <Row
                      team={ta}
                      isWinner={!!actualWinner && ta === actualWinner}
                      isPick={!!userPick && ta === userPick}
                      editable={editable}
                      onPick={() => ta && pick(slot, ta)}
                    />
                    <div className="h-px bg-white/5" />
                    <Row
                      team={tb}
                      isWinner={!!actualWinner && tb === actualWinner}
                      isPick={!!userPick && tb === userPick}
                      editable={editable}
                      onPick={() => tb && pick(slot, tb)}
                    />
                    {finished && userPick && (
                      <div
                        className={`flex items-center gap-1 px-2 py-0.5 text-[9px] uppercase tracking-wide ${
                          userPick === actualWinner ? "bg-grass-500/10 text-grass-300" : "bg-rose-500/10 text-rose-300"
                        }`}
                      >
                        {userPick === actualWinner ? "✓" : "✗"} you: {userPick.split(" ")[0]}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* champion */}
          <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-around">
            <div className="display mb-1 text-center text-[11px] text-gold-300/90">Champion</div>
            <div
              className={`rounded-xl border p-3 text-center transition ${
                actualChampion
                  ? "border-gold-500/60 bg-gold-500/15 shadow-glow"
                  : champion
                    ? "border-gold-500/30 bg-gold-500/10"
                    : "border-dashed border-white/10 bg-pitch-900/40"
              }`}
            >
              <div className="text-xl">🏆</div>
              <div className={`display mt-1 truncate text-sm ${champion ? "text-gold-300" : "text-emerald-100/25"}`}>
                {champion ?? "—"}
              </div>
              {champCorrect !== null && pickedChampion && (
                <div className={`mt-1 text-[9px] uppercase tracking-wide ${champCorrect ? "text-grass-300" : "text-rose-300"}`}>
                  {champCorrect ? "✓ you called it" : `✗ you: ${pickedChampion.split(" ")[0]}`}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-rose-300">{error}</p>}
      {!loggedIn && ready && !locked && (
        <p className="text-[11px] text-emerald-100/40">Sign in to fill your bracket.</p>
      )}
    </div>
  );
}

function Row({
  team,
  isWinner,
  isPick,
  editable,
  onPick,
}: {
  team: string | null;
  isWinner: boolean;
  isPick: boolean;
  editable: boolean;
  onPick: () => void;
}) {
  return (
    <button
      disabled={!team || !editable}
      onClick={onPick}
      className={`flex w-full items-center gap-1 px-2 py-1.5 text-left text-[11px] transition ${
        isWinner
          ? "bg-gold-500/20 font-bold text-gold-200"
          : isPick
            ? "bg-grass-500/10 font-semibold text-grass-200"
            : team
              ? editable
                ? "hover:bg-white/5"
                : ""
              : "italic text-emerald-100/25"
      }`}
    >
      <span className="truncate">{team ?? "winner"}</span>
      {isPick && <span className="ml-auto text-[9px] text-grass-300">·you</span>}
      {isWinner && <span className="ml-auto text-[9px] text-gold-300">▲</span>}
    </button>
  );
}
