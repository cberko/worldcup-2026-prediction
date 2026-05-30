"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Mode = "match" | "bracket";

const MODES: {
  key: Mode;
  label: string;
  tag: string;
  home: string;
  pages: { href: string; label: string }[];
}[] = [
  {
    key: "match",
    label: "Match Picks",
    tag: "Score every game",
    home: "/",
    pages: [
      { href: "/", label: "Matches" },
      { href: "/me", label: "My Picks" },
      { href: "/leaderboard", label: "Leaderboard" },
    ],
  },
  {
    key: "bracket",
    label: "Bracket",
    tag: "Call the whole tree",
    home: "/tournament",
    pages: [
      { href: "/tournament", label: "Predict" },
      { href: "/bracket", label: "Results" },
      { href: "/tournament/leaderboard", label: "Leaderboard" },
    ],
  },
];

function modeForPath(path: string): Mode {
  return path.startsWith("/tournament") || path.startsWith("/bracket") ? "bracket" : "match";
}

export function ModeNav() {
  const pathname = usePathname() || "/";
  const active = modeForPath(pathname);
  const mode = MODES.find((m) => m.key === active)!;

  return (
    <div className="space-y-3">
      {/* mode switcher */}
      <div className="inline-flex rounded-xl border border-white/10 bg-pitch-950/60 p-1">
        {MODES.map((m) => {
          const on = m.key === active;
          const fill =
            m.key === "match" ? "bg-grass-500 text-pitch-950" : "bg-gold-400 text-pitch-950";
          return (
            <Link
              key={m.key}
              href={m.home}
              className={`group flex items-center gap-2 rounded-lg px-3.5 py-1.5 transition ${
                on ? fill : "text-emerald-100/55 hover:text-white"
              }`}
            >
              <span className="text-sm font-bold uppercase tracking-wide">{m.label}</span>
              <span
                className={`hidden text-[10px] font-medium normal-case tracking-normal sm:inline ${
                  on ? "text-pitch-900/70" : "text-emerald-100/30"
                }`}
              >
                {m.tag}
              </span>
            </Link>
          );
        })}
      </div>

      {/* sub-nav for the active mode */}
      <nav className="flex items-center gap-1 overflow-x-auto">
        {mode.pages.map((p) => {
          const on = pathname === p.href;
          const underline =
            mode.key === "match" ? "bg-grass-400" : "bg-gold-400";
          return (
            <Link
              key={p.href}
              href={p.href}
              className={`relative whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition ${
                on ? "text-white" : "text-emerald-100/55 hover:bg-white/5 hover:text-white"
              }`}
            >
              {p.label}
              {on && (
                <span className={`absolute inset-x-3 -bottom-px h-0.5 rounded-full ${underline}`} />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
