import { getDashboardData } from "@/lib/stats-data";
import { PlatformHome } from "@/components/PlatformHome";
import { getCurrentTeam, getTeamBasePath, isLegacyMode } from "@/lib/teams";
import Link from "@/components/TeamLink";
import { MatchPosterGallery } from "@/components/MatchPosterGallery";
import { RankingTable } from "@/components/RankingTable";
import { TeamHeroSection } from "@/components/TeamHeroSection";
import { WeeklyWeatherCard } from "@/components/WeeklyWeatherCard";
import { WinnerBadge } from "@/components/WinnerBadge";
import { formatDate, matchStatus } from "@/lib/stats";
import { getWeeklyWeather } from "@/lib/weather";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!isLegacyMode() && !getTeamBasePath()) return <PlatformHome />;
  const team = await getCurrentTeam();
  const [
    {
      recentMatches,
      goalRankings,
      assistRankings,
      mvpRankings,
      winRateRankings,
      winStreakRankings,
      goalStreakRankings,
      assistStreakRankings,
      posters
    },
    weeklyWeather
  ] = await Promise.all([getDashboardData(), team.slug === "arena-fc" ? getWeeklyWeather() : Promise.resolve(null)]);

  return (
    <div className="space-y-4 sm:space-y-5">
      <TeamHeroSection latestMatch={recentMatches[0]} team={team} />

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-[1.45fr_repeat(4,minmax(0,1fr))]">
        <section className="border border-arena-line bg-arena-panel shadow-xl shadow-black/20 lg:col-span-2 xl:col-span-1">
          <div className="flex min-h-14 items-center justify-between gap-3 border-b-2 border-b-arena-red px-4">
            <h2 className="text-base font-black text-white">최근 경기</h2>
            <Link href="/matches" className="text-xs font-black text-slate-500 transition hover:text-white">
              전체 보기 →
            </Link>
          </div>

          <div className="divide-y divide-arena-line">
            {recentMatches.map((match) => (
              <Link
                key={match.id}
                href={`/matches/${match.id}`}
                className="grid min-h-[72px] grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 transition hover:bg-white/[0.025]"
              >
                <div>
                  <p className="text-[11px] font-bold text-slate-500">{formatDate(match.matchDate)}</p>
                  <div className="mt-1">
                    {match.status === matchStatus.completed ? (
                      <WinnerBadge match={match} />
                    ) : (
                      <span className="text-[10px] font-black text-arena-red">진행중</span>
                    )}
                  </div>
                </div>
                <div className="min-w-0 text-xs font-black text-slate-200">
                  <p className="truncate">{match.teamAName}</p>
                  <p className="mt-1 truncate text-slate-500">{match.teamBName}</p>
                </div>
                <div className="border-l border-arena-line pl-3 text-right text-lg font-black leading-6 text-white">
                  <p>{match.teamAScore}</p>
                  <p className="text-slate-500">{match.teamBScore}</p>
                </div>
              </Link>
            ))}
            {recentMatches.length === 0 ? <p className="p-5 text-sm text-slate-500">등록된 경기가 없습니다.</p> : null}
          </div>
        </section>

        <RankingTable title="승률 랭킹" players={winRateRankings} valueKey="winRate" suffix="%" />
        <RankingTable title="MOM 랭킹" players={mvpRankings} valueKey="mvpCount" suffix="회" />
        <RankingTable title="득점 랭킹" players={goalRankings} valueKey="goals" suffix="골" />
        <RankingTable title="도움 랭킹" players={assistRankings} valueKey="assists" suffix="개" />
      </div>

      <section>
        <div className="mb-3 flex items-end justify-between gap-4 border-b border-arena-line pb-3">
          <div>
            <p className="text-xs font-black uppercase text-arena-red">Current Streaks</p>
            <h2 className="mt-1 text-xl font-black text-white">최근 흐름</h2>
          </div>
          <p className="hidden text-xs font-bold text-slate-500 sm:block">최근 출전 경기부터 이어진 기록</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <RankingTable title="최근 연승 TOP 5" players={winStreakRankings} valueKey="currentWinStreak" suffix="연승" />
          <RankingTable title="연속 경기 득점 TOP 5" players={goalStreakRankings} valueKey="currentGoalStreak" suffix="경기" />
          <RankingTable title="연속 경기 도움 TOP 5" players={assistStreakRankings} valueKey="currentAssistStreak" suffix="경기" />
        </div>
      </section>

      <MatchPosterGallery posters={posters} />
      {weeklyWeather && <WeeklyWeatherCard weather={weeklyWeather} />}
    </div>
  );
}
