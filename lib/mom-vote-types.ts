export type MomCandidate = { id: number; name: string; number: number | null; goals: number; assists: number };
export type MomTeam = { key: "A" | "B"; name: string; players: MomCandidate[] };
export type MomPoll = {
  matchId: number;
  status: string;
  matchDate: string;
  location: string;
  teams: MomTeam[];
  hasVoted: boolean;
};
