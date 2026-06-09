"use client";

import { useEffect, useState } from "react";
import { formatKickoff } from "@/lib/format";

/**
 * Kickoff time in the VIEWER'S local timezone — rendered hydration-safely.
 *
 * SSR and the first client paint both render the same fixed-timezone string
 * (`formatKickoff`, ET) so the markup matches and React never throws #418/#425.
 * Right after mount we swap to the visitor's local time (no tz label, since it's
 * their own clock). The swap is effectively instant.
 */
export function KickoffTime({ iso }: { iso: string }) {
  const [local, setLocal] = useState<string | null>(null);

  useEffect(() => {
    setLocal(
      new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(iso))
    );
  }, [iso]);

  return <span suppressHydrationWarning>{local ?? formatKickoff(iso)}</span>;
}
