import type { Match } from "@prisma/client";
import { getWinnerLabel } from "@/lib/stats";

function getWinnerTone(winnerLabel: string) {
  if (winnerLabel === "무승부") {
    return "border-slate-500/50 bg-slate-500/15 text-slate-200";
  }

  if (winnerLabel.includes("총무") || winnerLabel.includes("전회장")) {
    return "border-arena-cyan/50 bg-arena-cyan/15 text-arena-cyan";
  }

  return "border-arena-lime/50 bg-arena-lime/15 text-arena-lime";
}

export function WinnerBadge({ match }: { match: Pick<Match, "winnerTeam"> }) {
  const winnerLabel = getWinnerLabel(match);

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black ${getWinnerTone(winnerLabel)}`}>
      {winnerLabel}
    </span>
  );
}
