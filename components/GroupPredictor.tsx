"use client";

import { useEffect, useRef, useState } from "react";

export type StandRow = {
  position: number;
  team: string;
  played: number;
  points: number;
  gd: number;
};

export type GroupData = {
  group_name: string;
  rows: StandRow[]; // current standings, sorted by position
  predicted: string[] | null; // user's predicted 1→4 order
  points: number | null; // scored points (when final)
  final: boolean;
};

const label = (g: string) => g.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function GroupCard({ data, locked, loggedIn }: { data: GroupData; locked: boolean; loggedIn: boolean }) {
  const teamsInOrder = data.rows.map((r) => r.team);
  const hasResults = data.rows.some((r) => r.played > 0);
  const tableMode = locked || hasResults; // show live/scored standings once it matters

  const [order, setOrder] = useState<string[]>(data.predicted ?? teamsInOrder);
  const [savedOrder, setSavedOrder] = useState<string[] | null>(data.predicted);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const dirty = !savedOrder || savedOrder.join("|") !== order.join("|");

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  }

  // Debounced auto-save: persist the order shortly after the last reorder.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (tableMode || !loggedIn || !dirty) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(order), 650);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, loggedIn, tableMode]);

  async function save(ord: string[]) {
    setState("saving");
    setError(null);
    const res = await fetch("/api/group-predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_name: data.group_name, ordering: ord }),
    });
    if (res.ok) {
      setSavedOrder(ord);
      setState("saved");
    } else {
      setError((await res.json().catch(() => ({}))).error ?? "Could not save");
      setState("error");
    }
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="display text-lg">{label(data.group_name)}</h3>
        {data.points !== null ? (
          <span className="chip bg-grass-500/20 text-grass-300">+{data.points} pts</span>
        ) : tableMode ? (
          <span className="chip bg-gold-500/15 text-gold-300">{data.final ? "Final" : "Live"}</span>
        ) : (
          <span className="chip bg-grass-500/15 text-grass-300">Predict</span>
        )}
      </div>

      {tableMode ? (
        // ---- live / scored standings table ----
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-emerald-100/35">
              <th className="pb-1 text-left font-medium">#</th>
              <th className="pb-1 text-left font-medium">Team</th>
              <th className="pb-1 text-right font-medium">P</th>
              <th className="pb-1 text-right font-medium">Pts</th>
              <th className="pb-1 w-5" />
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, i) => {
              const predTeam = data.predicted?.[i];
              const hit = data.predicted ? predTeam === r.team : null;
              const top2 = i < 2;
              return (
                <tr key={r.team} className="border-t border-white/5">
                  <td className="py-1.5">
                    <span className={`tnum ${top2 ? "text-grass-300" : "text-emerald-100/40"}`}>{i + 1}</span>
                  </td>
                  <td className="py-1.5 font-medium">{r.team}</td>
                  <td className="tnum py-1.5 text-right text-emerald-100/55">{r.played}</td>
                  <td className="tnum py-1.5 text-right font-bold">{r.points}</td>
                  <td className="py-1.5 text-right">
                    {hit === null ? null : hit ? (
                      <span className="text-grass-400">✓</span>
                    ) : (
                      <span className="text-rose-400">✗</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        // ---- editable predictor (drag-order 1→4) ----
        <ol className="space-y-1.5">
          {order.map((team, i) => (
            <li
              key={team}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-pitch-950/40 px-2.5 py-2"
            >
              <span className="tnum w-5 text-center text-sm font-bold text-emerald-100/50">{i + 1}</span>
              <span className="flex-1 truncate text-sm font-semibold">{team}</span>
              <span className="flex gap-1">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="grid h-6 w-6 place-items-center rounded border border-white/10 text-xs transition hover:bg-white/10 disabled:opacity-20"
                  aria-label="move up"
                >
                  ↑
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                  className="grid h-6 w-6 place-items-center rounded border border-white/10 text-xs transition hover:bg-white/10 disabled:opacity-20"
                  aria-label="move down"
                >
                  ↓
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}

      {!tableMode && (
        <div className="mt-3 flex justify-center">
          {!loggedIn ? (
            <button
              onClick={() => window.dispatchEvent(new Event("open-auth"))}
              className="rounded-lg bg-grass-500 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-pitch-950 transition hover:bg-grass-400"
            >
              Sign in to predict
            </button>
          ) : state === "saving" ? (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-100/55">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-grass-400" /> Saving…
            </span>
          ) : !dirty && savedOrder ? (
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-grass-300">
              ✓ Saved <span className="font-normal normal-case text-emerald-100/40">· reorder anytime</span>
            </span>
          ) : (
            <span className="text-[11px] font-medium text-gold-300/80">Reorder 1→4 — saves automatically</span>
          )}
        </div>
      )}
      {tableMode && data.predicted && (
        <p className="mt-2 text-[11px] text-emerald-100/40">
          Your call: {data.predicted.map((t) => t.split(" ")[0]).join(" · ")}
        </p>
      )}
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </div>
  );
}

export function GroupPredictor({
  groups,
  locked,
  loggedIn,
}: {
  groups: GroupData[];
  locked: boolean;
  loggedIn: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((g) => (
        <GroupCard key={g.group_name} data={g} locked={locked} loggedIn={loggedIn} />
      ))}
    </div>
  );
}
