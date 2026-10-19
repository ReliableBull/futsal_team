import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import type { MomPoll, MomTeam } from "./mom-vote-types";

export class MomVoteError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const pollSelect = Prisma.validator<Prisma.MatchSelect>()({
  id: true, status: true, matchDate: true, location: true, teamAName: true, teamBName: true,
  matchPlayers: {
    select: { playerId: true, teamName: true, goals: true, assists: true, player: { select: { name: true, number: true } } },
    orderBy: { player: { name: "asc" } }
  }
});
type PollMatch = Prisma.MatchGetPayload<{ select: typeof pollSelect }>;

function teamsFor(match: PollMatch): MomTeam[] {
  return ([{ key: "A", name: match.teamAName }, { key: "B", name: match.teamBName }] as const).map((team) => ({
    ...team,
    players: match.matchPlayers.filter((record) => record.teamName === team.name).map((record) => ({
      id: record.playerId, name: record.player.name, number: record.player.number, goals: record.goals, assists: record.assists
    }))
  }));
}

export function parseMomChoices(value: unknown): { teamAPlayerId: number; teamBPlayerId: number } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new MomVoteError(400, "각 팀에서 MOM을 1명씩 선택해주세요.");
  const { teamAPlayerId, teamBPlayerId } = value as Record<string, unknown>;
  if (typeof teamAPlayerId !== "number" || typeof teamBPlayerId !== "number" ||
      !Number.isSafeInteger(teamAPlayerId) || !Number.isSafeInteger(teamBPlayerId) ||
      teamAPlayerId <= 0 || teamBPlayerId <= 0 || teamAPlayerId === teamBPlayerId) {
    throw new MomVoteError(400, "각 팀에서 MOM을 1명씩 선택해주세요.");
  }
  return { teamAPlayerId, teamBPlayerId };
}

export async function getMomPoll(matchId: number, voterHash: string): Promise<MomPoll> {
  const [match, ballot] = await Promise.all([
    prisma.match.findUnique({ where: { id: matchId }, select: pollSelect }),
    prisma.momBallot.findUnique({ where: { matchId_voterHash: { matchId, voterHash } }, select: { id: true } })
  ]);
  if (!match) throw new MomVoteError(404, "존재하지 않는 경기입니다.");
  return { matchId, status: match.status, matchDate: match.matchDate.toISOString(), location: match.location, teams: teamsFor(match), hasVoted: Boolean(ballot) };
}

export async function submitMomBallot(matchId: number, voterHash: string, input: unknown) {
  const choices = parseMomChoices(input);
  try {
    await prisma.$transaction(async (tx) => {
      // Serialize against other votes and the existing Match UPDATE used when
      // closing a match or replacing its lineup. Recheck everything under the lock.
      const locked = await tx.$queryRaw<Array<{ id: number }>>`SELECT "id" FROM "Match" WHERE "id" = ${matchId} FOR UPDATE`;
      if (!locked.length) throw new MomVoteError(404, "존재하지 않는 경기입니다.");
      const match = await tx.match.findUniqueOrThrow({ where: { id: matchId }, select: pollSelect });
      if (match.status !== "IN_PROGRESS") throw new MomVoteError(409, "경기가 종료되어 MOM 투표가 마감되었습니다.");
      const teams = teamsFor(match);
      if (match.teamAName === match.teamBName || !teams[0].players.some((p) => p.id === choices.teamAPlayerId) || !teams[1].players.some((p) => p.id === choices.teamBPlayerId)) {
        throw new MomVoteError(400, "현재 출전 명단에서 각 팀의 선수를 1명씩 선택해주세요.");
      }
      await tx.momBallot.create({ data: { matchId, voterHash, ...choices } });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new MomVoteError(409, "이미 투표를 하셨습니다.");
    }
    throw error;
  }
}

/** Called only from the admin edit page, after requireAdmin(). */
export async function getMomResults(matchId: number) {
  const [match, ballots] = await Promise.all([
    prisma.match.findUnique({ where: { id: matchId }, select: pollSelect }),
    prisma.momBallot.findMany({ where: { matchId }, select: { teamAPlayerId: true, teamBPlayerId: true } })
  ]);
  if (!match) throw new MomVoteError(404, "존재하지 않는 경기입니다.");
  return {
    totalBallots: ballots.length,
    teams: teamsFor(match).map((team) => {
      const counts = new Map<number, number>();
      for (const ballot of ballots) {
        const id = team.key === "A" ? ballot.teamAPlayerId : ballot.teamBPlayerId;
        if (id !== null) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      const players = team.players.map((player) => ({ ...player, votes: counts.get(player.id) ?? 0 })).sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name, "ko"));
      return { ...team, players, excludedVotes: ballots.length - players.reduce((sum, p) => sum + p.votes, 0) };
    })
  };
}
