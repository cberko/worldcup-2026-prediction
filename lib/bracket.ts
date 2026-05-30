import type { Match, Stage } from "./types";

// FIFA 2026 knockout bracket, by official match number.
// R32 = 73–88, R16 = 89–96, QF = 97–100, SF = 101–102, 3rd = 103, Final = 104.
// football-data assigns consecutive IDs per stage in match-number order, so we map
// each stage's matches (sorted by id) to its sequential match numbers — no hardcoded IDs.

export const STAGE_BASE: Partial<Record<Stage, { base: number; count: number }>> = {
  LAST_32: { base: 73, count: 16 },
  LAST_16: { base: 89, count: 8 },
  QUARTER_FINALS: { base: 97, count: 4 },
  SEMI_FINALS: { base: 101, count: 2 },
  FINAL: { base: 104, count: 1 },
};

// Each non-R32 match number → the two feeder match numbers whose winners meet.
export const ADJ: Record<number, [number, number]> = {
  89: [74, 77], 90: [73, 75], 91: [76, 78], 92: [79, 80],
  93: [83, 84], 94: [81, 82], 95: [86, 88], 96: [85, 87],
  97: [89, 90], 98: [93, 94], 99: [91, 92], 100: [95, 96],
  101: [97, 98], 102: [99, 100],
  104: [101, 102],
};

export const ROUND_DEFS: { stage: Stage; label: string; numbers: number[] }[] = [
  { stage: "LAST_32", label: "Round of 32", numbers: range(73, 88) },
  { stage: "LAST_16", label: "Round of 16", numbers: range(89, 96) },
  { stage: "QUARTER_FINALS", label: "Quarter-finals", numbers: range(97, 100) },
  { stage: "SEMI_FINALS", label: "Semi-finals", numbers: range(101, 102) },
  { stage: "FINAL", label: "Final", numbers: [104] },
];

function range(a: number, b: number): number[] {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

/** Map official match numbers ⇄ football-data match ids using per-stage id order. */
export function numberKnockout(matches: Match[]): {
  num2id: Record<number, string>;
  id2num: Record<string, number>;
} {
  const num2id: Record<number, string> = {};
  const id2num: Record<string, number> = {};
  for (const [stage, info] of Object.entries(STAGE_BASE)) {
    if (!info) continue;
    const stageMatches = matches
      .filter((m) => m.stage === (stage as Stage))
      .sort((a, b) => Number(a.id) - Number(b.id));
    stageMatches.forEach((m, i) => {
      const num = info.base + i;
      num2id[num] = m.id;
      id2num[m.id] = num;
    });
  }
  return { num2id, id2num };
}

export type BracketSlot = {
  matchNumber: number;
  matchId: string | null; // football-data id (null if that knockout match isn't synced yet)
  stage: Stage;
  homeTeam: string | null; // actual team (R32 only); null otherwise
  awayTeam: string | null;
  feeders: [number, number] | null; // for R16+ — the two feeder match numbers
};

export type BracketRound = { stage: Stage; label: string; slots: BracketSlot[] };

/** Build the bracket scaffold (rounds → slots) for the interactive builder. */
export function buildBracketRounds(matches: Match[]): BracketRound[] {
  const { num2id } = numberKnockout(matches);
  const byId = new Map(matches.map((m) => [m.id, m]));

  return ROUND_DEFS.map((rd) => ({
    stage: rd.stage,
    label: rd.label,
    slots: rd.numbers.map((n) => {
      const id = num2id[n] ?? null;
      const m = id ? byId.get(id) : undefined;
      const isR32 = rd.stage === "LAST_32";
      return {
        matchNumber: n,
        matchId: id,
        stage: rd.stage,
        homeTeam: isR32 ? (m?.home_team ?? null) : null,
        awayTeam: isR32 ? (m?.away_team ?? null) : null,
        feeders: ADJ[n] ?? null,
      };
    }),
  }));
}

/** True once the R32 teams are actually set (group stage finished). */
export function r32TeamsKnown(matches: Match[]): boolean {
  const r32 = matches.filter((m) => m.stage === "LAST_32");
  return (
    r32.length > 0 &&
    r32.some((m) => m.home_team && m.home_team !== "TBD" && m.away_team && m.away_team !== "TBD")
  );
}
