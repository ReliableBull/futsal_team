import Link from "next/link";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { getDateRange, getMatchDateWhere } from "@/lib/date-range";
import { WinnerBadge } from "@/components/WinnerBadge";
import { prisma } from "@/lib/prisma";
import { formatDate, getTeamMvpNames, matchStatus } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function MatchesPage({ searchParams }: { searchParams: { startDate?: string; endDate?: string } }) {
  const dateRange = getDateRange(searchParams);
  const matches = await prisma.match.findMany({
    where: { matchDate: getMatchDateWhere(dateRange) },
    include: { matchPlayers: { include: { player: true } } },
    orderBy: { matchDate: "desc" }
  });

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-bold uppercase text-arena-lime">Matches</p>
        <h1 className="text-3xl font-black text-white">경기 목록</h1>
        <p className="mt-2 text-sm text-slate-400">
          조회 기간: {dateRange.startDate} ~ {dateRange.endDate}
        </p>
      </div>

      <DateRangeFilter actionPath="/matches" range={dateRange} />

      <div className="grid gap-3">
        {matches.length > 0 ? (
          matches.map((match) => (
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
              {match.teamAName} MVP: {getTeamMvpNames(match.matchPlayers, match.teamAName)} · {match.teamBName} MVP:{" "}
              {getTeamMvpNames(match.matchPlayers, match.teamBName)}
            </span>
          </Link>
          ))
        ) : (
          <p className="rounded-lg border border-arena-line bg-arena-panel p-5 text-sm text-slate-400">선택한 기간에 등록된 경기가 없습니다.</p>
        )}
      </div>
    </div>
  );
}
