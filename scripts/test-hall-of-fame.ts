/**
 * 명예의 전당 기록 계산 검증 스크립트.
 * 실행: npm run test:hall-of-fame
 *
 * 1) 합성 데이터로 9개 종목 계산식 / 공동 순위 / 사진 없음 / 기록 없음 케이스를 검증한다.
 * 2) DATABASE_URL 로 접속 가능하면 실제 DB 집계 결과를 독립적인 방식으로 재계산해 교차 검증한다.
 */
import { PrismaClient } from "@prisma/client";
import {
  buildHallOfFameCategories,
  buildHallOfFameSlots,
  getPlayerPhotoUrl,
  type HallOfFameCategory,
  type HallOfFameCategoryKey
} from "../lib/hall-of-fame";
import {
  calculateLongestAssistStreak,
  calculateLongestScoringStreak,
  calculateLongestWinStreak,
  type StreakAppearance
} from "../lib/record-streaks";

let failures = 0;
let checks = 0;

function check(label: string, actual: unknown, expected: unknown) {
  checks += 1;
  const actualText = JSON.stringify(actual);
  const expectedText = JSON.stringify(expected);

  if (actualText === expectedText) {
    console.log(`  ✓ ${label}`);
    return;
  }

  failures += 1;
  console.error(`  ✗ ${label}\n      기대값: ${expectedText}\n      실제값: ${actualText}`);
}

type TestMatch = { date: string; result: "WIN" | "LOSS" | "DRAW"; goals: number; assists: number };

function appearances(matches: TestMatch[], startId = 1): StreakAppearance[] {
  return matches.map((match, index) => ({
    matchId: startId + index,
    matchDate: new Date(`${match.date}T10:00:00.000Z`),
    result: match.result,
    goals: match.goals,
    assists: match.assists
  }));
}

function profile(id: number, name: string, profileImageUrl: string | null = null) {
  return { id, name, nickname: null, position: "미드필더", profileImageUrl };
}

function aggregate(
  id: number,
  name: string,
  values: Partial<
    Record<
      | "appearances"
      | "wins"
      | "goals"
      | "assists"
      | "attackPoints"
      | "momCount"
      | "longestWinStreak"
      | "longestScoringStreak"
      | "longestAssistStreak",
      number
    >
  >,
  profileImageUrl: string | null = null
) {
  return {
    profile: profile(id, name, profileImageUrl),
    appearances: values.appearances ?? 0,
    wins: values.wins ?? 0,
    goals: values.goals ?? 0,
    assists: values.assists ?? 0,
    attackPoints: values.attackPoints ?? 0,
    momCount: values.momCount ?? 0,
    longestWinStreak: values.longestWinStreak ?? 0,
    longestScoringStreak: values.longestScoringStreak ?? 0,
    longestAssistStreak: values.longestAssistStreak ?? 0
  };
}

function findCategory(categories: HallOfFameCategory[], key: HallOfFameCategoryKey) {
  const category = categories.find((item) => item.key === key);
  if (!category) throw new Error(`카테고리를 찾을 수 없습니다: ${key}`);

  return category;
}

console.log("\n[1] 연속 기록 계산 (날짜 오름차순 / 결장 제외 / 역대 최대)");
{
  // 입력을 일부러 날짜 역순으로 넣어 정렬 로직까지 검증한다.
  const winRecords = appearances([
    { date: "2026-03-01", result: "LOSS", goals: 0, assists: 0 },
    { date: "2026-01-04", result: "WIN", goals: 0, assists: 0 },
    { date: "2026-01-11", result: "WIN", goals: 0, assists: 0 },
    { date: "2026-01-18", result: "LOSS", goals: 0, assists: 0 },
    { date: "2026-01-25", result: "WIN", goals: 0, assists: 0 },
    { date: "2026-02-01", result: "WIN", goals: 0, assists: 0 },
    { date: "2026-02-08", result: "WIN", goals: 0, assists: 0 }
  ]);

  // 시간순: 1/4 승, 1/11 승, 1/18 패, 1/25 승, 2/1 승, 2/8 승, 3/1 패 → 역대 최대 3연승(현재 연승은 0)
  check("최다 연승 = 3 (현재 연승이 아닌 역대 최대)", calculateLongestWinStreak(winRecords), 3);

  const goalRecords = appearances([
    { date: "2026-09-01", result: "WIN", goals: 1, assists: 0 },
    { date: "2026-09-08", result: "LOSS", goals: 3, assists: 0 },
    { date: "2026-09-15", result: "WIN", goals: 2, assists: 1 },
    { date: "2026-09-22", result: "WIN", goals: 0, assists: 2 },
    { date: "2026-09-29", result: "WIN", goals: 1, assists: 0 }
  ]);

  check("최다 연속골 = 3 (한 경기 멀티골도 1경기)", calculateLongestScoringStreak(goalRecords), 3);
  check("최다 연속도움 = 2 (9/22 · 9/15 도움 연속)", calculateLongestAssistStreak(goalRecords), 2);

  // 9/8 결장(출전 기록 없음) → 9/1 득점과 9/15 득점은 연속으로 인정된다.
  const absenceRecords = appearances([
    { date: "2026-09-01", result: "WIN", goals: 1, assists: 1 },
    { date: "2026-09-15", result: "WIN", goals: 1, assists: 1 }
  ]);

  check("득점 → 결장 → 득점 = 2경기 연속골", calculateLongestScoringStreak(absenceRecords), 2);
  check("득점 → 결장 → 득점 = 2경기 연속도움", calculateLongestAssistStreak(absenceRecords), 2);
  check("출전 기록이 없으면 0", calculateLongestWinStreak([]), 0);
}

console.log("\n[2] 9개 종목 집계 + 표시값");
{
  const categories = buildHallOfFameCategories([
    aggregate(1, "김민석", { appearances: 41, wins: 23, goals: 24, assists: 8, attackPoints: 32, momCount: 9, longestWinStreak: 7, longestScoringStreak: 5, longestAssistStreak: 4 }),
    aggregate(2, "이동훈", { appearances: 38, wins: 19, goals: 19, assists: 20, attackPoints: 39, momCount: 11, longestWinStreak: 5, longestScoringStreak: 3, longestAssistStreak: 2 }),
    aggregate(3, "김민기", { appearances: 30, wins: 17, goals: 17, assists: 4, attackPoints: 21, momCount: 9, longestWinStreak: 4, longestScoringStreak: 2, longestAssistStreak: 1 }),
    aggregate(4, "박지훈", { appearances: 12, wins: 3, goals: 1, assists: 0, attackPoints: 1, momCount: 0, longestWinStreak: 1, longestScoringStreak: 1, longestAssistStreak: 0 })
  ]);

  check("종목 수 = 9", categories.length, 9);
  check(
    "종목 순서",
    categories.map((category) => category.key),
    [
      "mostWins",
      "mostAppearances",
      "longestWinStreak",
      "longestScoringStreak",
      "longestAssistStreak",
      "mostGoals",
      "mostAssists",
      "mostAttackPoints",
      "mostMom"
    ]
  );
  check(
    "최다승 TOP 3 표시값",
    findCategory(categories, "mostWins").slots.map((slot) => slot.displayValue),
    ["23승", "19승", "17승"]
  );
  check(
    "최다 출전 TOP 3 표시값",
    findCategory(categories, "mostAppearances").slots.map((slot) => slot.displayValue),
    ["41경기", "38경기", "30경기"]
  );
  check("최다 연승 1위 표시값", findCategory(categories, "longestWinStreak").slots[0].displayValue, "7연승");
  check("최다 연속골 1위 표시값", findCategory(categories, "longestScoringStreak").slots[0].displayValue, "5경기 연속골");
  check("최다 연속도움 1위 표시값", findCategory(categories, "longestAssistStreak").slots[0].displayValue, "4경기 연속도움");
  check(
    "최다 득점 TOP 3 선수",
    findCategory(categories, "mostGoals").slots.map((slot) => slot.players.map((player) => player.playerName)),
    [["김민석"], ["이동훈"], ["김민기"]]
  );
  check(
    "최다 도움 TOP 3 표시값",
    findCategory(categories, "mostAssists").slots.map((slot) => [slot.players[0].playerName, slot.displayValue]),
    [
      ["이동훈", "20도움"],
      ["김민석", "8도움"],
      ["김민기", "4도움"]
    ]
  );
  check(
    "도움 0인 선수는 최다 도움 순위에서 제외",
    findCategory(categories, "mostAssists").entries.map((entry) => entry.playerName),
    ["이동훈", "김민석", "김민기"]
  );
  check(
    "최다 MOM: 1위 단독 + 공동 2위는 같은 슬롯",
    findCategory(categories, "mostMom").slots.map((slot) => [slot.rank, slot.players.map((player) => player.playerName), slot.displayValue]),
    [
      [1, ["이동훈"], "11회"],
      [2, ["김민기", "김민석"], "9회"]
    ]
  );
  check(
    "MOM 0회인 선수는 순위에서 제외",
    findCategory(categories, "mostMom").entries.map((entry) => entry.playerName),
    ["이동훈", "김민기", "김민석"]
  );
  check(
    "기록 0인 선수는 연속도움 순위에서 제외",
    findCategory(categories, "longestAssistStreak").entries.map((entry) => entry.playerName),
    ["김민석", "이동훈", "김민기"]
  );

  // 공격 포인트는 득점 + 도움이므로 최다 득점 1위(김민석)와 순위가 달라질 수 있다.
  check(
    "최다 공격 포인트 TOP 3 (득점+도움 합계)",
    findCategory(categories, "mostAttackPoints").slots.map((slot) => [slot.players[0].playerName, slot.displayValue]),
    [
      ["이동훈", "39포인트"],
      ["김민석", "32포인트"],
      ["김민기", "21포인트"]
    ]
  );
}

console.log("\n[3] 공동 순위 (Competition Ranking: 1, 1, 3)");
{
  const { slots, entries } = buildHallOfFameSlots(
    [
      { profile: profile(1, "김민석"), value: 20 },
      { profile: profile(2, "이동훈"), value: 20 },
      { profile: profile(3, "김민기"), value: 18 },
      { profile: profile(4, "박지훈"), value: 12 }
    ],
    (value) => `${value}골`
  );

  check("동점 1위는 하나의 슬롯에 묶인다", slots.map((slot) => slot.players.map((player) => player.playerName)), [
    ["김민석", "이동훈"],
    ["김민기"]
  ]);
  check("다음 순위는 2위가 아니라 3위", slots.map((slot) => slot.rank), [1, 3]);
  check("평면 목록 순위", entries.map((entry) => [entry.playerName, entry.rank]), [
    ["김민석", 1],
    ["이동훈", 1],
    ["김민기", 3]
  ]);

  const fourWayTie = buildHallOfFameSlots(
    [1, 2, 3, 4].map((id) => ({ profile: profile(id, `선수${id}`), value: 9 })),
    (value) => `${value}승`
  );

  check("4명 공동 1위는 3명까지 노출 + 나머지는 overflow", fourWayTie.slots[0].players.length, 3);
  check("overflowCount", fourWayTie.slots[0].overflowCount, 1);
  check("공동 1위뿐이면 슬롯은 1개", fourWayTie.slots.length, 1);

  const empty = buildHallOfFameSlots([{ profile: profile(1, "김민석"), value: 0 }], (value) => `${value}골`);
  check("기록이 0뿐이면 슬롯 없음(가짜 기록 없음)", empty.slots.length, 0);
  check("후보가 없으면 슬롯 없음", buildHallOfFameSlots([], (value) => `${value}골`).slots.length, 0);
}

console.log("\n[4] 선수 사진 연결");
{
  check("업로드된 사진 우선", getPlayerPhotoUrl({ id: 7, profileImageUrl: "/uploads/players/7-abc.jpg" }), "/uploads/players/7-abc.jpg");
  check("다른 팀은 기존 선수 사진을 사용하지 않음", getPlayerPhotoUrl({ id: 7, teamId: 2, profileImageUrl: null }), "");
  check("사진이 없으면 기본 선수 이미지 경로", getPlayerPhotoUrl({ id: 7, profileImageUrl: null }), "/images/players/7.jpg");

  const { slots } = buildHallOfFameSlots([{ profile: profile(7, "무사진", null), value: 3 }], (value) => `${value}골`);
  check("사진 없는 선수도 순위에 포함", slots[0].players[0].playerPhoto, "/images/players/7.jpg");
  check("선수 상세 링크", slots[0].players[0].playerHref, "/players/7");
}

async function verifyAgainstDatabase() {
  const prisma = new PrismaClient();

  try {
    const [players, matchPlayers] = await Promise.all([
      prisma.player.findMany({
        where: { isActive: true },
        select: { id: true, name: true, nickname: true, position: true, profileImageUrl: true }
      }),
      prisma.matchPlayer.findMany({
        where: { match: { status: "COMPLETED" }, player: { isActive: true } },
        select: {
          matchId: true,
          playerId: true,
          result: true,
          goals: true,
          assists: true,
          isMvp: true,
          match: { select: { matchDate: true } }
        }
      })
    ]);

    console.log(`\n[5] 실제 DB 교차 검증 (선수 ${players.length}명 / 출전기록 ${matchPlayers.length}건)`);

    const categories = buildHallOfFameCategories(
      players.map((player) => {
        const rows = matchPlayers.filter((row) => row.playerId === player.id);
        const playerAppearances: StreakAppearance[] = rows.map((row) => ({
          matchId: row.matchId,
          matchDate: row.match.matchDate,
          result: row.result,
          goals: row.goals,
          assists: row.assists
        }));

        const goals = rows.reduce((sum, row) => sum + row.goals, 0);
        const assists = rows.reduce((sum, row) => sum + row.assists, 0);

        return {
          profile: player,
          appearances: rows.length,
          wins: rows.filter((row) => row.result === "WIN").length,
          goals,
          assists,
          attackPoints: goals + assists,
          momCount: rows.filter((row) => row.isMvp).length,
          longestWinStreak: calculateLongestWinStreak(playerAppearances),
          longestScoringStreak: calculateLongestScoringStreak(playerAppearances),
          longestAssistStreak: calculateLongestAssistStreak(playerAppearances)
        };
      })
    );

    // Prisma 집계(groupBy)로 독립 계산해 교차 검증한다.
    const goalTotals = await prisma.matchPlayer.groupBy({
      by: ["playerId"],
      where: { match: { status: "COMPLETED" }, player: { isActive: true } },
      _sum: { goals: true, assists: true },
      _count: { _all: true }
    });

    const topGoalValue = Math.max(0, ...goalTotals.map((row) => row._sum.goals ?? 0));
    const topAppearanceValue = Math.max(0, ...goalTotals.map((row) => row._count._all));
    const mostGoals = findCategory(categories, "mostGoals");
    const mostAppearances = findCategory(categories, "mostAppearances");

    check("DB 최다 득점 1위 값이 groupBy 합계와 일치", mostGoals.slots[0]?.value ?? 0, topGoalValue);
    check("DB 최다 출전 1위 값이 groupBy 건수와 일치", mostAppearances.slots[0]?.value ?? 0, topAppearanceValue);

    const winRows = await prisma.matchPlayer.groupBy({
      by: ["playerId"],
      where: { match: { status: "COMPLETED" }, player: { isActive: true }, result: "WIN" },
      _count: { _all: true }
    });
    const topWinValue = Math.max(0, ...winRows.map((row) => row._count._all));
    check("DB 최다승 1위 값이 groupBy 승수와 일치", findCategory(categories, "mostWins").slots[0]?.value ?? 0, topWinValue);

    const topAssistValue = Math.max(0, ...goalTotals.map((row) => row._sum.assists ?? 0));
    check("DB 최다 도움 1위 값이 groupBy 합계와 일치", findCategory(categories, "mostAssists").slots[0]?.value ?? 0, topAssistValue);

    const topAttackPointValue = Math.max(0, ...goalTotals.map((row) => (row._sum.goals ?? 0) + (row._sum.assists ?? 0)));
    check(
      "DB 최다 공격 포인트 1위 값이 groupBy 득점+도움과 일치",
      findCategory(categories, "mostAttackPoints").slots[0]?.value ?? 0,
      topAttackPointValue
    );

    const momRows = await prisma.matchPlayer.groupBy({
      by: ["playerId"],
      where: { match: { status: "COMPLETED" }, player: { isActive: true }, isMvp: true },
      _count: { _all: true }
    });
    const topMomValue = Math.max(0, ...momRows.map((row) => row._count._all));
    check("DB 최다 MOM 1위 값이 groupBy 선정 횟수와 일치", findCategory(categories, "mostMom").slots[0]?.value ?? 0, topMomValue);

    for (const category of categories) {
      const ranks = category.slots.map((slot) => slot.rank);
      const values = category.slots.map((slot) => slot.value);
      const isDescending = values.every((value, index) => index === 0 || values[index - 1] > value);
      const expectedRanks = category.slots.map((slot, index) =>
        index === 0 ? 1 : category.entries.filter((entry) => entry.value > slot.value).length + 1
      );

      check(`${category.title}: 값 내림차순`, isDescending, true);
      check(`${category.title}: Competition Ranking 순위`, ranks, expectedRanks);

      console.log(
        `    · ${category.title}: ${
          category.slots
            .map((slot) => `${slot.rank}위 ${slot.players.map((player) => player.playerName).join("·")} ${slot.displayValue}`)
            .join(" / ") || "기록 없음"
        }`
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

verifyAgainstDatabase()
  .catch((error) => {
    console.warn(`\n[5] 실제 DB 교차 검증을 건너뜁니다: ${(error as Error).message}`);
  })
  .finally(() => {
    console.log(`\n검증 ${checks}건 중 실패 ${failures}건`);
    process.exit(failures > 0 ? 1 : 0);
  });
