import type { Match, MatchPlayer, Player } from "@prisma/client";
import type { DateRange } from "@/lib/date-range";
import { prisma } from "@/lib/prisma";

export const matchResult = {
  win: "WIN",
  loss: "LOSS",
  draw: "DRAW"
} as const;

export type MatchResultValue = (typeof matchResult)[keyof typeof matchResult];

export const matchStatus = {
  inProgress: "IN_PROGRESS",
  completed: "COMPLETED"
} as const;

export type MatchStatusValue = (typeof matchStatus)[keyof typeof matchStatus];

export type PlayerWithStats = Player & {
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  goals: number;
  assists: number;
  mvpCount: number;
  currentWinStreak: number;
  currentGoalStreak: number;
  currentAssistStreak: number;
};

export type MatchWithDetails = Match & {
  chairmanTeamMvp: Player | null;
  managerTeamMvp: Player | null;
  matchPlayers: Array<MatchPlayer & { player: Player }>;
};

type MatchPlayerForStats = MatchPlayer & { match?: Pick<Match, "matchDate" | "id"> };

export type PlayerStreakRecord = {
  length: number;
  startDate: Date;
  endDate: Date;
  startMatchId: number;
  endMatchId: number;
};

export type PlayerStreakHistories = {
  win: PlayerStreakRecord[];
  goal: PlayerStreakRecord[];
  assist: PlayerStreakRecord[];
};

function getRecentRecords(matchPlayers: MatchPlayerForStats[]) {
  return [...matchPlayers].sort((a, b) => {
    const dateDiff = (b.match?.matchDate.getTime() ?? 0) - (a.match?.matchDate.getTime() ?? 0);
    if (dateDiff !== 0) return dateDiff;

    return (b.match?.id ?? b.matchId) - (a.match?.id ?? a.matchId);
  });
}

function countCurrentStreak(records: MatchPlayerForStats[], predicate: (record: MatchPlayerForStats) => boolean) {
  let streak = 0;

  for (const record of records) {
    if (!predicate(record)) break;
    streak += 1;
  }

  return streak;
}

function getChronologicalRecords(matchPlayers: MatchPlayerForStats[]) {
  return [...matchPlayers].sort((a, b) => {
    const dateDiff = (a.match?.matchDate.getTime() ?? 0) - (b.match?.matchDate.getTime() ?? 0);
    if (dateDiff !== 0) return dateDiff;

    return (a.match?.id ?? a.matchId) - (b.match?.id ?? b.matchId);
  });
}

function buildBestStreakHistory(records: MatchPlayerForStats[], predicate: (record: MatchPlayerForStats) => boolean) {
  const streaks: PlayerStreakRecord[] = [];
  let current: MatchPlayerForStats[] = [];

  function flushCurrentStreak() {
    if (current.length === 0) return;

    const first = current[0];
    const last = current[current.length - 1];

    streaks.push({
      length: current.length,
      startDate: first.match?.matchDate ?? new Date(0),
      endDate: last.match?.matchDate ?? new Date(0),
      startMatchId: first.match?.id ?? first.matchId,
      endMatchId: last.match?.id ?? last.matchId
    });
    current = [];
  }

  for (const record of records) {
    if (predicate(record)) {
      current.push(record);
      continue;
    }

    flushCurrentStreak();
  }

  flushCurrentStreak();

  const bestLength = Math.max(0, ...streaks.map((streak) => streak.length));

  return streaks
    .filter((streak) => streak.length === bestLength && streak.length > 0)
    .sort((a, b) => b.endDate.getTime() - a.endDate.getTime() || b.endMatchId - a.endMatchId);
}

export function calculatePlayerStreakHistories(matchPlayers: MatchPlayerForStats[]): PlayerStreakHistories {
  const records = getChronologicalRecords(matchPlayers);

  return {
    win: buildBestStreakHistory(records, (record) => record.result === matchResult.win),
    goal: buildBestStreakHistory(records, (record) => record.goals > 0),
    assist: buildBestStreakHistory(records, (record) => record.assists > 0)
  };
}

export function calculatePlayerStats(player: Player & { matchPlayers: MatchPlayerForStats[] }): PlayerWithStats {
  const totalMatches = player.matchPlayers.length;
  const wins = player.matchPlayers.filter((record) => record.result === matchResult.win).length;
  const losses = player.matchPlayers.filter((record) => record.result === matchResult.loss).length;
  const draws = player.matchPlayers.filter((record) => record.result === matchResult.draw).length;
  const goals = player.matchPlayers.reduce((sum, record) => sum + record.goals, 0);
  const assists = player.matchPlayers.reduce((sum, record) => sum + record.assists, 0);
  const mvpCount = player.matchPlayers.filter((record) => record.isMvp).length;
  const recentRecords = getRecentRecords(player.matchPlayers);

  return {
    ...player,
    totalMatches,
    wins,
    losses,
    draws,
    winRate: totalMatches > 0 ? Math.round((wins / totalMatches) * 1000) / 10 : 0,
    goals,
    assists,
    mvpCount,
    currentWinStreak: countCurrentStreak(recentRecords, (record) => record.result === matchResult.win),
    currentGoalStreak: countCurrentStreak(recentRecords, (record) => record.goals > 0),
    currentAssistStreak: countCurrentStreak(recentRecords, (record) => record.assists > 0)
  };
}

export async function getPlayersWithStats(dateRange?: Pick<DateRange, "start" | "end">) {
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

export function formatPlayerRecord(player: Pick<PlayerWithStats, "wins" | "losses" | "draws">) {
  const drawText = player.draws > 0 ? ` ${player.draws}무` : "";
  return `${player.wins}승 ${player.losses}패${drawText}`;
}

export function getResultLabel(result: string) {
  if (result === matchResult.win) return "승";
  if (result === matchResult.loss) return "패";
  return "무";
}

export function getWinnerLabel(match: Pick<Match, "winnerTeam">) {
  return match.winnerTeam ?? "무승부";
}

export function getMatchStatusLabel(status: string) {
  return status === matchStatus.inProgress ? "경기 진행중" : "결과 등록 완료";
}

export function getTeamMvpNames(
  matchPlayers: Array<Pick<MatchPlayer, "teamName" | "isMvp"> & { player: Pick<Player, "name"> }>,
  teamName: string
) {
  const names = matchPlayers
    .filter((record) => record.teamName === teamName && record.isMvp)
    .map((record) => record.player.name);

  return names.length > 0 ? names.join(", ") : "-";
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}
