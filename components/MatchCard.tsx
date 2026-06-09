"use client";

import { useEffect, useRef, useState } from "react";
import type { Match, ScorePick } from "@/lib/types";
import { isLocked } from "@/lib/types";
import { countdown } from "@/lib/format";
import { KickoffTime } from "./KickoffTime";
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

/**
 * Big "scoreboard" score control: a large tap-target box you can type into,
 * with chevron steppers above/below. Designed to be the focal point of the card.
 */
function ScoreBox({
  value,
  onChange,
  disabled,
  label,
  accent,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
  label: string;
  accent: "home" | "away";
}) {
  const chevron =
    "grid h-6 w-full place-items-center rounded-md text-emerald-100/45 transition disabled:opacity-20 enabled:hover:bg-white/10 enabled:hover:text-grass-300 enabled:active:scale-90";
  const ring = accent === "home" ? "focus-within:border-grass-500/70" : "focus-within:border-gold-400/70";
  return (
    <div className="flex w-20 flex-col items-center gap-1">
      <span className="w-full truncate text-center text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-100/35">
        {label}
      </span>
      <div className={`flex flex-col items-center rounded-2xl border border-white/10 bg-pitch-950/70 p-1.5 transition ${ring}`}>
        <button
          type="button"
          className={chevron}
          disabled={disabled || value >= 30}
          onClick={() => onChange(clampGoals(value + 1))}
          aria-label={`increase ${label}`}
        >
          ▲
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
          className="score-input h-14 w-16 bg-transparent text-center font-mono text-4xl font-bold tabular-nums text-emerald-50 outline-none disabled:opacity-60"
        />
        <button
          type="button"
          className={chevron}
          disabled={disabled || value <= 0}
          onClick={() => onChange(clampGoals(value - 1))}
          aria-label={`decrease ${label}`}
        >
          ▼
        </button>
      </div>
    </div>
  );
}

type Props = {
  match: Match;
  initialPred: ScorePick | null;
  loggedIn: boolean;
};

type SaveState = "idle" | "saving" | "saved" | "error";

export function MatchCard({ match, initialPred, loggedIn }: Props) {
  const locked = isLocked(match);
  const finished = match.status === "FINISHED";

  const [home, setHome] = useState(initialPred?.home ?? 0);
  const [away, setAway] = useState(initialPred?.away ?? 0);
  const [saved, setSaved] = useState<ScorePick | null>(initialPred);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  // Live countdown to kickoff — client-only so SSR/CSR markup matches (hydration-safe).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (locked || finished) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [locked, finished]);

  const dirty = !saved || saved.home !== home || saved.away !== away;
  const earned = finished && saved ? scorePrediction(match, saved.home, saved.away) : null;
  const hasScore = match.home_score !== null && match.away_score !== null;

  // Debounced auto-save: persist the pick shortly after the user stops changing it.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (locked || !loggedIn || !dirty) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void persist(home, away), 650);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, away, loggedIn, locked]);

  async function persist(h: number, a: number) {
    setState("saving");
    setError(null);
    const res = await fetch("/api/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match_id: match.id, home: h, away: a }),
    });
    if (res.ok) {
      setSaved({ home: h, away: a });
      setState("saved");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save");
      setState("error");
    }
  }

  const countdownText = now !== null ? countdown(match.kickoff, now) : null;

  return (
    <div className="card group p-4 transition-colors hover:border-white/10">
      {/* header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-medium uppercase tracking-wider text-emerald-100/40">
          {match.group_name ? `${match.group_name} · ` : ""}
          <KickoffTime iso={match.kickoff} />
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          {countdownText && !locked && !finished && (
            <span className="chip bg-grass-500/10 text-grass-300/90">⏳ {countdownText}</span>
          )}
          <StatusBadge status={match.status} locked={locked} />
        </div>
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
            <div className="flex items-center justify-center gap-4">
              <ScoreBox value={home} onChange={setHome} disabled={false} label={match.home_team.split(" ")[0]} accent="home" />
              <span className="display mt-4 text-2xl text-emerald-100/25">:</span>
              <ScoreBox value={away} onChange={setAway} disabled={false} label={match.away_team.split(" ")[0]} accent="away" />
            </div>

            {/* auto-save status / sign-in affordance */}
            <div className="mt-3 flex items-center justify-center">
              {!loggedIn ? (
                <button
                  onClick={() => window.dispatchEvent(new Event("open-auth"))}
                  className="rounded-lg bg-grass-500 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-pitch-950 transition hover:bg-grass-400"
                >
                  Sign in to save
                </button>
              ) : (
                <SaveStatus state={state} dirty={dirty} hasSaved={!!saved} />
              )}
            </div>
          </>
        )}
        {error && <p className="mt-2 text-center text-xs text-rose-300">{error}</p>}
      </div>

      <p className="mt-2.5 text-center text-[10px] font-medium uppercase tracking-[0.15em] text-emerald-100/30">
        Side +{POINTS.SIDE} · Diff +{POINTS.DIFF} · Exact +{POINTS.EXACT}
      </p>
    </div>
  );
}

function SaveStatus({ state, dirty, hasSaved }: { state: SaveState; dirty: boolean; hasSaved: boolean }) {
  if (state === "saving")
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-100/55">
        <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-grass-400" /> Saving…
      </span>
    );
  if (state === "error") return null; // error message shown separately
  if (!dirty && hasSaved)
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-grass-300">
        ✓ Saved <span className="font-normal normal-case text-emerald-100/40">· change anytime</span>
      </span>
    );
  if (dirty && hasSaved)
    return <span className="text-[11px] font-medium text-gold-300/80">Editing… saves automatically</span>;
  return <span className="text-[11px] font-medium text-emerald-100/40">Pick a score — it saves automatically</span>;
}
