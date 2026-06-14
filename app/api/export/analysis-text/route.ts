import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { buildHistoryRows, buildMatchRows, buildPlayerRows, getExportData, getScoreSummary, getTeamPlayerNames, todayFileLabel } from "@/lib/export-data";
import { calculatePlayerStats, formatDate, getTeamMvpNames, matchStatus } from "@/lib/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function table(rows: Array<Array<string | number | boolean | null | undefined>>) {
  return rows.map((row) => row.map((cell) => String(cell ?? "").replace(/\s+/g, " ").trim()).join("\t")).join("\n");
}

function getPlayerPerformanceLines(match: Awaited<ReturnType<typeof getExportData>>["matches"][number]) {
  return match.matchPlayers
    .map((record) => {
      const mvpText = record.isMvp ? ", MVP" : "";
      return `- ${record.teamName} / ${record.player.name}: ${record.goals}골, ${record.assists}도움, 결과 ${record.result}${mvpText}`;
    })
    .join("\n");
}

function buildAnalysisText() {
  return `# ARENA Futsal Record - ChatGPT 분석 요청서

아래 데이터는 동호회 풋살 경기 기록이다. 이 내용을 기반으로 선수 조합, 팀 구성, 승패 원인, 득점/도움/MVP 패턴을 상세 분석해줘.

## 분석 요청 프롬프트

너는 풋살 경기 데이터 분석가이자 팀 밸런스 코치다. 아래 경기 기록과 선수별 통계를 바탕으로 다음을 분석해줘.

1. 승률이 높은 선수 조합과 함께 뛸 때 시너지가 좋아 보이는 조합을 찾아줘.
2. 특정 선수가 어느 팀 구성에서 강해지는지, 반대로 어떤 조합에서 패배가 많은지 설명해줘.
3. 득점, 도움, MVP 데이터를 함께 보고 공격 기여도가 높은 선수와 경기 영향력이 높은 선수를 구분해줘.
4. 팀별 점수 차이와 승패를 보고 패배가 많았던 경기의 공통 원인을 추론해줘.
5. 다음 경기에서 균형 잡힌 팀을 구성한다면 어떤 방식으로 나누면 좋을지 추천해줘.
6. 데이터가 부족해서 확정하기 어려운 부분은 추정이라고 명확히 표시해줘.
7. 마지막에는 바로 사용할 수 있는 추천 팀 구성 예시를 2~3개 제안해줘.

분석할 때 단순히 승률만 보지 말고, 출전 경기 수, 상대 팀 구성, 득점/도움, MVP, 점수 차이, 무승부 여부를 함께 고려해줘.

`;
}

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const { matches, players } = await getExportData();
  const completedMatches = matches.filter((match) => match.status === matchStatus.completed);
  const playerStats = players.map(calculatePlayerStats);

  const sections = [
    buildAnalysisText(),
    `## 데이터 요약

- 전체 경기 수: ${matches.length}
- 결과 등록 완료 경기 수: ${completedMatches.length}
- 선수 수: ${players.length}
- 데이터 생성일: ${todayFileLabel()}

`,
    `## 선수별 누적 통계

아래 표는 선수별 경기 수, 승패, 승률, 득점, 도움, MVP 횟수다.

${table(buildPlayerRows(players))}

`,
    `## 경기별 팀 구성 및 결과

아래 표는 경기 날짜, 팀별 선수 명단, 점수, 승패 결과를 포함한다.

${table(buildMatchRows(matches))}

`,
    `## 경기별 선수 상세 기록

아래 표는 각 경기에서 선수별 팀, 결과, 득점, 도움, MVP 여부를 포함한다.

${table(buildHistoryRows(matches))}

`,
    `## 사람이 읽기 쉬운 경기별 상세 메모

${matches
  .map(
    (match) => `### ${formatDate(match.matchDate)} / ${match.teamAName} vs ${match.teamBName}

- 장소: ${match.location}
- 결과: ${getScoreSummary(match)}
- ${match.teamAName} 선수: ${getTeamPlayerNames(match.matchPlayers, match.teamAName)}
- ${match.teamBName} 선수: ${getTeamPlayerNames(match.matchPlayers, match.teamBName)}
- ${match.teamAName} MVP: ${getTeamMvpNames(match.matchPlayers, match.teamAName)}
- ${match.teamBName} MVP: ${getTeamMvpNames(match.matchPlayers, match.teamBName)}
- 선수별 득점/도움:
${getPlayerPerformanceLines(match)}
- 메모: ${match.memo ?? "없음"}`
  )
  .join("\n\n")}

`,
    `## 참고: 간단 랭킹

### 득점 TOP
${playerStats
  .filter((player) => player.goals > 0)
  .sort((a, b) => b.goals - a.goals || b.assists - a.assists || b.mvpCount - a.mvpCount)
  .slice(0, 10)
  .map((player, index) => `${index + 1}. ${player.name}: ${player.goals}골, ${player.assists}도움, MVP ${player.mvpCount}회`)
  .join("\n")}

### 도움 TOP
${playerStats
  .filter((player) => player.assists > 0)
  .sort((a, b) => b.assists - a.assists || b.goals - a.goals || b.mvpCount - a.mvpCount)
  .slice(0, 10)
  .map((player, index) => `${index + 1}. ${player.name}: ${player.assists}도움, ${player.goals}골, MVP ${player.mvpCount}회`)
  .join("\n")}

### 승률 TOP
${playerStats
  .filter((player) => player.totalMatches > 0)
  .sort((a, b) => b.winRate - a.winRate || b.totalMatches - a.totalMatches || b.goals - a.goals)
  .slice(0, 10)
  .map((player, index) => `${index + 1}. ${player.name}: 승률 ${player.winRate}%, ${player.totalMatches}경기, ${player.wins}승 ${player.losses}패 ${player.draws}무`)
  .join("\n")}
`
  ];

  return new Response(sections.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="arena-futsal-analysis-prompt-${todayFileLabel()}.txt"`,
      "Cache-Control": "no-store"
    }
  });
}
