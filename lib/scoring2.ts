import type { Stage, Match } from "./types";

// Mode 2 (Tournament Predictor) scoring — placement / advancement, NOT match scores.
// Group placement: +1 per correct position. Knockout: points per correctly predicted advancing team.
export const GROUP_PLACEMENT_POINT = 1;

export const KO_POINTS: Partial<Record<Stage, number>> = {
  LAST_32: 2,
  LAST_16: 4,
  QUARTER_FINALS: 8,
  SEMI_FINALS: 16,
  FINAL: 32,
  THIRD_PLACE: 0,
};

/**
 * Score a predicted group ordering against the actual final standings.
 * Both arrays are team names ordered position 1→4. Returns count of exact-position matches (0..4).
 */
export function scoreGroupPrediction(predicted: string[], actual: string[]): number {
  let pts = 0;
  for (let i = 0; i < actual.length; i++) {
    if (predicted[i] && actual[i] && predicted[i] === actual[i]) pts += GROUP_PLACEMENT_POINT;
  }
  return pts;
}

/** The team that actually advanced from a finished knockout match, or null if undecided. */
export function advancingTeam(match: Match): string | null {
  if (match.winner === "HOME") return match.home_team;
  if (match.winner === "AWAY") return match.away_team;
  return null;
}

/**
 * Score a bracket pick (predicted advancing team) for a finished knockout match.
 * Returns stage points if correct, 0 if wrong, null if the match isn't decided yet.
 */
export function scoreBracketPrediction(match: Match, predictedTeam: string): number | null {
  const actual = advancingTeam(match);
  if (!actual) return null;
  const pts = KO_POINTS[match.stage] ?? 0;
  return predictedTeam === actual ? pts : 0;
}
