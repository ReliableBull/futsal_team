import Image from "next/image";
import Link from "next/link";
import type { Match, MatchPlayer, Player } from "@prisma/client";
import { WinnerBadge } from "@/components/WinnerBadge";
import { formatDate, getMatchStatusLabel, getTeamMvpNames, matchStatus } from "@/lib/stats";

type HeroMatch = Pick<
  Match,
  "id" | "status" | "matchDate" | "location" | "teamAName" | "teamBName" | "teamAScore" | "teamBScore" | "winnerTeam"
> & {
  matchPlayers: Array<Pick<MatchPlayer, "teamName" | "isMvp"> & { player: Pick<Player, "name"> }>;
};

export function TeamHeroSection({ latestMatch }: { latestMatch?: HeroMatch }) {
  return (
    <section className="arena-dark overflow-hidden border border-arena-line bg-arena-panel shadow-2xl shadow-black/20">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="group relative min-h-[300px] overflow-hidden sm:min-h-[380px] lg:min-h-[440px]">
          <Image
            fill
            alt="ARENA FC team group photo"
            className="object-cover object-center transition duration-700 group-hover:scale-[1.015]"
            priority
            sizes="(max-width: 1024px) 100vw, 1050px"
            src="/images/arena-team.jpg"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,6,7,0.88),rgba(5,6,7,0.28)_55%,rgba(5,6,7,0.08)),linear-gradient(0deg,rgba(5,6,7,0.88),transparent_55%)]" />

          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 lg:p-10">
            <p className="flex items-center gap-2 text-xs font-black uppercase text-arena-red sm:text-sm">
              <span className="h-0.5 w-8 bg-arena-red" />
              Official Team Record
            </p>
            <h1 className="mt-2 text-4xl font-black italic text-white sm:text-6xl lg:text-7xl">ARENA FC</h1>
            <p className="mt-2 max-w-lg text-sm font-semibold text-slate-200 sm:text-base">함께 뛰는 순간, 하나가 되는 우리 팀의 경기 기록</p>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold uppercase text-slate-300 sm:text-sm">
              <span><strong className="text-white">2026</strong> Season</span>
              <span><strong className="text-white">Weekly</strong> Match</span>
              <span><strong className="text-white">Live</strong> Team Stats</span>
            </div>
          </div>
        </div>

        <div className="relative flex min-h-[310px] flex-col border-t border-arena-line bg-[#0c0e10] p-5 lg:min-h-0 lg:border-l lg:border-t-0 lg:p-7">
          <div className="absolute inset-x-0 top-0 h-1 bg-arena-red" />
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-arena-red">Latest Match</p>
              <h2 className="mt-1 text-lg font-black text-white">최신 경기 결과</h2>
            </div>
            {latestMatch ? <span className="text-xs font-bold text-slate-500">{formatDate(latestMatch.matchDate)}</span> : null}
          </div>

          {latestMatch ? (
            <>
              <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-white sm:text-base">{latestMatch.teamAName}</p>
                  <p className="mt-2 text-5xl font-black text-white">{latestMatch.teamAScore}</p>
                </div>
                <span className="text-2xl font-black text-slate-600">:</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-white sm:text-base">{latestMatch.teamBName}</p>
                  <p className="mt-2 text-5xl font-black text-white">{latestMatch.teamBScore}</p>
                </div>
              </div>

              <div className="mt-5 flex justify-center">
                {latestMatch.status === matchStatus.completed ? (
                  <WinnerBadge match={latestMatch} />
                ) : (
                  <span className="border border-arena-red bg-arena-red/10 px-3 py-1 text-xs font-black text-arena-red">{getMatchStatusLabel(latestMatch.status)}</span>
                )}
              </div>

              <dl className="mt-6 grid gap-3 border-y border-arena-line py-4 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <dt className="font-bold text-slate-500">장소</dt>
                  <dd className="text-right font-bold text-slate-200">{latestMatch.location}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="font-bold text-slate-500">{latestMatch.teamAName} MOM</dt>
                  <dd className="text-right font-black text-white">{getTeamMvpNames(latestMatch.matchPlayers, latestMatch.teamAName)}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="font-bold text-slate-500">{latestMatch.teamBName} MOM</dt>
                  <dd className="text-right font-black text-white">{getTeamMvpNames(latestMatch.matchPlayers, latestMatch.teamBName)}</dd>
                </div>
              </dl>

              <Link className="mt-auto flex items-center justify-between pt-5 text-sm font-black text-slate-300 transition hover:text-arena-red" href={`/matches/${latestMatch.id}`}>
                경기 상세 기록
                <span aria-hidden>→</span>
              </Link>
            </>
          ) : (
            <p className="my-auto text-center text-sm font-semibold text-slate-500">등록된 경기 결과가 없습니다.</p>
          )}
        </div>
      </div>
    </section>
  );
}
