"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { BracketRound, BracketSlot } from "@/lib/bracket";

type Props = {
  rounds: BracketRound[];
  num2id: Record<number, string>;
  initialPicks: Record<string, string>;
  locked: boolean;
  ready: boolean; // R32 teams known (group stage done)
  loggedIn: boolean;
};

const SLOT_W = 176;
const PITCH = 70; // vertical pitch per R32 slot

export function BracketBuilder({ rounds, num2id, initialPicks, locked, ready, loggedIn }: Props) {
  const [picks, setPicks] = useState<Record<string, string>>(initialPicks);
  const [error, setError] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [paths, setPaths] = useState<string[]>([]);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  function candidates(slot: BracketSlot, p: Record<string, string>): [string | null, string | null] {
    if (slot.stage === "LAST_32") return [slot.homeTeam, slot.awayTeam];
    if (!slot.feeders) return [null, null];
    const [f1, f2] = slot.feeders;
    return [p[num2id[f1]] ?? null, p[num2id[f2]] ?? null];
  }

  function recompute(p: Record<string, string>): Record<string, string> {
    let changed = true;
    const next = { ...p };
    while (changed) {
      changed = false;
      for (const rd of rounds) {
        for (const slot of rd.slots) {
          if (!slot.matchId) continue;
          const cur = next[slot.matchId];
          if (!cur) continue;
          const [a, b] = candidates(slot, next);
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
    if (locked || !slot.matchId || !ready) {
      if (!loggedIn && ready && !locked) window.dispatchEvent(new Event("open-auth"));
      return;
    }
    if (!loggedIn) {
      window.dispatchEvent(new Event("open-auth"));
      return;
    }
    const next = recompute({ ...picks, [slot.matchId]: team });
    setPicks(next);
    setError(null);
    const res = await fetch("/api/bracket-predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match_id: slot.matchId, team }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not save");
    }
  }

  // draw elbow connectors between feeder slots and their next-round slot
  useLayoutEffect(() => {
    function draw() {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const wr = wrap.getBoundingClientRect();
      const center = (n: number, side: "l" | "r") => {
        const el = slotRefs.current[n];
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: (side === "r" ? r.right : r.left) - wr.left, y: r.top - wr.top + r.height / 2 };
      };
      const next: string[] = [];
      for (const rd of rounds) {
        for (const slot of rd.slots) {
          if (!slot.feeders) continue;
          const to = center(slot.matchNumber, "l");
          if (!to) continue;
          for (const f of slot.feeders) {
            const from = center(f, "r");
            if (!from) continue;
            const midX = (from.x + to.x) / 2;
            next.push(`M${from.x},${from.y} H${midX} V${to.y} H${to.x}`);
          }
        }
      }
      setPaths(next);
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
  }, [picks, ready, rounds]);

  const finalId = num2id[104];
  const champion = finalId ? picks[finalId] : undefined;
  const totalH = 16 * PITCH;

  return (
    <div className="space-y-4">
      <div className="relative overflow-x-auto pb-2">
        {!ready && (
          <div className="absolute inset-0 z-20 grid place-items-center rounded-2xl bg-pitch-950/75 backdrop-blur-sm">
            <div className="card max-w-xs p-6 text-center">
              <div className="text-3xl">🏆</div>
              <p className="display mt-2 text-lg">Opens after the group stage</p>
              <p className="mt-1 text-xs text-emerald-100/55">
                Once the 32 qualifiers are set you&apos;ll fill every round to the champion.
              </p>
            </div>
          </div>
        )}

        <div ref={wrapRef} className="relative flex items-stretch gap-7" style={{ minHeight: totalH }}>
          {/* connector layer */}
          <svg
            className="pointer-events-none absolute inset-0 z-0"
            width={dims.w}
            height={dims.h}
            fill="none"
          >
            {paths.map((d, i) => (
              <path key={i} d={d} stroke="rgba(245,197,66,0.22)" strokeWidth={1.5} />
            ))}
          </svg>

          {rounds.map((rd) => (
            <div
              key={rd.stage}
              className="relative z-10 flex shrink-0 flex-col justify-around"
              style={{ width: SLOT_W }}
            >
              <div className="display sticky top-0 mb-1 text-center text-xs text-gold-300/90">
                {rd.label}
              </div>
              {rd.slots.map((slot) => {
                const [a, b] = candidates(slot, picks);
                const sel = slot.matchId ? picks[slot.matchId] : undefined;
                return (
                  <div
                    key={slot.matchNumber}
                    ref={(el) => {
                      slotRefs.current[slot.matchNumber] = el;
                    }}
                    className="my-1.5 overflow-hidden rounded-lg border border-white/10 bg-pitch-900/70 shadow-card"
                  >
                    <SlotTeam team={a} selected={sel === a && !!a} locked={locked} onPick={() => a && pick(slot, a)} />
                    <div className="h-px bg-white/5" />
                    <SlotTeam team={b} selected={sel === b && !!b} locked={locked} onPick={() => b && pick(slot, b)} />
                  </div>
                );
              })}
            </div>
          ))}

          {/* champion node */}
          <div className="relative z-10 flex shrink-0 flex-col justify-around" style={{ width: SLOT_W }}>
            <div className="display sticky top-0 mb-1 text-center text-xs text-gold-300/90">Champion</div>
            <div
              className={`grid place-items-center rounded-xl border p-4 text-center transition ${
                champion
                  ? "border-gold-500/50 bg-gold-500/10 shadow-glow"
                  : "border-dashed border-white/10 bg-pitch-900/40"
              }`}
            >
              <div className="text-2xl">🏆</div>
              <div className={`display mt-1 text-base ${champion ? "text-gold-300" : "text-emerald-100/25"}`}>
                {champion ?? "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-rose-300">{error}</p>}
      {!loggedIn && ready && !locked && (
        <p className="text-[11px] text-emerald-100/40">Sign in to save your bracket.</p>
      )}
      {ready && (
        <p className="text-[11px] text-emerald-100/35">
          Tip: scroll sideways to follow the tree. Pick a winner in each match — it flows to the next round.
        </p>
      )}
    </div>
  );
}

function SlotTeam({
  team,
  selected,
  locked,
  onPick,
}: {
  team: string | null;
  selected: boolean;
  locked: boolean;
  onPick: () => void;
}) {
  return (
    <button
      disabled={!team || locked}
      onClick={onPick}
      className={`flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-xs transition ${
        selected
          ? "bg-gold-500/20 font-bold text-gold-200"
          : team
            ? "hover:bg-white/5"
            : "italic text-emerald-100/25"
      } ${locked ? "cursor-default" : ""}`}
    >
      <span className="truncate">{team ?? "winner"}</span>
      {selected && <span className="ml-auto text-[10px] text-gold-300">✓</span>}
    </button>
  );
}
