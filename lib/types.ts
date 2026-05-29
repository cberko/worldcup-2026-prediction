export type Stage =
  | "GROUP_STAGE"
  | "LAST_32"
  | "LAST_16"
  | "QUARTER_FINALS"
  | "SEMI_FINALS"
  | "THIRD_PLACE"
  | "FINAL";

export type Match = {
  id: string;
  stage: Stage;
  group_name: string | null;
  matchday: number | null;
  home_team: string;
  home_crest: string | null;
  away_team: string;
  away_crest: string | null;
  kickoff: string; // ISO timestamp
  status: string;
  home_score: number | null;
  away_score: number | null;
  result: "1" | "X" | "2" | null;
  winner: "HOME" | "AWAY" | null;
  updated_at: string;
};

export type Prediction = {
  id: string;
  user_id: string;
  match_id: string;
  pred_home: number;
  pred_away: number;
  points_awarded: number | null;
  created_at: string;
  updated_at: string;
};

// A user's predicted scoreline for a match (UI/state convenience).
export type ScorePick = { home: number; away: number };

export type LeaderboardRow = {
  user_id: string;
  display_name: string;
  total_points: number;
  correct_count: number;
  total_predictions: number;
};

export const isKnockout = (stage: Stage): boolean => stage !== "GROUP_STAGE";

export function isLocked(match: { kickoff: string; status: string }): boolean {
  if (match.status && match.status !== "SCHEDULED" && match.status !== "TIMED") {
    return true; // already kicked off / live / finished
  }
  return new Date(match.kickoff).getTime() <= Date.now();
}
