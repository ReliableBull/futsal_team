import Link from "next/link";
import { MatchPosterGallery } from "@/components/MatchPosterGallery";
import { RankingTable } from "@/components/RankingTable";
import { TeamHeroSection } from "@/components/TeamHeroSection";
import { WeeklyWeatherCard } from "@/components/WeeklyWeatherCard";
import { WinnerBadge } from "@/components/WinnerBadge";
import { formatDate, getDashboardData, getTeamMvpNames, matchStatus } from "@/lib/stats";
import { getWeeklyWeather } from "@/lib/weather";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [
    { recentMatches, goalRankings, assistRankings, mvpRankings, winRateRankings, winStreakRankings, goalStreakRankings, assistStreakRankings, posters },
    weeklyWeather
  ] = await Promise.all([
    getDashboardData(),
    getWeeklyWeather()
  ]);

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
                <span className="font-semibold text-slate-400">{match.teamAName} MOM</span>
                <span className="font-black text-arena-lime">{getTeamMvpNames(match.matchPlayers, match.teamAName)}</span>
                <span className="text-slate-500">·</span>
                <span className="font-semibold text-slate-400">{match.teamBName} MOM</span>
                <span className="font-black text-arena-cyan">{getTeamMvpNames(match.matchPlayers, match.teamBName)}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-4">
        <RankingTable title="승률 랭킹 TOP 5" players={winRateRankings} valueKey="winRate" suffix="%" />
        <RankingTable title="MOM 랭킹 TOP 5" players={mvpRankings} valueKey="mvpCount" suffix="회" />
        <RankingTable title="득점 랭킹 TOP 5" players={goalRankings} valueKey="goals" suffix="골" />
        <RankingTable title="도움 랭킹 TOP 5" players={assistRankings} valueKey="assists" suffix="개" />
      </div>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white">최근 흐름</h2>
          <p className="mt-1 text-sm text-slate-400">각 선수의 최근 출전 경기부터 끊기지 않고 이어진 기록입니다.</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <RankingTable title="최근 연승 선수 TOP 5" players={winStreakRankings} valueKey="currentWinStreak" suffix="연승" />
          <RankingTable title="연속 경기 득점 TOP 5" players={goalStreakRankings} valueKey="currentGoalStreak" suffix="경기" />
          <RankingTable title="연속 경기 도움 TOP 5" players={assistStreakRankings} valueKey="currentAssistStreak" suffix="경기" />
        </div>
      </section>

      <MatchPosterGallery posters={posters} />

      <WeeklyWeatherCard weather={weeklyWeather} />
    </div>
  );
}
