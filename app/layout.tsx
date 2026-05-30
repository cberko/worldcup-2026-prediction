import type { Metadata } from "next";
import { Hanken_Grotesk, Anton, Space_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { AuthButton } from "@/components/AuthButton";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});
const anton = Anton({ subsets: ["latin"], weight: ["400"], variable: "--font-display" });
const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "World Cup 2026 — Prediction League",
  description:
    "Predict World Cup 2026 scorelines, earn points, and climb the leaderboard. Correct side +5, goal difference +6, exact score +9.",
};

const NAV = [
  { href: "/", label: "Matches" },
  { href: "/tournament", label: "Tournament" },
  { href: "/bracket", label: "Results" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/me", label: "My Picks" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${hanken.variable} ${anton.variable} ${spaceMono.variable}`}>
      <body className="min-h-screen font-sans">
        <header className="sticky top-0 z-40 border-b border-white/5 bg-pitch-950/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-grass-500/15 text-lg shadow-glow">
                ⚽
              </span>
              <span className="font-display text-base font-extrabold tracking-tight">
                WC<span className="text-grass-400">26</span>
                <span className="ml-1 hidden text-xs font-medium text-emerald-200/60 sm:inline">
                  Prediction League
                </span>
              </span>
            </Link>

            <nav className="hidden items-center gap-1 sm:flex">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded-lg px-3 py-1.5 text-sm text-emerald-100/70 transition hover:bg-white/5 hover:text-white"
                >
                  {n.label}
                </Link>
              ))}
            </nav>

            <AuthButton />
          </div>

          {/* mobile nav */}
          <nav className="flex items-center gap-1 overflow-x-auto border-t border-white/5 px-3 py-2 sm:hidden">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="whitespace-nowrap rounded-lg px-3 py-1 text-sm text-emerald-100/70 hover:bg-white/5 hover:text-white"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10">{children}</main>

        <footer className="mx-auto max-w-5xl px-4 py-10 text-center text-xs text-emerald-200/40">
          Data via football-data.org · Predict the score: correct side +5 · goal difference +6 · exact score +9
        </footer>
      </body>
    </html>
  );
}
