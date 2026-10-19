import { prisma } from "@/lib/prisma";
import { parsePlayerPosition } from "@/lib/player-position";
import {
  calculateLongestAssistStreak,
  calculateLongestScoringStreak,
  calculateLongestWinStreak,
  type StreakAppearance
} from "@/lib/record-streaks";
import { matchResult, matchStatus } from "@/lib/stats";

export const hallOfFameCategoryKeys = [
  "mostWins",
  "mostAppearances",
  "longestWinStreak",
  "longestScoringStreak",
  "longestAssistStreak",
  "mostGoals",
  "mostAssists",
  "mostAttackPoints",
  "mostMom"
] as const;

export type HallOfFameCategoryKey = (typeof hallOfFameCategoryKeys)[number];

export type HallOfFameIconKey =
  | "trophy"
  | "calendar"
  | "flame"
  | "ballFlame"
  | "target"
  | "ball"
  | "pass"
  | "star"
  | "medal";

export type HallOfFamePlayer = {
  playerId: number;
  playerName: string;
  playerNickname: string | null;
  playerPosition: string;
  playerPhoto: string;
  playerHref: string;
  rank: number;
  value: number;
  displayValue: string;
};

/**
 * 하나의 포디움 자리. 공동 순위(Competition Ranking)를 지원하기 위해
 * 한 자리에 여러 선수가 들어갈 수 있다.
 */
export type HallOfFameSlot = {
  rank: number;
  value: number;
  displayValue: string;
  players: HallOfFamePlayer[];
  /** 슬롯에 표시하지 못하고 생략한 공동 순위 선수 수 */
  overflowCount: number;
};

/** 향후 "NEW RECORD", "▲ 2위 → 1위" 같은 기록 변동 배지를 붙이기 위한 확장 지점. */
export type HallOfFameHighlight = {
  label: string;
  tone: "new" | "up" | "tie";
};

export type HallOfFameCategory = {
  key: HallOfFameCategoryKey;
  title: string;
  englishTitle: string;
  description: string;
  icon: HallOfFameIconKey;
  slots: HallOfFameSlot[];
  /** 순위 전체(공동 순위 포함) 평면 목록. API 소비자 / 향후 확장용. */
  entries: HallOfFamePlayer[];
  highlight: HallOfFameHighlight | null;
};

export type HallOfFameData = {
  categories: HallOfFameCategory[];
  updatedAt: string | null;
  totalMatches: number;
  totalPlayers: number;
};

type CategoryMeta = {
  key: HallOfFameCategoryKey;
  title: string;
  englishTitle: string;
  description: string;
  icon: HallOfFameIconKey;
  formatValue: (value: number) => string;
};

type PlayerProfile = {
  id: number;
  name: string;
  nickname: string | null;
  position: string;
  profileImageUrl: string | null;
};

type PlayerAggregate = {
  profile: PlayerProfile;
  appearances: number;
  wins: number;
  goals: number;
  assists: number;
  attackPoints: number;
  momCount: number;
  longestWinStreak: number;
  longestScoringStreak: number;
  longestAssistStreak: number;
};

/** 연속 기록 계산용 출전 기록에 MOM 선정 여부를 더한, 명예의 전당 집계 전용 출전 기록. */
type HallOfFameAppearance = StreakAppearance & { isMvp: boolean };

/** 포디움 한 자리에 노출하는 공동 순위 선수의 최대 수. */
const maxPlayersPerSlot = 3;

const categoryMetas: CategoryMeta[] = [
  {
    key: "mostWins",
    title: "최다승",
    englishTitle: "MOST WINS",
    description: "출전한 경기에서 소속팀이 승리한 횟수",
    icon: "trophy",
    formatValue: (value) => `${value}승`
  },
  {
    key: "mostAppearances",
    title: "최다 출전",
    englishTitle: "MOST APPEARANCES",
    description: "실제로 출전한 경기 수",
    icon: "calendar",
    formatValue: (value) => `${value}경기`
  },
  {
    key: "longestWinStreak",
    title: "최다 연승",
    englishTitle: "LONGEST WIN STREAK",
    description: "출전 경기 기준 역대 최다 연속 승리",
    icon: "flame",
    formatValue: (value) => `${value}연승`
  },
  {
    key: "longestScoringStreak",
    title: "최다 연속골",
    englishTitle: "LONGEST SCORING STREAK",
    description: "출전 경기 기준 역대 최다 연속 득점 경기",
    icon: "ballFlame",
    formatValue: (value) => `${value}경기 연속골`
  },
  {
    key: "longestAssistStreak",
    title: "최다 연속도움",
    englishTitle: "LONGEST ASSIST STREAK",
    description: "출전 경기 기준 역대 최다 연속 도움 경기",
    icon: "target",
    formatValue: (value) => `${value}경기 연속도움`
  },
  {
    key: "mostGoals",
    title: "최다 득점",
    englishTitle: "MOST GOALS",
    description: "공식 경기에서 기록한 총 득점",
    icon: "ball",
    formatValue: (value) => `${value}골`
  },
  {
    key: "mostAssists",
    title: "최다 도움",
    englishTitle: "MOST ASSISTS",
    description: "공식 경기에서 기록한 총 도움",
    icon: "pass",
    formatValue: (value) => `${value}도움`
  },
  {
    key: "mostAttackPoints",
    title: "최다 공격 포인트",
    englishTitle: "MOST ATTACK POINTS",
    description: "득점 + 도움 합계",
    icon: "star",
    formatValue: (value) => `${value}포인트`
  },
  {
    key: "mostMom",
    title: "최다 MOM",
    englishTitle: "MOST MOM AWARDS",
    description: "경기 MOM(Man of the Match) 선정 횟수",
    icon: "medal",
    formatValue: (value) => `${value}회`
  }
];

export function getPlayerPhotoUrl(player: Pick<PlayerProfile, "id" | "profileImageUrl">) {
  return player.profileImageUrl || `/images/players/${player.id}.jpg`;
}

/**
 * Competition Ranking(1, 1, 3) 방식으로 TOP 3 자리를 만든다.
 * 동점 선수는 억지로 나누지 않고 같은 자리에 함께 표시한다.
 */
export function buildHallOfFameSlots(
  candidates: Array<{ profile: PlayerProfile; value: number }>,
  formatValue: (value: number) => string
): { slots: HallOfFameSlot[]; entries: HallOfFamePlayer[] } {
  const qualified = candidates
    .filter((candidate) => candidate.value > 0)
    .sort((a, b) => b.value - a.value || a.profile.name.localeCompare(b.profile.name, "ko"));

  const slots: HallOfFameSlot[] = [];
  const entries: HallOfFamePlayer[] = [];
  let index = 0;

  while (index < qualified.length) {
    const value = qualified[index].value;
    const tiedCandidates = qualified.filter((candidate) => candidate.value === value);
    const rank = index + 1;

    if (rank > 3) break;

    const tiedPlayers = tiedCandidates.map<HallOfFamePlayer>((candidate) => ({
      playerId: candidate.profile.id,
      playerName: candidate.profile.name,
      playerNickname: candidate.profile.nickname,
      playerPosition: parsePlayerPosition(candidate.profile.position),
      playerPhoto: getPlayerPhotoUrl(candidate.profile),
      playerHref: `/players/${candidate.profile.id}`,
      rank,
      value,
      displayValue: formatValue(value)
    }));

    entries.push(...tiedPlayers);
    slots.push({
      rank,
      value,
      displayValue: formatValue(value),
      players: tiedPlayers.slice(0, maxPlayersPerSlot),
      overflowCount: Math.max(0, tiedPlayers.length - maxPlayersPerSlot)
    });

    index += tiedCandidates.length;
  }

  return { slots, entries };
}

function buildPlayerAggregates(
  players: PlayerProfile[],
  appearances: Array<HallOfFameAppearance & { playerId: number }>
): PlayerAggregate[] {
  const appearancesByPlayer = new Map<number, HallOfFameAppearance[]>();

  for (const appearance of appearances) {
    const playerAppearances = appearancesByPlayer.get(appearance.playerId);
    if (playerAppearances) {
      playerAppearances.push(appearance);
      continue;
    }

    appearancesByPlayer.set(appearance.playerId, [appearance]);
  }

  return players.map((profile) => {
    const playerAppearances = appearancesByPlayer.get(profile.id) ?? [];
    const goals = playerAppearances.reduce((sum, appearance) => sum + appearance.goals, 0);
    const assists = playerAppearances.reduce((sum, appearance) => sum + appearance.assists, 0);

    return {
      profile,
      appearances: playerAppearances.length,
      wins: playerAppearances.filter((appearance) => appearance.result === matchResult.win).length,
      goals,
      assists,
      attackPoints: goals + assists,
      momCount: playerAppearances.filter((appearance) => appearance.isMvp).length,
      longestWinStreak: calculateLongestWinStreak(playerAppearances),
      longestScoringStreak: calculateLongestScoringStreak(playerAppearances),
      longestAssistStreak: calculateLongestAssistStreak(playerAppearances)
    };
  });
}

const categoryValueReaders: Record<HallOfFameCategoryKey, (aggregate: PlayerAggregate) => number> = {
  mostWins: (aggregate) => aggregate.wins,
  mostAppearances: (aggregate) => aggregate.appearances,
  longestWinStreak: (aggregate) => aggregate.longestWinStreak,
  longestScoringStreak: (aggregate) => aggregate.longestScoringStreak,
  longestAssistStreak: (aggregate) => aggregate.longestAssistStreak,
  mostGoals: (aggregate) => aggregate.goals,
  mostAssists: (aggregate) => aggregate.assists,
  mostAttackPoints: (aggregate) => aggregate.attackPoints,
  mostMom: (aggregate) => aggregate.momCount
};

export function buildHallOfFameCategories(aggregates: PlayerAggregate[]): HallOfFameCategory[] {
  return categoryMetas.map((meta) => {
    const candidates = aggregates.map((aggregate) => ({
      profile: aggregate.profile,
      value: categoryValueReaders[meta.key](aggregate)
    }));
    const { slots, entries } = buildHallOfFameSlots(candidates, meta.formatValue);

    return {
      key: meta.key,
      title: meta.title,
      englishTitle: meta.englishTitle,
      description: meta.description,
      icon: meta.icon,
      slots,
      entries,
      highlight: null
    };
  });
}

/**
 * 명예의 전당 데이터를 DB 실제 경기 기록에서 집계한다.
 * 하드코딩된 순위는 없으며, 경기/득점/도움이 등록되면 다음 요청에서 바로 반영된다.
 * 집계는 DB 쿼리 5개(선수 목록 / 출전 기록 / 경기 수 / 최신 수정 시각 2개)로 끝나며,
 * 연속 기록만 서버 메모리에서 한 번 순회해 계산한다.
 */
export async function getHallOfFameData(): Promise<HallOfFameData> {
  const completedMatchFilter = { status: matchStatus.completed };

  const [players, matchPlayers, totalMatches, latestMatch, latestMatchPlayer] = await Promise.all([
    prisma.player.findMany({
      where: { isActive: true },
      select: { id: true, name: true, nickname: true, position: true, profileImageUrl: true },
      orderBy: [{ number: "asc" }, { name: "asc" }]
    }),
    prisma.matchPlayer.findMany({
      where: { match: completedMatchFilter, player: { isActive: true } },
      select: {
        matchId: true,
        playerId: true,
        result: true,
        goals: true,
        assists: true,
        isMvp: true,
        match: { select: { matchDate: true } }
      },
      orderBy: [{ match: { matchDate: "asc" } }, { matchId: "asc" }]
    }),
    prisma.match.count({ where: completedMatchFilter }),
    prisma.match.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    prisma.matchPlayer.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } })
  ]);

  const appearances = matchPlayers.map((matchPlayer) => ({
    playerId: matchPlayer.playerId,
    matchId: matchPlayer.matchId,
    matchDate: matchPlayer.match.matchDate,
    result: matchPlayer.result,
    goals: matchPlayer.goals,
    assists: matchPlayer.assists,
    isMvp: matchPlayer.isMvp
  }));

  const updatedAtCandidates = [latestMatch?.updatedAt, latestMatchPlayer?.updatedAt].filter(
    (value): value is Date => Boolean(value)
  );
  const updatedAt = updatedAtCandidates.length
    ? new Date(Math.max(...updatedAtCandidates.map((value) => value.getTime())))
    : null;

  return {
    categories: buildHallOfFameCategories(buildPlayerAggregates(players, appearances)),
    updatedAt: updatedAt ? updatedAt.toISOString() : null,
    totalMatches,
    totalPlayers: players.length
  };
}

export function formatHallOfFameUpdatedAt(updatedAt: string | null) {
  if (!updatedAt) return "기록 없음";

  const parts = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul"
  }).formatToParts(new Date(updatedAt));

  const readPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";

  return `${readPart("year")}.${readPart("month")}.${readPart("day")} ${readPart("hour")}:${readPart("minute")}`;
}
