/**
 * 명예의 전당 연속 기록 계산 유틸리티.
 *
 * 연속 기록 정책(향후 변경 시 이 파일만 수정하면 된다):
 * - 선수가 "출전한 경기"만 순서대로 늘어놓고 계산한다. 결장한 경기는 계산에서 제외한다.
 *   (득점 → 결장 → 득점 은 2경기 연속 득점으로 인정된다.)
 * - 무승부는 연승을 유지하되 승수에 더하지 않고, 패배하면 연승이 끊긴다.
 * - 출전했지만 득점/도움 조건을 충족하지 못하면 해당 연속 기록이 끊긴다.
 * - 한 경기에서 2골 이상을 넣어도 연속 기록에서는 1경기로 계산한다.
 * - 항상 경기 날짜 오름차순으로 정렬한 뒤 계산하며, 현재 진행 중인 연속 기록이 아니라
 *   역대 최대 연속 기록을 반환한다.
 */

export type StreakAppearance = {
  matchId: number;
  matchDate: Date;
  result: string;
  goals: number;
  assists: number;
};

export type StreakPolicyKey = "win" | "goal" | "assist";

const winResult = "WIN";

export const streakPolicies: Record<StreakPolicyKey, (appearance: StreakAppearance) => boolean> = {
  win: (appearance) => appearance.result === winResult,
  goal: (appearance) => appearance.goals > 0,
  assist: (appearance) => appearance.assists > 0
};

/** 출전 기록을 경기 날짜 오름차순(동일 날짜는 경기 ID 오름차순)으로 정렬한다. */
export function sortAppearancesChronologically<T extends Pick<StreakAppearance, "matchId" | "matchDate">>(appearances: T[]) {
  return [...appearances].sort((a, b) => {
    const dateDiff = a.matchDate.getTime() - b.matchDate.getTime();
    if (dateDiff !== 0) return dateDiff;

    return a.matchId - b.matchId;
  });
}

/** 출전 경기 기준 최대 연속 기록 길이를 반환한다. 결장 경기는 목록에 포함되지 않으므로 자동으로 무시된다. */
export function calculateLongestStreak(
  appearances: StreakAppearance[],
  isStreakHit: (appearance: StreakAppearance) => boolean
) {
  let longest = 0;
  let current = 0;

  for (const appearance of sortAppearancesChronologically(appearances)) {
    if (isStreakHit(appearance)) {
      current += 1;
      if (current > longest) longest = current;
      continue;
    }

    current = 0;
  }

  return longest;
}

export function calculateLongestWinStreak(appearances: StreakAppearance[]) {
  return calculateLongestStreak(appearances.filter((appearance) => appearance.result !== "DRAW"), streakPolicies.win);
}

export function calculateLongestScoringStreak(appearances: StreakAppearance[]) {
  return calculateLongestStreak(appearances, streakPolicies.goal);
}

export function calculateLongestAssistStreak(appearances: StreakAppearance[]) {
  return calculateLongestStreak(appearances, streakPolicies.assist);
}
