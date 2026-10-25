export type MatchSharePlayer = { id: number; name: string; goals: number; assists: number; isMvp: boolean };
export type MatchShareData = {
  teamName?: string;
  id: number;
  date: string;
  location: string;
  completed: boolean;
  teams: [{ name: string; score: number; players: MatchSharePlayer[] }, { name: string; score: number; players: MatchSharePlayer[] }];
};

type ShareMatch = {
  id: number; matchDate: Date; location: string; status: string;
  teamAName: string; teamBName: string; teamAScore: number; teamBScore: number;
  matchPlayers: Array<{ playerId: number; teamName: string; goals: number; assists: number; isMvp: boolean; player: { name: string } }>;
};

export function buildMatchShareData(match: ShareMatch): MatchShareData {
  const team = (name: string, score: number) => ({
    name, score,
    players: match.matchPlayers.filter((player) => player.teamName === name)
      .map((record) => ({ id: record.playerId, name: record.player.name, goals: record.goals, assists: record.assists, isMvp: record.isMvp }))
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.name.localeCompare(b.name, "ko") || a.id - b.id)
  });
  return {
    id: match.id, date: match.matchDate.toISOString().slice(0, 10), location: match.location,
    completed: match.status === "COMPLETED",
    teams: [team(match.teamAName, match.teamAScore), team(match.teamBName, match.teamBScore)]
  };
}

export function matchShareTitle(data: MatchShareData) {
  const [a, b] = data.teams;
  return `${data.date} ${a.name} ${a.score} : ${b.score} ${b.name}${data.completed ? "" : " (경기 진행 중)"}`;
}

const fontFamily = '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';

/** Draw both the preview and the downloaded PNG from one canvas, without remote images or fonts. */
export function drawMatchShareCard(canvas: HTMLCanvasElement, data: MatchShareData) {
  const width = 1080;
  const rows = Math.max(1, ...data.teams.map((team) => team.players.length));
  const height = Math.max(1080, 690 + rows * 58);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이 브라우저에서 이미지를 만들 수 없습니다.");

  function text(value: string, x: number, y: number, size: number, color: string, maxWidth: number, align: CanvasTextAlign = "left", weight = 700) {
    const context = ctx!;
    let fontSize = size;
    context.font = `${weight} ${fontSize}px ${fontFamily}`;
    while (context.measureText(value).width > maxWidth && fontSize > size * 0.65) {
      fontSize--;
      context.font = `${weight} ${fontSize}px ${fontFamily}`;
    }
    const characters = Array.from(value.replace(/\s+/g, " "));
    let output = characters.join("");
    while (context.measureText(output).width > maxWidth && characters.length > 0) {
      characters.pop();
      output = `${characters.join("")}…`;
    }
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = "middle";
    context.fillText(output, x, y);
  }

  ctx.fillStyle = "#0d1728";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#ef4136";
  ctx.fillRect(0, 0, width, 12);
  ctx.fillStyle = "#152238";
  ctx.beginPath();
  ctx.moveTo(760, 12); ctx.lineTo(1080, 12); ctx.lineTo(1080, 490); ctx.lineTo(560, 490); ctx.closePath(); ctx.fill();

  text(data.teamName || "ARENA FC", 64, 76, 40, "#ffffff", 540, "left", 900);
  text(data.completed ? "MATCH RESULT" : "LIVE · 경기 진행 중", 1016, 76, 22, data.completed ? "#94a3b8" : "#fbbf24", 370, "right");
  text(data.date.replaceAll("-", "."), 64, 134, 25, "#cbd5e1", 300);
  text(data.location, 1016, 134, 25, "#cbd5e1", 620, "right", 500);

  const [a, b] = data.teams;
  const result = !data.completed ? "현재 스코어 · 최종 결과가 아닙니다" : a.score === b.score ? "무승부" : `${a.score > b.score ? a.name : b.name} 승리`;
  text(a.name, 284, 224, 38, "#ffffff", 420, "center", 800);
  text(b.name, 796, 224, 38, "#ffffff", 420, "center", 800);
  text(String(a.score), 284, 334, 144, "#ffffff", 390, "center", 900);
  text(":", 540, 324, 74, "#64748b", 80, "center");
  text(String(b.score), 796, 334, 144, "#ffffff", 390, "center", 900);
  text(result, 540, 446, 28, data.completed ? "#ff8077" : "#fbbf24", 940, "center");

  data.teams.forEach((team, index) => {
    const x = index === 0 ? 64 : 560;
    const panelWidth = 456;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, 498, panelWidth, 64 + rows * 58);
    ctx.fillStyle = index === 0 ? "#ef4136" : "#2563eb";
    ctx.fillRect(x, 498, panelWidth, 5);
    text("출전 선수", x + 18, 534, 22, "#64748b", 260);
    text("득점", x + 353, 534, 20, "#64748b", 65, "center");
    text("도움", x + 413, 534, 20, "#64748b", 65, "center");
    if (team.players.length === 0) text("등록된 선수 없음", x + 18, 592, 23, "#64748b", 410);
    team.players.forEach((player, row) => {
      const y = 592 + row * 58;
      if (player.isMvp) {
        ctx.fillStyle = "#fff5ed";
        ctx.fillRect(x, y - 28, panelWidth, 56);
        text("MOM", x + 274, y, 18, "#b45309", 64, "center", 900);
      }
      text(player.name, x + 18, y, 26, "#0f172a", player.isMvp ? 218 : 290);
      text(String(player.goals), x + 353, y, 27, "#0f172a", 60, "center", 800);
      text(String(player.assists), x + 413, y, 27, "#0f172a", 60, "center", 800);
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(x + 18, y + 28, panelWidth - 36, 1);
    });
  });

  text("MOM · 경기 최우수 선수", 64, height - 74, 21, "#94a3b8", 620, "left", 500);
  text(`MATCH #${data.id}`, 1016, height - 74, 21, "#94a3b8", 320, "right");
  text(`함께 뛰는 시간, 하나가 되는 ${data.teamName || "ARENA FC"}`, 64, height - 38, 21, "#94a3b8", 952, "left", 500);
}
