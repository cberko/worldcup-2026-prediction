import type { Match, Stage } from "./types";

const BASE = "https://api.football-data.org/v4";

// Raw shape of a football-data.org v4 match (only fields we use).
type FdMatch = {
  id: number;
  utcDate: string;
  status: string; // SCHEDULED | TIMED | IN_PLAY | PAUSED | FINISHED | ...
  stage: string;
  group: string | null;
  matchday: number | null;
  homeTeam: { name: string | null; shortName?: string | null; crest: string | null };
  awayTeam: { name: string | null; shortName?: string | null; crest: string | null };
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    fullTime: { home: number | null; away: number | null };
  };
};

const KNOWN_STAGES = new Set<Stage>([
  "GROUP_STAGE",
  "LAST_32",
  "LAST_16",
  "QUARTER_FINALS",
  "SEMI_FINALS",
  "THIRD_PLACE",
  "FINAL",
]);

function normalizeStage(raw: string): Stage {
  if (KNOWN_STAGES.has(raw as Stage)) return raw as Stage;
  // football-data occasionally uses LAST_32 / ROUND_OF_32 style variants.
  const map: Record<string, Stage> = {
    ROUND_OF_32: "LAST_32",
    ROUND_OF_16: "LAST_16",
    QUARTER_FINAL: "QUARTER_FINALS",
    SEMI_FINAL: "SEMI_FINALS",
    "3RD_PLACE": "THIRD_PLACE",
    THIRD_PLACE_MATCH: "THIRD_PLACE",
  };
  return map[raw] ?? "GROUP_STAGE";
}

/**
 * Map a football-data match to our DB row. Computes result/winner only when finished.
 */
export function mapMatch(m: FdMatch): Match {
  const stage = normalizeStage(m.stage);
  const finished = m.status === "FINISHED";

  let result: Match["result"] = null;
  let winner: Match["winner"] = null;
  if (finished && m.score.winner) {
    if (m.score.winner === "HOME_TEAM") {
      result = "1";
      winner = "HOME";
    } else if (m.score.winner === "AWAY_TEAM") {
      result = "2";
      winner = "AWAY";
    } else {
      result = "X"; // DRAW (only meaningful for group stage)
    }
  }

  return {
    id: String(m.id),
    stage,
    group_name: m.group ?? null,
    matchday: m.matchday ?? null,
    home_team: m.homeTeam.name ?? m.homeTeam.shortName ?? "TBD",
    home_crest: m.homeTeam.crest ?? null,
    away_team: m.awayTeam.name ?? m.awayTeam.shortName ?? "TBD",
    away_crest: m.awayTeam.crest ?? null,
    kickoff: m.utcDate,
    status: m.status,
    home_score: m.score.fullTime.home,
    away_score: m.score.fullTime.away,
    result,
    winner,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Fetch all matches for the configured competition (default WC).
 * Uses the free-tier token via the X-Auth-Token header.
 */
export async function fetchAllMatches(): Promise<Match[]> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new Error("FOOTBALL_DATA_TOKEN is not set");
  const competition = process.env.FOOTBALL_DATA_COMPETITION || "WC";

  const res = await fetch(`${BASE}/competitions/${competition}/matches`, {
    headers: { "X-Auth-Token": token },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`football-data ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { matches?: FdMatch[] };
  return (data.matches ?? []).map(mapMatch);
}

export type GroupStanding = {
  group_name: string;
  standings: { position: number; team: string }[];
};

type FdStanding = {
  type: string; // TOTAL | HOME | AWAY
  group: string | null; // "GROUP_A" or "Group A"
  table: { position: number; team: { name: string | null; shortName?: string | null } }[];
};

/** Fetch the group tables (TOTAL) for the competition. */
export async function fetchStandings(): Promise<GroupStanding[]> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new Error("FOOTBALL_DATA_TOKEN is not set");
  const competition = process.env.FOOTBALL_DATA_COMPETITION || "WC";

  const res = await fetch(`${BASE}/competitions/${competition}/standings`, {
    headers: { "X-Auth-Token": token },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`football-data standings ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { standings?: FdStanding[] };
  return (data.standings ?? [])
    .filter((s) => s.type === "TOTAL" && s.group)
    .map((s) => ({
      group_name: normalizeGroupName(s.group as string),
      standings: s.table.map((r) => ({
        position: r.position,
        team: r.team.name ?? r.team.shortName ?? "TBD",
      })),
    }));
}

// "GROUP_A" / "Group A" → "Group A" (match the form stored on matches.group_name = "GROUP_A"?)
// matches.group_name comes from the matches endpoint as e.g. "GROUP_A". Keep that canonical form.
function normalizeGroupName(raw: string): string {
  const up = raw.toUpperCase().replace(/\s+/g, "_");
  return up.startsWith("GROUP_") ? up : `GROUP_${up}`;
}
