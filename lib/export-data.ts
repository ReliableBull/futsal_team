import { prisma } from "@/lib/prisma";
import { calculatePlayerStats, formatDate, getMatchStatusLabel, getResultLabel, getTeamMvpNames, getWinnerLabel, matchStatus } from "@/lib/stats";

export type ExportMatch = Awaited<ReturnType<typeof getExportData>>["matches"][number];
export type ExportPlayer = Awaited<ReturnType<typeof getExportData>>["players"][number];

export function todayFileLabel() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

export function getTeamPlayerNames(
  matchPlayers: Array<{
    teamName: string;
    player: { name: string };
  }>,
  teamName: string
) {
  const names = matchPlayers.filter((record) => record.teamName === teamName).map((record) => record.player.name);
  return names.length > 0 ? names.join(", ") : "-";
}

export function getTeamPlayerNameList(
  matchPlayers: Array<{
    teamName: string;
    player: { name: string };
  }>,
  teamName: string
) {
  return matchPlayers.filter((record) => record.teamName === teamName).map((record) => record.player.name);
}

export function getScoreSummary(match: {
  status: string;
  teamAName: string;
  teamBName: string;
  teamAScore: number;
  teamBScore: number;
  winnerTeam: string | null;
}) {
  if (match.status !== matchStatus.completed) {
    return "경기 진행중";
  }

  if (!match.winnerTeam) {
    return `${match.teamAName} ${match.teamAScore} : ${match.teamBScore} ${match.teamBName} 무승부`;
  }

  if (match.winnerTeam === match.teamAName) {
    return `${match.teamAName} ${match.teamAScore} : ${match.teamBScore} ${match.teamBName} 승리`;
  }

  return `${match.teamBName} ${match.teamBScore} : ${match.teamAScore} ${match.teamAName} 승리`;
}

export function chunk<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));
}

export async function getExportData() {
  return Promise.all([
    prisma.match.findMany({
      include: {
        matchPlayers: {
          include: { player: true },
          orderBy: [{ teamName: "asc" }, { player: { name: "asc" } }]
        }
      },
      orderBy: { matchDate: "desc" }
    }),
    prisma.player.findMany({
      include: {
        matchPlayers: {
          where: { match: { status: matchStatus.completed } }
        }
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }]
    })
  ]).then(([matches, players]) => ({ matches, players }));
}

export function buildMatchRows(matches: ExportMatch[]) {
  return [
    [
      "경기 ID",
      "경기일",
      "상태",
      "장소",
      "회장팀",
      "회장팀 선수",
      "총무팀",
      "총무팀 선수",
      "회장팀 점수",
      "총무팀 점수",
      "승리팀",
      "승리 결과",
      "회장팀 MVP",
      "총무팀 MVP",
      "메모"
    ],
    ...matches.map((match) => [
      match.id,
      formatDate(match.matchDate),
      getMatchStatusLabel(match.status),
      match.location,
      match.teamAName,
      getTeamPlayerNames(match.matchPlayers, match.teamAName),
      match.teamBName,
      getTeamPlayerNames(match.matchPlayers, match.teamBName),
      match.teamAScore,
      match.teamBScore,
      match.status === matchStatus.completed ? getWinnerLabel(match) : "-",
      getScoreSummary(match),
      getTeamMvpNames(match.matchPlayers, match.teamAName),
      getTeamMvpNames(match.matchPlayers, match.teamBName),
      match.memo ?? ""
    ])
  ];
}

export function buildHistoryRows(matches: ExportMatch[]) {
  return [
    ["경기 ID", "경기일", "상태", "팀", "선수 ID", "선수명", "닉네임", "등번호", "결과", "득점", "도움", "MVP"],
    ...matches.flatMap((match) =>
      match.matchPlayers.map((record) => [
        match.id,
        formatDate(match.matchDate),
        getMatchStatusLabel(match.status),
        record.teamName,
        record.playerId,
        record.player.name,
        record.player.nickname ?? "",
        record.player.number ?? "",
        getResultLabel(record.result),
        record.goals,
        record.assists,
        record.isMvp ? "Y" : ""
      ])
    )
  ];
}

export function buildPlayerRows(players: ExportPlayer[]) {
  return [
    ["선수 ID", "선수명", "닉네임", "등번호", "활성 여부", "경기 수", "승", "패", "무", "승률", "득점", "도움", "MVP 횟수"],
    ...players.map((player) => {
      const stats = calculatePlayerStats(player);

      return [
        stats.id,
        stats.name,
        stats.nickname ?? "",
        stats.number ?? "",
        stats.isActive ? "Y" : "N",
        stats.totalMatches,
        stats.wins,
        stats.losses,
        stats.draws,
        stats.winRate,
        stats.goals,
        stats.assists,
        stats.mvpCount
      ];
    })
  ];
}
