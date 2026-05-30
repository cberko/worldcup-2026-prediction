import type { Metadata } from "next";
import { Hanken_Grotesk, Anton, Space_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { AuthButton } from "@/components/AuthButton";
import { ModeNav } from "@/components/ModeNav";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${hanken.variable} ${anton.variable} ${spaceMono.variable}`}>
      <body className="min-h-screen font-sans">
        <header className="sticky top-0 z-40 border-b border-white/5 bg-pitch-950/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 pt-3">
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
            <AuthButton />
          </div>

          <div className="mx-auto max-w-5xl px-4 pb-2.5 pt-3">
            <ModeNav />
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10">{children}</main>

        <footer className="mx-auto max-w-5xl px-4 py-10 text-center text-xs text-emerald-200/40">
          Data via football-data.org · Predict the score: correct side +5 · goal difference +6 · exact score +9
        </footer>
      </body>
    </html>
  );
}
