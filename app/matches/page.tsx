import Link from "next/link";
import { MatchStatusBadge } from "@/components/MatchStatusBadge";
import { WinnerBadge } from "@/components/WinnerBadge";
import { prisma } from "@/lib/prisma";
import { formatDate, matchStatus } from "@/lib/stats";

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
              <MatchStatusBadge status={match.status} />
              {match.status === matchStatus.completed ? (
                <>
                  <span>승리팀:</span>
                  <WinnerBadge match={match} />
                </>
              ) : null}
            </span>
            <span className="text-sm text-slate-300">
              회장팀 MVP: {match.chairmanTeamMvp?.name ?? "-"} · 총무팀 MVP: {match.managerTeamMvp?.name ?? "-"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
