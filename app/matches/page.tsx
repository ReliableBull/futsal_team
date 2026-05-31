import Link from "next/link";
import { WinnerBadge } from "@/components/WinnerBadge";
import { prisma } from "@/lib/prisma";
import { formatDate, matchStatus } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  const matches = await prisma.match.findMany({
    include: { chairmanTeamMvp: true, managerTeamMvp: true },
    orderBy: { matchDate: "desc" }
  });

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-bold uppercase text-arena-lime">Matches</p>
        <h1 className="text-3xl font-black text-white">경기 목록</h1>
      </div>
      <div className="grid gap-3">
        {matches.map((match) => (
          <Link key={match.id} href={`/matches/${match.id}`} className="grid gap-2 rounded-lg border border-arena-line bg-arena-panel p-4 transition hover:border-arena-cyan md:grid-cols-[140px_1fr_150px_1fr] md:items-center">
            <span className="text-sm text-slate-400">{formatDate(match.matchDate)}</span>
            <span className="text-lg font-black text-white">
              {match.teamAName} {match.teamAScore} : {match.teamBScore} {match.teamBName}
            </span>
            <span className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
              <span>승리팀:</span>
              {match.status === matchStatus.completed ? <WinnerBadge match={match} /> : <span className="font-bold text-white">-</span>}
            </span>
            <span className="text-sm text-slate-300">
              {match.teamAName} MVP: {match.chairmanTeamMvp?.name ?? "-"} · {match.teamBName} MVP: {match.managerTeamMvp?.name ?? "-"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
