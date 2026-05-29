"use client";

import { useState } from "react";
import type { Match, ScorePick } from "@/lib/types";
import { isLocked } from "@/lib/types";
import { formatKickoff } from "@/lib/format";
import { scorePrediction, POINTS } from "@/lib/scoring";
import { StatusBadge } from "./StatusBadge";

const clampGoals = (n: number) => Math.max(0, Math.min(30, Math.trunc(n) || 0));

function Crest({ url, alt }: { url: string | null; alt: string }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} className="h-6 w-6 object-contain" loading="lazy" />
      ) : (
        <span className="text-sm">🏳️</span>
      )}
    </span>
  );
}

/** Editable score field: type a number directly OR use the −/+ steppers. */
function ScoreField({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  const btn =
    "grid h-7 w-7 shrink-0 place-items-center rounded-md border border-white/10 text-base font-bold leading-none transition disabled:opacity-25 enabled:hover:border-grass-500/50 enabled:hover:text-grass-300 enabled:active:scale-90";
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        className={btn}
        disabled={disabled || value <= 0}
        onClick={() => onChange(clampGoals(value - 1))}
        aria-label="decrease"
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={30}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(clampGoals(parseInt(e.target.value, 10)))}
        onFocus={(e) => e.currentTarget.select()}
        className="score-input h-11 w-12 rounded-lg border border-white/10 bg-pitch-950/70 text-center font-mono text-2xl font-bold tabular-nums text-emerald-50 outline-none transition focus:border-grass-500/70 focus:bg-pitch-950 disabled:opacity-60"
      />
      <button
        type="button"
        className={btn}
        disabled={disabled || value >= 30}
        onClick={() => onChange(clampGoals(value + 1))}
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
  const earned = finished && saved ? scorePrediction(match, saved.home, saved.away) : null;

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
    if (res.ok) setSaved({ home, away });
    else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save");
    }
  }

  const hasScore = match.home_score !== null && match.away_score !== null;

  return (
    <div className="card group p-4 transition-colors hover:border-white/10">
      {/* header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-medium uppercase tracking-wider text-emerald-100/40">
          {match.group_name ? `${match.group_name} · ` : ""}
          {formatKickoff(match.kickoff)}
        </span>
        <StatusBadge status={match.status} locked={locked} />
      </div>

      {/* teams + actual score */}
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Crest url={match.home_crest} alt={match.home_team} />
          <span className="truncate text-sm font-semibold leading-tight">{match.home_team}</span>
        </div>

        <div className="shrink-0 px-1 text-center">
          {hasScore ? (
            <div className="tnum text-2xl font-bold text-gold-300">
              {match.home_score}
              <span className="px-1 text-emerald-100/30">:</span>
              {match.away_score}
            </div>
          ) : (
            <span className="display text-sm text-emerald-100/30">vs</span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right">
          <span className="truncate text-sm font-semibold leading-tight">{match.away_team}</span>
          <Crest url={match.away_crest} alt={match.away_team} />
        </div>
      </div>

      {/* prediction block */}
      <div className="mt-4 rounded-xl border border-white/5 bg-pitch-950/40 p-3">
        {locked ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-100/40">
              Your pick
            </span>
            {saved ? (
              <div className="flex items-center gap-2.5">
                <span className="tnum text-lg font-bold">
                  {saved.home}–{saved.away}
                </span>
                {earned !== null && (
                  <span
                    className={`chip ${
                      earned > 0 ? "bg-grass-500/20 text-grass-300" : "bg-rose-500/15 text-rose-300"
                    }`}
                  >
                    {earned > 0 ? `+${earned} pts` : "0 pts"}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-emerald-100/35">No pick made</span>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center gap-3">
              <ScoreField value={home} onChange={setHome} disabled={saving} />
              <span className="display text-xl text-emerald-100/30">–</span>
              <ScoreField value={away} onChange={setAway} disabled={saving} />
            </div>
            <button
              onClick={save}
              disabled={saving || (!dirty && !!saved)}
              className={`mt-3 w-full rounded-lg py-2 text-xs font-bold uppercase tracking-wider transition ${
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

      <p className="mt-2.5 text-center text-[10px] font-medium uppercase tracking-[0.15em] text-emerald-100/30">
        Side +{POINTS.SIDE} · Diff +{POINTS.DIFF} · Exact +{POINTS.EXACT}
      </p>
    </div>
  );
}
