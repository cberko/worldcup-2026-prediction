"use client";

import { useState } from "react";
import type { Match, ScorePick } from "@/lib/types";
import { isLocked } from "@/lib/types";
import { formatKickoff } from "@/lib/format";
import { scorePrediction, POINTS } from "@/lib/scoring";
import { StatusBadge } from "./StatusBadge";

function Crest({ url, alt }: { url: string | null; alt: string }) {
  if (!url) return <span className="grid h-7 w-7 place-items-center text-sm">🏳️</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className="h-7 w-7 object-contain" loading="lazy" />;
}

function Stepper({
  value,
  onChange,
  disabled,
  align,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
  align: "left" | "right";
}) {
  const btn =
    "grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 text-sm font-bold transition disabled:opacity-30 enabled:hover:bg-white/10 enabled:active:scale-95";
  return (
    <div className={`flex items-center gap-1.5 ${align === "right" ? "flex-row-reverse" : ""}`}>
      <button
        type="button"
        className={btn}
        disabled={disabled || value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
        aria-label="decrease"
      >
        −
      </button>
      <span className="w-7 text-center font-display text-xl font-extrabold tabular-nums">
        {value}
      </span>
      <button
        type="button"
        className={btn}
        disabled={disabled || value >= 30}
        onClick={() => onChange(Math.min(30, value + 1))}
        aria-label="increase"
      >
        +
      </button>
    </div>
  );
}

type Props = {
  match: Match;
  initialPred: ScorePick | null;
  loggedIn: boolean;
};

export function MatchCard({ match, initialPred, loggedIn }: Props) {
  const locked = isLocked(match);
  const finished = match.status === "FINISHED";

  const [home, setHome] = useState(initialPred?.home ?? 0);
  const [away, setAway] = useState(initialPred?.away ?? 0);
  const [saved, setSaved] = useState<ScorePick | null>(initialPred);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = !saved || saved.home !== home || saved.away !== away;
  const earned =
    finished && saved ? scorePrediction(match, saved.home, saved.away) : null;

  async function save() {
    if (locked || saving || !dirty) return;
    if (!loggedIn) {
      window.dispatchEvent(new Event("open-auth"));
      return;
    }
    setError(null);
    setSaving(true);
    const res = await fetch("/api/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match_id: match.id, home, away }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved({ home, away });
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Kaydedilemedi");
    }
  }

  return (
    <div className="card animate-fade-up p-4">
      {/* header */}
      <div className="mb-3 flex items-center justify-between gap-2 text-xs text-emerald-100/50">
        <span className="truncate">
          {match.group_name ? `${match.group_name} · ` : ""}
          {formatKickoff(match.kickoff)}
        </span>
        <StatusBadge status={match.status} locked={locked} />
      </div>

      {/* teams + actual score */}
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Crest url={match.home_crest} alt={match.home_team} />
          <span className="truncate text-sm font-semibold">{match.home_team}</span>
        </div>

        <div className="shrink-0 text-center">
          {match.home_score !== null && match.away_score !== null ? (
            <div className="font-display text-lg font-extrabold tabular-nums">
              {match.home_score}
              <span className="px-1 text-emerald-100/40">-</span>
              {match.away_score}
            </div>
          ) : (
            <span className="text-xs font-medium text-emerald-100/40">vs</span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right">
          <span className="truncate text-sm font-semibold">{match.away_team}</span>
          <Crest url={match.away_crest} alt={match.away_team} />
        </div>
      </div>

      {/* prediction area */}
      <div className="mt-4 rounded-xl border border-white/5 bg-pitch-800/40 p-3">
        {locked ? (
          // locked / finished → read-only view of the user's pick + result
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-emerald-100/50">Your pick</span>
            {saved ? (
              <div className="flex items-center gap-2">
                <span className="font-display text-base font-bold tabular-nums">
                  {saved.home} - {saved.away}
                </span>
                {earned !== null && (
                  <span
                    className={`chip ${
                      earned > 0
                        ? "bg-grass-500/15 text-grass-300"
                        : "bg-rose-500/15 text-rose-300"
                    }`}
                  >
                    {earned > 0 ? `+${earned}` : "0"} pts
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-emerald-100/40">No pick made</span>
            )}
          </div>
        ) : (
          // open → score steppers + save
          <>
            <div className="flex items-center justify-center gap-4">
              <Stepper value={home} onChange={setHome} disabled={saving} align="left" />
              <span className="font-display text-lg font-bold text-emerald-100/40">-</span>
              <Stepper value={away} onChange={setAway} disabled={saving} align="right" />
            </div>
            <button
              onClick={save}
              disabled={saving || (!dirty && !!saved)}
              className={`mt-3 w-full rounded-lg py-1.5 text-sm font-semibold transition ${
                dirty
                  ? "bg-grass-500 text-pitch-950 hover:bg-grass-400"
                  : "border border-grass-500/30 bg-grass-500/10 text-grass-300"
              } disabled:cursor-default`}
            >
              {saving
                ? "Saving…"
                : !loggedIn
                  ? "Sign in to predict"
                  : dirty
                    ? "Save pick"
                    : "✓ Saved"}
            </button>
          </>
        )}

        {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
      </div>

      <p className="mt-2 text-center text-[11px] text-emerald-100/35">
        Side +{POINTS.SIDE} · Goal diff +{POINTS.DIFF} · Exact +{POINTS.EXACT}
      </p>
    </div>
  );
}
