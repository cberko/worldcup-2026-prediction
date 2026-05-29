import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { LeaderboardRow } from "@/lib/types";

export const dynamic = "force-dynamic";

type TournamentRow = {
  user_id: string;
  display_name: string;
  group_points: number;
  bracket_points: number;
  total_points: number;
};

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: { board?: string };
}) {
  const board = searchParams.board === "tournament" ? "tournament" : "match";
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-4xl sm:text-5xl">Leaderboard</h1>
        <p className="mt-2 text-sm text-emerald-100/60">
          Two games, two tables. Match Picks scores each scoreline (5/6/7); Tournament scores group
          placements and bracket advancement.
        </p>
      </div>

      <div className="flex gap-2">
        <Tab href="/leaderboard" active={board === "match"}>
          Match Picks
        </Tab>
        <Tab href="/leaderboard?board=tournament" active={board === "tournament"}>
          Tournament
        </Tab>
      </div>

      {board === "match" ? (
        <MatchBoard supabase={supabase} meId={user?.id} />
      ) : (
        <TournamentBoard supabase={supabase} meId={user?.id} />
      )}
    </div>
  );
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
        active ? "bg-grass-500 text-pitch-950" : "border border-white/10 bg-white/5 text-emerald-100/60 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card p-8 text-center text-sm text-emerald-100/60">{children}</div>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function MatchBoard({ supabase, meId }: { supabase: any; meId?: string }) {
  const { data } = await supabase
    .from("leaderboard")
    .select("*")
    .order("total_points", { ascending: false })
    .order("correct_count", { ascending: false });
  const rows = (data ?? []) as LeaderboardRow[];
  if (rows.length === 0) return <Empty>No points yet — the table fills as matches are played.</Empty>;

  return (
    <Table
      head={["#", "Player", "Hits", "Points"]}
      rows={rows.map((r, i) => ({
        me: meId === r.user_id,
        cells: [
          medal(i),
          r.display_name,
          `${r.correct_count}/${r.total_predictions}`,
          r.total_points,
        ],
      }))}
    />
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function TournamentBoard({ supabase, meId }: { supabase: any; meId?: string }) {
  const { data } = await supabase
    .from("tournament_leaderboard")
    .select("*")
    .order("total_points", { ascending: false });
  const rows = (data ?? []) as TournamentRow[];
  if (rows.length === 0) return <Empty>No tournament points yet — predict groups to get on the board.</Empty>;

  return (
    <Table
      head={["#", "Player", "Groups", "Bracket", "Total"]}
      rows={rows.map((r, i) => ({
        me: meId === r.user_id,
        cells: [medal(i), r.display_name, r.group_points, r.bracket_points, r.total_points],
      }))}
    />
  );
}

function medal(i: number): string {
  return ["🥇", "🥈", "🥉"][i] ?? String(i + 1);
}

function Table({
  head,
  rows,
}: {
  head: string[];
  rows: { me: boolean; cells: (string | number)[] }[];
}) {
  const lastCol = head.length - 1;
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-emerald-100/40">
            {head.map((h, i) => (
              <th key={h} className={`px-4 py-3 font-medium ${i >= 2 ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr
              key={ri}
              className={`border-b border-white/5 last:border-0 ${r.me ? "bg-grass-500/10" : ""}`}
            >
              {r.cells.map((c, ci) => (
                <td
                  key={ci}
                  className={`px-4 py-3 ${ci >= 2 ? "tnum text-right" : ""} ${
                    ci === 1 ? "font-semibold" : ""
                  } ${ci === lastCol ? "text-lg font-bold text-grass-300" : ""} ${
                    ci === 0 ? "tnum text-emerald-100/50" : ""
                  }`}
                >
                  {c}
                  {ci === 1 && r.me && <span className="ml-2 text-xs text-grass-300">(you)</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
