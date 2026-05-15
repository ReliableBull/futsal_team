import Link from "next/link";
import { RankingTable } from "@/components/RankingTable";
import { formatDate, getDashboardData, getWinnerLabel } from "@/lib/stats";

export default async function HomePage() {
  const { recentMatches, goalRankings, mvpRankings, winRateRankings } = await getDashboardData();

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-arena-line bg-[radial-gradient(circle_at_top_right,#1e3a5f,transparent_36%),#101827] p-6 shadow-2xl shadow-black/30 md:p-8">
        <p className="text-sm font-bold uppercase text-arena-lime">Local MVP</p>
        <h1 className="mt-2 text-4xl font-black text-white md:text-5xl">ARENA Futsal Record</h1>
        <p className="mt-3 max-w-2xl text-slate-300">
          동호회 풋살 경기 결과, 선수별 기록, 랭킹을 빠르게 확인하는 로컬 테스트용 기록 서비스입니다.
        </p>
      </section>

      <section className="rounded-lg border border-arena-line bg-arena-panel p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-white">최근 경기 결과</h2>
          <Link href="/matches" className="text-sm font-bold text-arena-cyan hover:text-white">
            전체 보기
          </Link>
        </div>
        <div className="mt-4 grid gap-3">
          {recentMatches.map((match) => (
            <Link key={match.id} href={`/matches/${match.id}`} className="grid gap-2 rounded-md border border-arena-line bg-black/20 p-4 transition hover:border-arena-cyan md:grid-cols-[140px_1fr_auto] md:items-center">
              <span className="text-sm text-slate-400">{formatDate(match.matchDate)}</span>
              <span className="font-bold text-white">
                {match.teamAName} {match.teamAScore} : {match.teamBScore} {match.teamBName}
              </span>
              <span className="text-sm text-slate-300">
                승리팀: {getWinnerLabel(match)} · 회장팀 MVP: {match.chairmanTeamMvp?.name ?? "-"} · 총무팀 MVP:{" "}
                {match.managerTeamMvp?.name ?? "-"}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <RankingTable title="득점 랭킹 TOP 5" players={goalRankings} valueKey="goals" suffix="골" />
        <RankingTable title="MVP 랭킹 TOP 5" players={mvpRankings} valueKey="mvpCount" suffix="회" />
        <RankingTable title="승률 랭킹 TOP 5" players={winRateRankings} valueKey="winRate" suffix="%" />
      </div>
    </div>
  );
}
