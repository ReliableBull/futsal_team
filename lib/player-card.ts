import { drawPlayerCardDesign } from "./player-card-designs";
import type { PlayerCardPhotoFit } from "./player-card-photos";

export const playerCardThemes = [
  { id: "editorial", label: "에디토리얼", description: "아이보리 · 스포츠 매거진", accent: "#d53c27", background: "#f3f0e8", panel: "#dedbd1", muted: "#77796d" },
  { id: "noir", label: "블랙 시그니처", description: "흑백 · 프리미엄 포트레이트", accent: "#cbc7b3", background: "#141615", panel: "#343833", muted: "#9b9f91" },
  { id: "archive", label: "클럽 아카이브", description: "딥 그린 · 클래식 티켓", accent: "#dbec9b", background: "#123f35", panel: "#e9ead5", muted: "#bdcdb4" },
  { id: "arena", label: "ARENA 레드", description: "네이비 · 레드 포인트", accent: "#ff5148", background: "#0a1220", panel: "#152033", muted: "#9facbf" },
  { id: "gold", label: "챔피언 골드", description: "블랙 · 골드 포인트", accent: "#e6be76", background: "#151311", panel: "#27231e", muted: "#b9afa1" }
] as const;

export type PlayerCardTheme = (typeof playerCardThemes)[number]["id"];
export type PlayerCardData = {
  id: number;
  name: string;
  nickname: string | null;
  position: string;
  number: number | null;
  photoUrl: string;
  totalMatches: number;
  goals: number;
  assists: number;
  mvpCount: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  attackPoints: number;
  periodLabel: string;
};

type PlayerCardSource = Omit<PlayerCardData, "photoUrl" | "attackPoints" | "periodLabel"> & { profileImageUrl: string | null };

export function buildPlayerCardData(player: PlayerCardSource, completedMatchDates: Date[]): PlayerCardData {
  const dates = completedMatchDates.map((date) => date.toISOString().slice(0, 10)).sort();
  return {
    id: player.id, name: player.name, nickname: player.nickname, position: player.position, number: player.number,
    photoUrl: player.profileImageUrl || `/images/players/${player.id}.jpg`,
    totalMatches: player.totalMatches, goals: player.goals, assists: player.assists, mvpCount: player.mvpCount,
    wins: player.wins, draws: player.draws, losses: player.losses, winRate: player.winRate,
    attackPoints: player.goals + player.assists,
    periodLabel: dates.length ? `${dates[0]} ~ ${dates[dates.length - 1]}` : "아직 완료된 출전 경기가 없습니다"
  };
}

/** Anonymous image loading keeps the exported canvas readable, including CORS-enabled remote photos. */
export function loadPlayerCardPhoto(src: string, signal: AbortSignal): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (signal.aborted) { resolve(null); return; }
    const image = new Image();
    let finished = false;
    const timeout = window.setTimeout(() => finish(null), 8000);
    function finish(result: HTMLImageElement | null) {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", cancel);
      image.onload = null;
      image.onerror = null;
      if (!result) image.removeAttribute("src");
      resolve(result);
    }
    function cancel() { finish(null); }
    signal.addEventListener("abort", cancel, { once: true });
    image.crossOrigin = "anonymous";
    image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0 ? image : null);
    image.onerror = () => finish(null);
    image.src = src;
  });
}

const fontFamily = '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';

/** The preview and PNG are the same 1080 × 1440 canvas; all numbers come from the existing player statistics. */
export function drawPlayerCard(canvas: HTMLCanvasElement, data: PlayerCardData, themeId: PlayerCardTheme, photo: HTMLImageElement | null, photoFit: PlayerCardPhotoFit = "cover") {
  canvas.width = 1080;
  canvas.height = 1440;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이 브라우저에서 선수 카드를 만들 수 없습니다.");
  if (themeId === "editorial" || themeId === "noir" || themeId === "archive") {
    drawPlayerCardDesign(ctx, data, themeId, photo, photoFit);
    return;
  }
  const theme = playerCardThemes.find((item) => item.id === themeId) ?? playerCardThemes[0];

  function text(value: string, x: number, y: number, size: number, color: string, width: number, align: CanvasTextAlign = "left", weight = 700) {
    const context = ctx!;
    let fontSize = size;
    const chars = Array.from(value.replace(/\s+/g, " ").trim());
    let output = chars.join("");
    context.font = `${weight} ${fontSize}px ${fontFamily}`;
    while (context.measureText(output).width > width && fontSize > size * 0.65) {
      context.font = `${weight} ${--fontSize}px ${fontFamily}`;
    }
    while (context.measureText(output).width > width && chars.length > 0) {
      chars.pop();
      output = `${chars.join("")}…`;
    }
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = "middle";
    context.fillText(output, x, y);
  }

  function line(x1: number, y1: number, x2: number, y2: number, color: string, width = 1) {
    ctx!.strokeStyle = color;
    ctx!.lineWidth = width;
    ctx!.beginPath(); ctx!.moveTo(x1, y1); ctx!.lineTo(x2, y2); ctx!.stroke();
  }

  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, 1080, 1440);
  const glow = ctx.createRadialGradient(1000, 230, 0, 1000, 230, 1050);
  glow.addColorStop(0, themeId === "gold" ? "#59462a" : "#283959");
  glow.addColorStop(1, theme.background);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1080, 1440);
  ctx.strokeStyle = `${theme.accent}65`;
  ctx.lineWidth = 2;
  ctx.strokeRect(28, 28, 1024, 1384);
  ctx.fillStyle = theme.accent;
  ctx.fillRect(28, 28, 180, 6);
  ctx.fillRect(872, 1406, 180, 6);
  for (let i = 0; i < 10; i++) line(540 + i * 60, 160, 300 + i * 60, 850, `${theme.accent}0c`);

  // Original profiles keep their cover crop; full-body poses fit above the name.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(386, 184); ctx.lineTo(1004, 184); ctx.lineTo(1004, 790); ctx.lineTo(938, 856); ctx.lineTo(320, 856); ctx.lineTo(320, 250); ctx.closePath();
  ctx.clip();
  ctx.fillStyle = theme.panel;
  ctx.fillRect(320, 184, 684, 672);
  if (photo) {
    const fullBody = photoFit === "contain";
    const scale = fullBody ? Math.min(660 / photo.naturalWidth, 540 / photo.naturalHeight) : Math.max(684 / photo.naturalWidth, 672 / photo.naturalHeight);
    const width = photo.naturalWidth * scale;
    const height = photo.naturalHeight * scale;
    ctx.drawImage(photo, 320 + (684 - width) / 2, fullBody ? 196 + (540 - height) / 2 : 184 + (672 - height) * 0.3, width, height);
  } else {
    ctx.fillStyle = `${theme.accent}16`;
    ctx.beginPath(); ctx.arc(685, 411, 126, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(685, 796, 252, 229, 0, 0, Math.PI * 2); ctx.fill();
    text(Array.from(data.name.trim())[0] || "A", 685, 418, 138, theme.accent, 240, "center", 900);
  }
  const sideFade = ctx.createLinearGradient(320, 0, 580, 0);
  sideFade.addColorStop(0, theme.background); sideFade.addColorStop(1, `${theme.background}00`);
  ctx.fillStyle = sideFade; ctx.fillRect(320, 184, 684, 672);
  const fadeTop = photoFit === "contain" ? 748 : 570;
  const bottomFade = ctx.createLinearGradient(0, fadeTop, 0, 856);
  bottomFade.addColorStop(0, `${theme.background}00`); bottomFade.addColorStop(1, theme.background);
  ctx.fillStyle = bottomFade; ctx.fillRect(320, fadeTop, 684, 856 - fadeTop);
  ctx.restore();
  line(386, 184, 1004, 184, `${theme.accent}b3`, 3);
  line(1004, 184, 1004, 328, `${theme.accent}b3`, 3);

  text("ARENA FC", 76, 96, 44, "#ffffff", 560, "left", 900);
  text("PLAYER CARD", 1004, 88, 21, theme.accent, 310, "right", 800);
  text("ALL-TIME RECORD", 1004, 118, 15, theme.muted, 310, "right", 500);
  line(76, 144, 1004, 144, `${theme.accent}40`);
  text(data.position, 76, 250, 30, theme.accent, 240, "left", 800);
  text(data.number === null ? "—" : String(data.number).padStart(2, "0"), 64, 382, 168, "#ffffff", 244, "left", 900);
  text("SQUAD NUMBER", 78, 488, 17, theme.muted, 218, "left", 600);
  ctx.fillStyle = theme.accent; ctx.fillRect(78, 559, 4, 86);
  text("PLAY", 100, 582, 28, "#ffffff", 200, "left", 900);
  text("TOGETHER.", 100, 623, 28, "#ffffff", 200, "left", 900);
  text(data.name, 76, 782, 88, "#ffffff", 928, "left", 900);
  text(data.nickname || "함께 뛰는 시간, 하나가 되는 ARENA FC", 80, 852, 27, theme.muted, 920, "left", 500);

  const metrics = [
    { label: "득점", value: String(data.goals) }, { label: "도움", value: String(data.assists) }, { label: "MOM", value: String(data.mvpCount) },
    { label: "출전 경기", value: String(data.totalMatches) }, { label: "승률", value: `${data.winRate.toFixed(1)}%` }, { label: "공격 포인트", value: String(data.attackPoints) }
  ];
  metrics.forEach((metric, index) => {
    const x = 76 + (index % 3) * 314;
    const y = 912 + Math.floor(index / 3) * 144;
    ctx.fillStyle = theme.panel;
    ctx.fillRect(x, y, 300, 128);
    line(x, y, x + 300, y, `${theme.accent}35`);
    text(metric.value, x + 150, y + 48, 62, index < 3 ? theme.accent : "#ffffff", 266, "center", 900);
    text(metric.label, x + 150, y + 101, 25, theme.muted, 260, "center", 600);
  });

  ctx.fillStyle = theme.panel; ctx.fillRect(76, 1221, 928, 8);
  if (data.totalMatches > 0) {
    const winWidth = 928 * data.wins / data.totalMatches;
    ctx.fillStyle = theme.accent; ctx.fillRect(76, 1221, winWidth, 8);
    ctx.fillStyle = theme.muted; ctx.fillRect(76 + winWidth, 1221, 928 * data.draws / data.totalMatches, 8);
  }
  text(`${data.wins}승  ${data.draws}무  ${data.losses}패`, 76, 1265, 30, "#ffffff", 550, "left", 800);
  text("득점 + 도움 = 공격 포인트", 1004, 1265, 21, theme.muted, 390, "right", 500);
  text(data.periodLabel, 76, 1321, 23, theme.muted, 928, "left", 500);
  line(76, 1356, 1004, 1356, `${theme.accent}35`);
  text("완료된 경기 · 통산 기록", 76, 1383, 20, theme.muted, 650, "left", 500);
  text("ARENA FC / MEMBER", 1004, 1383, 20, theme.accent, 300, "right", 800);
}
