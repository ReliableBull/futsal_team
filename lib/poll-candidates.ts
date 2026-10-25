import type { Prisma, PrismaClient } from "@prisma/client";
import { getDateRange } from "./date-range";
import { parsePlayerPosition } from "./player-position";
import { calculatePlayerStats, formatPlayerRecord, matchStatus } from "./stats";

export type PollCandidate = { id: number; name: string; profileImageUrl: string | null; number: number | null; position: string; detail: string };

/** Active roster with the same default season record as the players page. */
export async function getPollCandidates(db: PrismaClient | Prisma.TransactionClient, teamId: number, ids?: number[]): Promise<PollCandidate[]> {
  const range = getDateRange();
  const season = range.startDate.slice(0, 4) === range.endDate.slice(0, 4) ? `${range.startDate.slice(0, 4)} 시즌` : `${range.startDate}~${range.endDate}`;
  const players = await db.player.findMany({
    where: { teamId, isActive: true, ...(ids ? { id: { in: ids } } : {}) },
    include: {
      matchPlayers: {
        where: { match: { status: matchStatus.completed, matchDate: { gte: range.start, lte: range.end } } },
        include: { match: { select: { id: true, matchDate: true } } },
        orderBy: { match: { matchDate: "desc" } }
      }
    },
    orderBy: [{ number: "asc" }, { name: "asc" }]
  });
  return players.map(calculatePlayerStats).map(player => ({
    id: player.id, name: player.name, profileImageUrl: player.profileImageUrl, number: player.number, position: parsePlayerPosition(player.position),
    detail: player.totalMatches
      ? `${season} · ${player.totalMatches}경기 ${formatPlayerRecord(player)} · ${player.goals}골 ${player.assists}도움 · MOM ${player.mvpCount}`
      : `${season} · 출전 기록 없음`
  }));
}
