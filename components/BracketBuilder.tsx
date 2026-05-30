"use client";

import { useState } from "react";
import type { BracketRound, BracketSlot } from "@/lib/bracket";

type Props = {
  rounds: BracketRound[];
  num2id: Record<number, string>;
  initialPicks: Record<string, string>;
  locked: boolean;
  ready: boolean; // R32 teams known (group stage done)
  loggedIn: boolean;
};

export function BracketBuilder({ rounds, num2id, initialPicks, locked, ready, loggedIn }: Props) {
  const [picks, setPicks] = useState<Record<string, string>>(initialPicks);
  const [error, setError] = useState<string | null>(null);

  // The two candidate teams entering a slot, given current picks.
  function candidates(slot: BracketSlot, p: Record<string, string>): [string | null, string | null] {
    if (slot.stage === "LAST_32") return [slot.homeTeam, slot.awayTeam];
    if (!slot.feeders) return [null, null];
    const [f1, f2] = slot.feeders;
    return [p[num2id[f1]] ?? null, p[num2id[f2]] ?? null];
  }

  // Drop any downstream pick that's no longer a valid candidate after a change.
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
    if (locked || !slot.matchId) return;
    if (!loggedIn) {
      window.dispatchEvent(new Event("open-auth"));
      return;
    }
    if (!ready) return;
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

  const finalId = num2id[104];
  const champion = finalId ? picks[finalId] : undefined;

  return (
    <div className="space-y-4">
      {champion && (
        <div className="card flex items-center justify-center gap-3 border-gold-500/30 bg-gold-500/10 p-4">
          <span className="text-2xl">🏆</span>
          <span className="text-xs uppercase tracking-wider text-emerald-100/50">Your champion</span>
          <span className="display text-2xl text-gold-300">{champion}</span>
        </div>
      )}

      <div className="relative">
        {!ready && (
          <div className="absolute inset-0 z-10 grid place-items-center rounded-2xl bg-pitch-950/70 backdrop-blur-sm">
            <div className="card max-w-xs p-6 text-center">
              <div className="text-3xl">🏆</div>
              <p className="display mt-2 text-lg">Opens after the group stage</p>
              <p className="mt-1 text-xs text-emerald-100/55">
                Once the 32 qualifiers are set you&apos;ll fill every round to the champion.
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-3 overflow-x-auto pb-3">
          {rounds.map((rd) => (
            <div key={rd.stage} className="flex w-52 shrink-0 flex-col gap-2">
              <div className="display sticky top-0 text-center text-sm text-gold-300">{rd.label}</div>
              {rd.slots.map((slot) => {
                const [a, b] = candidates(slot, picks);
                const sel = slot.matchId ? picks[slot.matchId] : undefined;
                return (
                  <div key={slot.matchNumber} className="card space-y-1 p-1.5">
                    <SlotTeam team={a} selected={sel === a && !!a} locked={locked} onPick={() => a && pick(slot, a)} />
                    <SlotTeam team={b} selected={sel === b && !!b} locked={locked} onPick={() => b && pick(slot, b)} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-rose-300">{error}</p>}
      {!loggedIn && ready && !locked && (
        <p className="text-[11px] text-emerald-100/40">Sign in to save your bracket.</p>
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
      className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs transition ${
        selected
          ? "bg-gold-500/20 font-bold text-gold-200 ring-1 ring-gold-400/50"
          : team
            ? "bg-pitch-950/40 hover:bg-white/5"
            : "bg-pitch-950/20 text-emerald-100/25"
      } ${locked ? "cursor-default" : ""}`}
    >
      <span className="truncate">{team ?? "—"}</span>
      {selected && <span className="ml-auto text-[10px]">✓</span>}
    </button>
  );
}
