import { prisma } from "@/lib/prisma";
import { calculatePlayerChemistry, type ChemistryFilters } from "@/lib/player-chemistry";

const playerSelect = { id: true, name: true, nickname: true, isActive: true } as const;

export function getChemistryPlayers() {
  return prisma.player.findMany({
    where: { OR: [{ isActive: true }, { matchPlayers: { some: { match: { status: "COMPLETED" } } } }] },
    select: playerSelect,
    orderBy: [{ isActive: "desc" }, { name: "asc" }, { id: "asc" }]
  });
}

export async function getPlayerChemistry(playerId: number, filters: ChemistryFilters) {
  const matches = await prisma.match.findMany({
    where: {
      status: "COMPLETED",
      matchPlayers: { some: { playerId } },
      matchDate: {
        ...(filters.startDate ? { gte: new Date(`${filters.startDate}T00:00:00.000Z`) } : {}),
        ...(filters.endDate ? { lte: new Date(`${filters.endDate}T23:59:59.999Z`) } : {})
      }
    },
    select: {
      id: true, status: true, matchDate: true, teamAName: true, teamBName: true, teamAScore: true, teamBScore: true,
      matchPlayers: { select: { playerId: true, teamName: true, goals: true, assists: true, player: { select: playerSelect } } },
      goals: { select: { scorerId: true, assisterId: true, assistKnown: true } }
    }
  });
  return calculatePlayerChemistry(playerId, matches, filters);
}
