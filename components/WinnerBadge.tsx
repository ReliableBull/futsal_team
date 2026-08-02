import type { Match } from "@prisma/client";
import { getWinnerLabel } from "@/lib/stats";

function getWinnerTone(winnerLabel: string) {
  if (winnerLabel === "무승부") {
    return "border-slate-600 bg-slate-700/40 text-slate-200";
  }

  return "border-arena-green/60 bg-arena-green/10 text-arena-green";
}

export function WinnerBadge({ match }: { match: Pick<Match, "winnerTeam"> }) {
  const winnerLabel = getWinnerLabel(match);

  return (
    <span className={`inline-flex items-center border px-2.5 py-1 text-xs font-black ${getWinnerTone(winnerLabel)}`}>
      {winnerLabel}
    </span>
  );
}
