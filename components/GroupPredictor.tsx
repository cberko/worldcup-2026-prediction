"use client";

import { useState } from "react";

export type GroupData = {
  group_name: string;
  teams: string[]; // the 4 teams in this group
  predicted: string[] | null; // user's saved 1→4 ordering
  points: number | null; // earned points once final
  actual: string[] | null; // final standings 1→4, when group is final
};

const label = (g: string) => g.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function GroupCard({
  data,
  locked,
  loggedIn,
}: {
  data: GroupData;
  locked: boolean;
  loggedIn: boolean;
}) {
  const initial = data.predicted ?? data.teams;
  const [order, setOrder] = useState<string[]>(initial);
  const [savedOrder, setSavedOrder] = useState<string[] | null>(data.predicted);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = !savedOrder || savedOrder.join("|") !== order.join("|");

  function move(i: number, dir: -1 | 1) {
    if (locked) return;
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  }

  async function save() {
    if (locked || saving || !dirty) return;
    if (!loggedIn) {
      window.dispatchEvent(new Event("open-auth"));
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/group-predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_name: data.group_name, ordering: order }),
    });
    setSaving(false);
    if (res.ok) setSavedOrder(order);
    else {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not save");
    }
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="display text-lg">{label(data.group_name)}</h3>
        {data.points !== null ? (
          <span className="chip bg-grass-500/20 text-grass-300">+{data.points} pts</span>
        ) : locked ? (
          <span className="chip bg-gold-500/15 text-gold-300">🔒 Locked</span>
        ) : (
          <span className="chip bg-grass-500/15 text-grass-300">Open</span>
        )}
      </div>

      <ol className="space-y-1.5">
        {order.map((team, i) => {
          const correct = data.actual ? data.actual[i] === team : null;
          return (
            <li
              key={team}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${
                correct === true
                  ? "border-grass-500/50 bg-grass-500/10"
                  : correct === false
                    ? "border-rose-500/30 bg-rose-500/5"
                    : "border-white/10 bg-pitch-950/40"
              }`}
            >
              <span className="tnum w-5 text-center text-sm font-bold text-emerald-100/50">
                {i + 1}
              </span>
              <span className="flex-1 truncate text-sm font-semibold">{team}</span>
              {data.actual && (
                <span className="text-xs">{correct ? "✓" : "✗"}</span>
              )}
              {!locked && (
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
              )}
            </li>
          );
        })}
      </ol>

      {!locked && (
        <button
          onClick={save}
          disabled={saving || (!dirty && !!savedOrder)}
          className={`mt-3 w-full rounded-lg py-2 text-xs font-bold uppercase tracking-wider transition ${
            dirty
              ? "bg-grass-500 text-pitch-950 hover:bg-grass-400"
              : "border border-grass-500/30 bg-grass-500/10 text-grass-300"
          }`}
        >
          {saving ? "Saving…" : !loggedIn ? "Sign in to predict" : dirty ? "Save order" : "✓ Saved"}
        </button>
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
