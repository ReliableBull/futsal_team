import { createWorkbook, type StyledCell } from "@/lib/excel";

export type PlayerListExportRow = {
  name: string;
  nickname: string | null;
  position: string;
  number: number | null;
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  goals: number;
  assists: number;
  attackPoints: number;
  attackPointsPerMatch: number;
  mvpCount: number;
};

type ExportContext = {
  teamName?: string;
  startDate: string;
  endDate: string;
  sortLabel: string;
  direction: "asc" | "desc";
};

export const playerListExcelType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Rows are the visible, already sorted snapshot; do not requery or reorder. */
export function createPlayerListWorkbook(players: PlayerListExportRow[], context: ExportContext) {
  const headers = ["선수 이름", "닉네임", "포지션", "등번호", "경기", "승", "패", "무", "승률", "득점", "도움", "공격 포인트", "경기당 공격 포인트", "MOM"];
  const headerRow = 5;
  return createWorkbook([{
    name: "선수 기록",
    columnWidths: [16, 42, 28, 10, 10, 8, 8, 8, 12, 10, 10, 16, 24, 10],
    rowHeights: [30, 24, 24, 24, 28, ...players.map(() => 24)],
    mergeCells: ["A1:N1", "A2:N2", "A3:N3", "A4:N4"],
    freezeRows: headerRow,
    autoFilter: `A${headerRow}:N${headerRow + players.length}`,
    table: players.length ? { name: "ArenaPlayerRecords", ref: `A${headerRow}:N${headerRow + players.length}`, columns: headers } : undefined,
    rows: [
      [{ value: `${context.teamName || "ARENA FC"} 선수 기록`, style: 7 }],
      [`조회 기간: ${context.startDate} ~ ${context.endDate}`],
      [`정렬: ${context.sortLabel} · ${context.direction === "asc" ? "오름차순" : "내림차순"} | 완료된 경기 기준 · 공격 포인트 = 득점 + 도움 · 경기당 공격 포인트 = 공격 포인트 ÷ 출전 경기 수`],
      ["사용법: 열 제목 옆 ▼를 눌러 오름차순·내림차순 정렬 또는 값 필터를 선택하세요."],
      headers.map((value): StyledCell => ({ value, style: 1 })),
      ...players.map((player, index) => {
        const row = headerRow + index + 1;
        return [
          player.name, player.nickname ?? "", player.position, player.number ?? "",
          player.totalMatches, player.wins, player.losses, player.draws,
          { value: player.winRate / 100, style: 6, formula: `IF(E${row}=0,0,F${row}/E${row})` },
          player.goals, player.assists,
          { value: player.attackPoints, style: 7, formula: `J${row}+K${row}` },
          { value: player.attackPointsPerMatch, style: 8, formula: `IF(E${row}=0,0,ROUND(L${row}/E${row},2))` },
          player.mvpCount
        ];
      })
    ]
  }]);
}
