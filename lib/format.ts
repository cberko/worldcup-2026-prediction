// All match times render in the tournament's host region (US Eastern) on a FIXED
// timezone so the server (SSR) and the browser produce identical strings — otherwise
// React throws hydration errors (#418/#425) for any visitor not in that zone.
// This also keeps each card's time consistent with MatchBoard's day grouping.
const TZ = "America/New_York";

// Kickoff time, e.g. "Thu 11 Jun, 18:00 ET".
export function formatKickoff(iso: string): string {
  const s = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(new Date(iso));
  return `${s} ET`;
}

export function shortDay(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    timeZone: TZ,
  }).format(new Date(iso));
}

/**
 * Live countdown to a kickoff, e.g. "8d 20h", "3h 14m", "47m", "Locked".
 * Returns null when called during SSR-equivalent (now unknown) — callers should
 * compute it on the client only (in an effect) to stay hydration-safe.
 */
export function countdown(iso: string, now: number): string {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "Locked";
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const min = m % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${min}m`;
  return `${min}m`;
}
