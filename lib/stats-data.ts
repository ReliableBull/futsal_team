import type { DateRange } from "@/lib/date-range";
import { getTeamPrisma } from "@/lib/teams";
import { calculatePlayerStats, matchStatus } from "@/lib/stats";

export async function getPlayersWithStats(dateRange?: Pick<DateRange, "start" | "end">) {
  const prisma = await getTeamPrisma();
  const players = await prisma.player.findMany({
    where: { isActive: true },
    include: {
      matchPlayers: {
        where: {
          match: {
            status: matchStatus.completed,
            ...(dateRange ? { matchDate: { gte: dateRange.start, lte: dateRange.end } } : {})
          }
        },
        include: { match: { select: { id: true, matchDate: true } } },
        orderBy: { match: { matchDate: "desc" } }
      }
    },
    orderBy: [{ number: "asc" }, { name: "asc" }]
  });

  return players.map(calculatePlayerStats);
}

export async function getDashboardData() {
  const prisma = await getTeamPrisma();
  const [players, recentMatches, posters] = await Promise.all([
    getPlayersWithStats(),
    prisma.match.findMany({
      include: {
        chairmanTeamMvp: true,
        managerTeamMvp: true,
        matchPlayers: { include: { player: true } }
      },
      orderBy: { matchDate: "desc" },
      take: 5
    }),
    prisma.matchPoster.findMany({
      include: {
        match: {
          select: {
            id: true,
            matchDate: true,
            teamAName: true,
            teamBName: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const goalRankings = [...players].sort((a, b) => b.goals - a.goals || b.totalMatches - a.totalMatches).slice(0, 5);
  const assistRankings = [...players].sort((a, b) => b.assists - a.assists || b.goals - a.goals || b.totalMatches - a.totalMatches).slice(0, 5);
  const mvpRankings = [...players].sort((a, b) => b.mvpCount - a.mvpCount || b.goals - a.goals).slice(0, 5);
  const winRateRankings = [...players]
    .filter((player) => player.totalMatches > 0)
    .sort((a, b) => b.winRate - a.winRate || b.totalMatches - a.totalMatches || b.goals - a.goals)
    .slice(0, 5);
  const winStreakRankings = [...players]
    .filter((player) => player.currentWinStreak > 0)
    .sort((a, b) => b.currentWinStreak - a.currentWinStreak || b.winRate - a.winRate || b.totalMatches - a.totalMatches)
    .slice(0, 5);
  const goalStreakRankings = [...players]
    .filter((player) => player.currentGoalStreak > 0)
    .sort((a, b) => b.currentGoalStreak - a.currentGoalStreak || b.goals - a.goals || b.totalMatches - a.totalMatches)
    .slice(0, 5);
  const assistStreakRankings = [...players]
    .filter((player) => player.currentAssistStreak > 0)
    .sort((a, b) => b.currentAssistStreak - a.currentAssistStreak || b.assists - a.assists || b.totalMatches - a.totalMatches)
    .slice(0, 5);

  return { recentMatches, goalRankings, assistRankings, mvpRankings, winRateRankings, winStreakRankings, goalStreakRankings, assistStreakRankings, posters };
}

