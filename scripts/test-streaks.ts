import assert from "node:assert/strict";
import type { Player } from "@prisma/client";
import { calculatePlayerStats, calculatePlayerStreakHistories, type MatchResultValue } from "../lib/stats";
import { calculateLongestWinStreak } from "../lib/record-streaks";

const date = new Date("2026-01-01T00:00:00Z");
const player: Player = {
  teamId: 1, id: 1, name: "연승 테스트", nickname: null, profileImageUrl: null,
  position: "미드필더", number: 1, isActive: true, createdAt: date, updatedAt: date
};

function records(results: MatchResultValue[]) {
  return results.map((result, index) => ({
    id: index + 1, matchId: index + 1, playerId: 1, teamName: "A", result,
    goals: result === "WIN" ? 1 : 0, assists: result === "WIN" ? 1 : 0,
    isMvp: false, createdAt: date, updatedAt: date,
    match: { id: index + 1, matchDate: new Date(Date.UTC(2026, 0, index + 1)) }
  }));
}

const cases: { results: MatchResultValue[]; current: number; best: number }[] = [
  { results: [], current: 0, best: 0 },
  { results: ["DRAW", "DRAW"], current: 0, best: 0 },
  { results: ["WIN", "WIN", "WIN", "WIN", "WIN", "WIN", "DRAW"], current: 6, best: 6 },
  { results: ["WIN", "WIN", "WIN", "WIN", "WIN", "WIN", "DRAW", "WIN"], current: 7, best: 7 },
  { results: ["DRAW", "WIN", "DRAW", "DRAW", "WIN", "DRAW"], current: 2, best: 2 },
  { results: ["WIN", "DRAW", "WIN", "LOSS", "DRAW"], current: 0, best: 2 },
  { results: ["WIN", "DRAW", "WIN", "LOSS", "DRAW", "WIN", "DRAW"], current: 1, best: 2 }
];

for (const { results, current, best } of cases) {
  // Reverse input to verify that all public calculations sort the appearances.
  const matchPlayers = records(results).reverse();
  const stats = calculatePlayerStats({ ...player, matchPlayers });
  const histories = calculatePlayerStreakHistories(matchPlayers);
  const appearances = matchPlayers.map((record) => ({ ...record, matchDate: record.match.matchDate }));
  const label = results.join(" → ") || "기록 없음";
  assert.equal(stats.currentWinStreak, current, `${label}: 현재 연승`);
  assert.equal(calculateLongestWinStreak(appearances), best, `${label}: 명예의 전당`);
  assert.equal(histories.win[0]?.length ?? 0, best, `${label}: 최고 연승 이력`);
  assert.equal(stats.totalMatches, results.length);
  assert.equal(stats.draws, results.filter((result) => result === "DRAW").length);
  assert.equal(stats.wins, results.filter((result) => result === "WIN").length);
}

const matchPlayers = records(["DRAW", "WIN", "DRAW", "WIN", "DRAW"]);
const stats = calculatePlayerStats({ ...player, matchPlayers });
const histories = calculatePlayerStreakHistories(matchPlayers);
assert.equal(stats.winRate, 40, "무승부는 승률 분모에 포함한다");
assert.equal(stats.currentGoalStreak, 0, "무득점 무승부는 득점 연속 기록을 끊는다");
assert.equal(stats.currentAssistStreak, 0, "무도움 무승부는 도움 연속 기록을 끊는다");
assert.deepEqual(histories.win, [{
  length: 2, startDate: matchPlayers[1].match.matchDate, endDate: matchPlayers[3].match.matchDate,
  startMatchId: 2, endMatchId: 4
}], "연승 기간은 첫 승리부터 마지막 승리까지 표시한다");
assert.deepEqual(histories.goal.map((run) => run.length), [1, 1]);
assert.deepEqual(histories.assist.map((run) => run.length), [1, 1]);

const tied = calculatePlayerStreakHistories(records(["WIN", "DRAW", "WIN", "LOSS", "WIN", "DRAW", "WIN", "DRAW"]));
assert.deepEqual(tied.win.map((run) => [run.length, run.startMatchId, run.endMatchId]), [[2, 5, 7], [2, 1, 3]], "동률 최고 연승은 최근 기록부터 표시한다");
console.log("연승 검증 통과: 무승부 유지, 승리 증가, 패배 초기화, 최고 기록·기간 및 득점/도움 기록");
