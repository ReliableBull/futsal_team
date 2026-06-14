import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import {
  buildHistoryRows,
  buildMatchRows,
  buildPlayerRows,
  chunk,
  getExportData,
  getScoreSummary,
  getTeamPlayerNameList,
  todayFileLabel
} from "@/lib/export-data";
import { createWorkbook, type CellValue, type StyledCell } from "@/lib/excel";
import { formatDate, getTeamMvpNames } from "@/lib/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function styled(value: CellValue, style: number): StyledCell {
  return { value, style };
}

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const { matches, players } = await getExportData();
  const matchRows = buildMatchRows(matches);

  const dailySummaryRows = chunk(matches, 5).flatMap((matchGroup, groupIndex) => {
    const blocks = matchGroup.map((match) => {
      const teamAPlayers = getTeamPlayerNameList(match.matchPlayers, match.teamAName);
      const teamBPlayers = getTeamPlayerNameList(match.matchPlayers, match.teamBName);
      const rowCount = Math.max(teamAPlayers.length, teamBPlayers.length);

      return [
        [styled("날짜", 1), styled(formatDate(match.matchDate), 2), styled("", 2)],
        [styled("장소", 1), styled(match.location, 2), styled("", 2)],
        [styled("승패", 1), styled(getScoreSummary(match), 2), styled("", 2)],
        [styled("회장팀 MVP", 1), styled(getTeamMvpNames(match.matchPlayers, match.teamAName), 3), styled("", 3)],
        [styled("총무팀 MVP", 1), styled(getTeamMvpNames(match.matchPlayers, match.teamBName), 4), styled("", 4)],
        [styled("S/N", 1), styled(match.teamAName, 3), styled(match.teamBName, 4)],
        ...Array.from({ length: rowCount }, (_, index) => [
          styled(index + 1, 5),
          styled(teamAPlayers[index] ?? "", 5),
          styled(teamBPlayers[index] ?? "", 5)
        ]),
        [styled("점수", 1), styled(match.teamAScore, 3), styled(match.teamBScore, 4)]
      ];
    });
    const maxRows = Math.max(...blocks.map((block) => block.length));
    const spacerRows = groupIndex === 0 ? [] : [Array.from({ length: 19 }, () => "")];

    return [
      ...spacerRows,
      ...Array.from({ length: maxRows }, (_, rowIndex) =>
        blocks.flatMap((block, blockIndex) => {
          const row = block[rowIndex] ?? ["", "", ""];
          return blockIndex === blocks.length - 1 ? row : [...row, ""];
        })
      )
    ];
  });

  const historyRows = buildHistoryRows(matches);
  const playerRows = buildPlayerRows(players);

  const workbook = createWorkbook([
    { name: "전체 경기 전적", rows: matchRows },
    { name: "일별 경기 요약", rows: dailySummaryRows },
    { name: "경기 History", rows: historyRows },
    { name: "선수 통계", rows: playerRows }
  ]);

  return new Response(workbook, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="arena-futsal-record-${todayFileLabel()}.xlsx"`,
      "Cache-Control": "no-store"
    }
  });
}
