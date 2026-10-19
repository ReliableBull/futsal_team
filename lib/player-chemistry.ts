export type ChemistryPlayer = {
  id: number;
  name: string;
  nickname: string | null;
  isActive: boolean;
};

export type ChemistryMatch = {
  id: number;
  status: string;
  matchDate: Date;
  teamAName: string;
  teamBName: string;
  teamAScore: number;
  teamBScore: number;
  matchPlayers: Array<{
    playerId: number;
    teamName: string;
    goals: number;
    assists: number;
    player: ChemistryPlayer;
  }>;
  goals: Array<{ scorerId: number; assisterId: number | null; assistKnown: boolean }>;
};

export type ChemistryRecord = {
  player: ChemistryPlayer;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  goalsFor: number;
  goalsAgainst: number;
};

export type GoalConnection = {
  player: ChemistryPlayer;
  received: number;
  supplied: number;
  total: number;
};

export type ChemistryFilters = {
  playerId?: number;
  startDate: string;
  endDate: string;
  minMatches: number;
};

export function parseChemistryFilters(params: Record<string, string | string[] | undefined>, now = new Date()): ChemistryFilters {
  function value(key: string) {
    const input = params[key];
    if (Array.isArray(input)) throw new Error("조회 조건을 하나씩 선택해주세요.");
    return input?.trim() ?? "";
  }
  const player = value("playerId");
  let startDate = value("startDate");
  let endDate = value("endDate");
  // Missing date parameters mean first entry; explicit empty values still mean all time.
  if (params.startDate === undefined && params.endDate === undefined) {
    const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
    const date = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    startDate = "2026-01-01";
    endDate = `${date.year}-${date.month}-${date.day}`;
  }
  const minimum = value("minMatches") || "3";
  for (const day of [startDate, endDate]) {
    if (!day) continue;
    const date = new Date(`${day}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day) {
      throw new Error("올바른 날짜를 입력해주세요.");
    }
  }
  if (startDate && endDate && startDate > endDate) throw new Error("종료일은 시작일 이후로 선택해주세요.");
  if (player && (!/^[1-9]\d*$/.test(player) || !Number.isSafeInteger(Number(player)))) throw new Error("선수를 다시 선택해주세요.");
  if (!["1", "3", "5", "10"].includes(minimum)) throw new Error("최소 경기 수를 다시 선택해주세요.");
  return { playerId: player ? Number(player) : undefined, startDate, endDate, minMatches: Number(minimum) };
}

/** All records use the selected player's perspective. A draw remains in the win-rate denominator. */
export function calculatePlayerChemistry(playerId: number, matches: ChemistryMatch[], filters: ChemistryFilters) {
  const teammates = new Map<number, ChemistryRecord>();
  const opponents = new Map<number, ChemistryRecord>();
  const connections = new Map<number, GoalConnection>();
  let totalMatches = 0;
  let unknownGoalLinks = 0;
  let unknownAssistLinks = 0;
  let firstDate: string | null = null;
  let lastDate: string | null = null;

  for (const match of matches) {
    if (match.status !== "COMPLETED") continue;
    const day = match.matchDate.toISOString().slice(0, 10);
    if ((filters.startDate && day < filters.startDate) || (filters.endDate && day > filters.endDate)) continue;
    const self = match.matchPlayers.find((record) => record.playerId === playerId);
    if (!self || match.teamAName === match.teamBName) continue;
    if (![match.teamAName, match.teamBName].includes(self.teamName)) continue;
    const isA = self.teamName === match.teamAName;
    const goalsFor = isA ? match.teamAScore : match.teamBScore;
    const goalsAgainst = isA ? match.teamBScore : match.teamAScore;
    totalMatches++;
    if (!firstDate || day < firstDate) firstDate = day;
    if (!lastDate || day > lastDate) lastDate = day;

    for (const participant of match.matchPlayers) {
      if (participant.playerId === playerId || ![match.teamAName, match.teamBName].includes(participant.teamName)) continue;
      const group = participant.teamName === self.teamName ? teammates : opponents;
      const record = group.get(participant.playerId) ?? {
        player: participant.player, matches: 0, wins: 0, draws: 0, losses: 0, winRate: 0, goalsFor: 0, goalsAgainst: 0
      };
      record.matches++;
      record.wins += Number(goalsFor > goalsAgainst);
      record.draws += Number(goalsFor === goalsAgainst);
      record.losses += Number(goalsFor < goalsAgainst);
      record.goalsFor += goalsFor;
      record.goalsAgainst += goalsAgainst;
      group.set(participant.playerId, record);
    }

    let resolvedGoals = 0;
    let resolvedAssists = 0;
    for (const goal of match.goals) {
      if (!goal.assistKnown) continue;
      const scorer = match.matchPlayers.find((record) => record.playerId === goal.scorerId);
      const assister = match.matchPlayers.find((record) => record.playerId === goal.assisterId);
      const validConnection = scorer && assister && scorer.teamName === assister.teamName && scorer.playerId !== assister.playerId;
      if (goal.scorerId === playerId && (goal.assisterId === null || validConnection)) resolvedGoals++;
      if (!validConnection || !scorer || !assister) continue;
      if (goal.scorerId !== playerId && goal.assisterId !== playerId) continue;
      const receiving = goal.scorerId === playerId;
      const partner = receiving ? assister.player : scorer.player;
      const connection = connections.get(partner.id) ?? { player: partner, received: 0, supplied: 0, total: 0 };
      if (receiving) connection.received++;
      else { connection.supplied++; resolvedAssists++; }
      connection.total++;
      connections.set(partner.id, connection);
    }
    // Legacy totals may exist without MatchGoal rows. Known unassisted goals are not missing data.
    unknownGoalLinks += Math.max(0, self.goals - resolvedGoals);
    unknownAssistLinks += Math.max(0, self.assists - resolvedAssists);
  }

  function ranked(records: Map<number, ChemistryRecord>) {
    return Array.from(records.values())
      .filter((record) => record.matches >= filters.minMatches)
      .map((record) => ({ ...record, winRate: Math.round(record.wins / record.matches * 1000) / 10 }))
      .sort((a, b) => b.wins / b.matches - a.wins / a.matches || b.matches - a.matches || a.player.name.localeCompare(b.player.name, "ko") || a.player.id - b.player.id);
  }

  return {
    totalMatches, firstDate, lastDate, unknownGoalLinks, unknownAssistLinks,
    teammateCount: teammates.size, opponentCount: opponents.size,
    teammates: ranked(teammates), opponents: ranked(opponents),
    connections: Array.from(connections.values()).sort((a, b) => b.total - a.total || b.received - a.received || a.player.name.localeCompare(b.player.name, "ko") || a.player.id - b.player.id)
  };
}

export type PlayerChemistry = ReturnType<typeof calculatePlayerChemistry>;
