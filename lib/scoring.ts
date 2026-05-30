import type { Stage, Match } from "./types";

// Flat scoring — same for every round (group → final), no multipliers.
// Correct side: +5 · Correct side & (signed) goal difference: +6 · Exact score: +9 · Wrong side: 0
// "Difference" is signed: you must get the winner right too — a 3-1 pick on a team that lost 1-3 scores 0.
export const POINTS = {
  SIDE: 5,
  DIFF: 6,
  EXACT: 9,
} as const;

export const MAX_POINTS = POINTS.EXACT;

export const STAGE_LABELS: Record<Stage, string> = {
  GROUP_STAGE: "Group Stage",
  LAST_32: "Round of 32",
  LAST_16: "Round of 16",
  QUARTER_FINALS: "Quarter-finals",
  SEMI_FINALS: "Semi-finals",
  THIRD_PLACE: "Third Place",
  FINAL: "Final",
};

// Stage display order for grouping in the UI.
export const STAGE_ORDER: Stage[] = [
  "GROUP_STAGE",
  "LAST_32",
  "LAST_16",
  "QUARTER_FINALS",
  "SEMI_FINALS",
  "THIRD_PLACE",
  "FINAL",
];

const sign = (n: number): number => (n > 0 ? 1 : n < 0 ? -1 : 0);

/**
 * Score a predicted scoreline against a finished match.
 * Returns 0/5/6/9, or null if the match doesn't have a final score yet.
 */
export function scorePrediction(
  match: Pick<Match, "home_score" | "away_score">,
  predHome: number,
  predAway: number
): number | null {
  const ah = match.home_score;
  const aa = match.away_score;
  if (ah === null || ah === undefined || aa === null || aa === undefined) return null;

  // Wrong outcome (side) → 0
  if (sign(predHome - predAway) !== sign(ah - aa)) return 0;

  // Exact score → 7
  if (predHome === ah && predAway === aa) return POINTS.EXACT;

  // Correct side + correct goal difference → 6
  if (predHome - predAway === ah - aa) return POINTS.DIFF;

  // Correct side only → 5
  return POINTS.SIDE;
}
