import type { PlayerCardData } from "./player-card";
import type { PlayerCardPhotoFit } from "./player-card-photos";

type CardDesign = "editorial" | "noir" | "archive";
const sans = '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
const narrow = '"Arial Narrow", Arial, sans-serif';
const light = '"Helvetica Neue", Arial, sans-serif';
const serif = 'Georgia, "Times New Roman", serif';

// Process the pixels directly so monochrome/sepia exports also work on browsers
// without CanvasRenderingContext2D.filter. The original profile photo is untouched.
function tintPortrait(photo: HTMLImageElement, design: CardDesign): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1080 / Math.max(photo.naturalWidth, photo.naturalHeight));
  canvas.width = Math.max(1, Math.round(photo.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(photo.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("프로필 사진을 처리할 수 없습니다.");
  context.drawImage(photo, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const rgba = pixels.data;
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    if (design === "archive") {
      const red = r * 0.65 + Math.min(255, r * 0.393 + g * 0.769 + b * 0.189) * 0.35;
      const green = g * 0.65 + Math.min(255, r * 0.349 + g * 0.686 + b * 0.168) * 0.35;
      const blue = b * 0.65 + Math.min(255, r * 0.272 + g * 0.534 + b * 0.131) * 0.35;
      const gray = red * 0.2126 + green * 0.7152 + blue * 0.0722;
      rgba[i] = (gray + (red - gray) * 0.6 - 128) * 0.95 + 128;
      rgba[i + 1] = (gray + (green - gray) * 0.6 - 128) * 0.95 + 128;
      rgba[i + 2] = (gray + (blue - gray) * 0.6 - 128) * 0.95 + 128;
    } else {
      const gray = r * 0.2126 + g * 0.7152 + b * 0.0722;
      const value = design === "noir" ? (gray * 0.72 - 128) * 1.15 + 128 : (gray - 128) * 1.08 + 128;
      rgba[i] = rgba[i + 1] = rgba[i + 2] = value;
    }
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

/** The approved 540 × 720 layouts are drawn at double resolution for PNG export. */
export function drawPlayerCardDesign(ctx: CanvasRenderingContext2D, data: PlayerCardData, design: CardDesign, photo: HTMLImageElement | null, photoFit: PlayerCardPhotoFit = "cover") {
  const portrait = photo ? tintPortrait(photo, design) : null;
  const number = data.number === null ? "—" : String(data.number).padStart(2, "0");
  const record = `${data.wins}승 ${data.draws}무 ${data.losses}패`;
  const metrics = [
    [String(data.goals), "득점"], [String(data.assists), "도움"], [String(data.mvpCount), "MOM"],
    [String(data.totalMatches), "출전"], [`${data.winRate.toFixed(1)}%`, "승률"], [String(data.attackPoints), "공격 포인트"]
  ];

  function text(value: string, x: number, y: number, size: number, color: string, width: number, options: { font?: string; weight?: number; align?: CanvasTextAlign; italic?: boolean } = {}) {
    const setFont = (fontSize: number) => { ctx.font = `${options.italic ? "italic " : ""}${options.weight ?? 500} ${fontSize}px ${options.font ?? sans}`; };
    let fontSize = size;
    let output = value.replace(/\s+/g, " ").trim();
    setFont(fontSize);
    while (ctx.measureText(output).width > width && fontSize > size * 0.65) setFont(--fontSize);
    const chars = Array.from(output);
    while (ctx.measureText(output).width > width && chars.length) { chars.pop(); output = `${chars.join("")}…`; }
    ctx.fillStyle = color;
    ctx.textAlign = options.align ?? "left";
    ctx.textBaseline = "middle";
    ctx.fillText(output, x, y);
  }
  function rect(x: number, y: number, width: number, height: number, color: string) {
    ctx.fillStyle = color; ctx.fillRect(x, y, width, height);
  }
  function line(x: number, y: number, endX: number, endY: number, color: string, width = 1) {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(endX, endY); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  function portraitAt(x: number, y: number, width: number, height: number, color: string, accent: string, vertical = 0.36) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, width, height); ctx.clip();
    rect(x, y, width, height, color);
    if (portrait) {
      const fullBody = photoFit === "contain";
      const top = fullBody ? (design === "noir" ? 76 : y + 12) : y;
      const availableHeight = fullBody ? (design === "noir" ? 296 : height - 24) : height;
      const scale = fullBody ? Math.min((width - 24) / portrait.width, availableHeight / portrait.height) : Math.max(width / portrait.width, height / portrait.height);
      const w = portrait.width * scale, h = portrait.height * scale;
      ctx.drawImage(portrait, x + (width - w) * (fullBody ? 0.5 : 0.56), top + (availableHeight - h) * (fullBody ? 0.5 : vertical), w, h);
    } else {
      ctx.fillStyle = `${accent}28`;
      ctx.beginPath(); ctx.arc(x + width / 2, y + height * 0.36, width * 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + width / 2, y + height * 0.91, width * 0.4, height * 0.33, 0, 0, Math.PI * 2); ctx.fill();
      text(Array.from(data.name.trim())[0] || "A", x + width / 2, y + height * 0.36, width * 0.23, accent, width * 0.45, { align: "center", weight: 800 });
    }
    ctx.restore();
  }
  function statistics(x: number, y: number, width: number, rowGap: number, size: number, color: string, muted: string, font: string, centered: boolean, weight = 400) {
    metrics.forEach(([value, label], index) => {
      const col = index % 3, row = Math.floor(index / 3);
      const cellWidth = width / 3;
      const left = x + col * cellWidth + (centered ? cellWidth / 2 : col === 0 ? 0 : 18);
      const top = y + row * rowGap;
      const align = centered ? "center" : "left";
      text(value, left, top, size, color, cellWidth - 24, { font, align, weight });
      text(label, left, top + 27, 10, muted, cellWidth - 24, { align });
    });
  }

  ctx.save();
  ctx.scale(2, 2);
  try {
    if (design === "editorial") {
      const ink = "#20221f", muted = "#77796d";
      rect(0, 0, 540, 720, "#f3f0e8");
      text("ARENA FC", 30, 38, 22, ink, 230, { weight: 900, font: narrow });
      text("THE PLAYER SERIES", 510, 33, 8, muted, 200, { font: "monospace", align: "right" });
      text("ALL-TIME RECORD", 510, 46, 8, muted, 200, { font: "monospace", align: "right" });
      line(30, 65, 510, 65, ink);
      text("ARENA", 24, 134, 125, ink, 486, { font: 'Impact, "Arial Narrow", sans-serif', weight: 900 });
      portraitAt(246, 92, 264, 326, "#dedbd1", "#77796d");
      ctx.strokeStyle = "#ffffff8a"; ctx.lineWidth = 1; ctx.strokeRect(420, 106, 76, 24);
      text(`PLAYER / ${number}`, 458, 118, 9, "#ffffff", 64, { align: "center" });
      text(number, 30, 262, 89, ink, 190, { font: light, weight: 500 });
      text("SQUAD NUMBER", 31, 310, 8, muted, 180, { font: "monospace" });
      rect(31, 362, 7, 7, "#d53c27");
      text(data.position, 46, 366, 12, ink, 184, { weight: 600 });
      text(data.name, 27, 444, 57, ink, 304, { weight: 900 });
      text("ARENA FOOTBALL CLUB", 510, 432, 9, ink, 157, { align: "right" });
      text(record, 510, 450, 10, ink, 157, { align: "right" });
      line(30, 483, 510, 483, ink);
      statistics(30, 521, 480, 73, 36, ink, muted, narrow, false);
      for (const x of [190, 350]) for (const y of [502, 575]) line(x, y, x, y + 48, "#d1d0c7");
      text(data.periodLabel, 30, 652, 9, muted, 480);
      line(30, 670, 510, 670, "#cacabe");
      text("완료된 경기 · 통산 기록", 30, 690, 9, ink, 255);
      text("PLAY TOGETHER. ↗", 510, 690, 9, "#b63020", 206, { font: "monospace", align: "right" });
    } else if (design === "noir") {
      const ink = "#e4e2d9", muted = "#a4a99d";
      rect(0, 0, 540, 720, "#141615");
      portraitAt(0, 0, 540, 530, "#242a25", "#c5c5ba");
      const fade = ctx.createLinearGradient(0, 0, 0, 530);
      if (photoFit === "contain") {
        fade.addColorStop(0, "#14161500"); fade.addColorStop(0.71, "#14161500"); fade.addColorStop(0.98, "#141615");
      } else {
        fade.addColorStop(0, "#14161580"); fade.addColorStop(0.25, "#14161500"); fade.addColorStop(0.52, "#14161520"); fade.addColorStop(0.98, "#141615");
      }
      ctx.fillStyle = fade; ctx.fillRect(0, 0, 540, 530);
      ctx.strokeStyle = "#d4d3c82a"; ctx.lineWidth = 1; ctx.strokeRect(19, 19, 502, 682);
      text("ARENA", 35, 49, 25, ink, 220, { font: serif });
      text("SIGNATURE COLLECTION", 505, 49, 8, "#cbc7b3", 220, { align: "right", font: "monospace" });
      text(number, 35, 132, 62, ink, 190, { font: light, weight: 200 });
      text("SQUAD NO.", 37, 175, 8, "#c5c5ba", 160, { font: "monospace" });
      ctx.save(); ctx.translate(503, 122); ctx.rotate(Math.PI / 2);
      text("ARENA FOOTBALL CLUB / PLAYER PORTRAIT", 0, 0, 8, "#c2c3b7", 330, { font: "monospace" }); ctx.restore();
      text("THE PLAYER", 270, 385, 9, "#cbc7b3", 440, { align: "center", font: "monospace" });
      text(data.name, 270, 429, 48, ink, 442, { align: "center", weight: 500 });
      text(`${data.position} · ${record}`, 270, 474, 11, muted, 442, { align: "center" });
      line(39, 510, 501, 510, "#c8c9bb35");
      statistics(39, 547, 462, 68, 34, ink, muted, light, true, 300);
      for (const x of [193, 347]) for (const y of [530, 598]) line(x, y, x, y + 43, "#c8c9bb24");
      text(data.periodLabel, 270, 660, 9, muted, 450, { align: "center" });
      line(39, 688, 60, 688, "#aea889");
      text("완료된 경기 · 통산 기록", 69, 688, 9, muted, 260);
      text(`ARENA FC / ${number}`, 501, 688, 9, muted, 140, { align: "right" });
    } else {
      const cream = "#f2f0dc", muted = "#c5d2b4";
      rect(0, 0, 540, 720, "#123f35");
      ctx.strokeStyle = "#e8e8ce5a"; ctx.lineWidth = 1; ctx.strokeRect(15, 15, 510, 690);
      text("ARENA FC", 30, 42, 21, cream, 260, { weight: 900 });
      text(`PLAYER ARCHIVE / ${number}`, 510, 42, 8, muted, 204, { align: "right", font: "monospace" });
      line(30, 67, 510, 67, "#ebe5ca70");
      // Arched portrait frame, matching the approved club-ticket mockup.
      const arch = (x: number, y: number, width: number, height: number) => {
        ctx.beginPath(); ctx.moveTo(x, y + height); ctx.lineTo(x, y + width / 2);
        ctx.arc(x + width / 2, y + width / 2, width / 2, Math.PI, Math.PI * 2);
        ctx.lineTo(x + width, y + height); ctx.closePath();
      };
      ctx.save(); arch(256, 99, 250, 293); ctx.clip();
      portraitAt(256, 99, 250, 293, "#d9d9b6", "#123f35", 0.5); ctx.restore();
      arch(256, 99, 250, 293); ctx.strokeStyle = "#e7e4c8"; ctx.lineWidth = 5; ctx.stroke();
      text("The", 32, 126, 61, cream, 220, { font: serif });
      text("Players.", 32, 182, 61, cream, 249, { font: serif, italic: true });
      text(number, 33, 299, 103, "#dbec9b", 205, { font: serif });
      text("ONE TEAM. ONE CLUB.", 35, 359, 8, muted, 210, { font: "monospace" });
      ctx.save(); ctx.translate(270, 449); ctx.rotate(-2 * Math.PI / 180);
      rect(-292, -34, 584, 68, "#e9ead5");
      text(data.name, -236, 0, 36, "#143d32", 300, { weight: 800 });
      text(data.position, 236, -9, 10, "#143d32", 138, { align: "right" });
      text(record, 236, 10, 10, "#143d32", 138, { align: "right" }); ctx.restore();
      statistics(35, 529, 470, 68, 32, cream, muted, serif, true);
      text(data.periodLabel, 270, 642, 9, muted, 468, { align: "center" });
      ctx.setLineDash([3, 3]); line(0, 659, 540, 659, "#ccdbc05c"); ctx.setLineDash([]);
      // The ticket notches are transparent in the exported PNG.
      ctx.save(); ctx.globalCompositeOperation = "destination-out";
      for (const x of [0, 540]) { ctx.beginPath(); ctx.arc(x, 659, 9, 0, Math.PI * 2); ctx.fill(); } ctx.restore();
      text("완료된 경기 · 통산 기록", 35, 687, 9, muted, 195);
      for (let x = 255; x < 329; x += 12) { rect(x, 680, 1, 14, "#d0dabc"); rect(x + 3, 680, 2, 14, "#d0dabc"); rect(x + 7, 680, 1, 14, "#d0dabc"); }
      text(`ARENA / ${number}`, 505, 687, 9, muted, 140, { align: "right" });
    }
  } finally { ctx.restore(); }
}
