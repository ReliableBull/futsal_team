import Link from "next/link";
import { RankingTable } from "@/components/RankingTable";
import { TeamHeroSection } from "@/components/TeamHeroSection";
import { WeeklyWeatherCard } from "@/components/WeeklyWeatherCard";
import { WinnerBadge } from "@/components/WinnerBadge";
import { formatDate, getDashboardData, getTeamMvpNames, matchStatus } from "@/lib/stats";
import { getWeeklyWeather } from "@/lib/weather";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [{ recentMatches, goalRankings, mvpRankings, winRateRankings }, weeklyWeather] = await Promise.all([getDashboardData(), getWeeklyWeather()]);

  return (
    <div className="space-y-8">
      <TeamHeroSection />

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
              <span className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
                <span>승리팀:</span>
                {match.status === matchStatus.completed ? <WinnerBadge match={match} /> : <span className="font-bold text-white">-</span>}
                <span className="text-slate-500">·</span>
                <span className="font-semibold text-slate-400">{match.teamAName} MVP</span>
                <span className="font-black text-arena-lime">{getTeamMvpNames(match.matchPlayers, match.teamAName)}</span>
                <span className="text-slate-500">·</span>
                <span className="font-semibold text-slate-400">{match.teamBName} MVP</span>
                <span className="font-black text-arena-cyan">{getTeamMvpNames(match.matchPlayers, match.teamBName)}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <RankingTable title="승률 랭킹 TOP 5" players={winRateRankings} valueKey="winRate" suffix="%" />
        <RankingTable title="MVP 랭킹 TOP 5" players={mvpRankings} valueKey="mvpCount" suffix="회" />
        <RankingTable title="득점 랭킹 TOP 5" players={goalRankings} valueKey="goals" suffix="골" />
      </div>

      <WeeklyWeatherCard weather={weeklyWeather} />
    </div>
  );
}
