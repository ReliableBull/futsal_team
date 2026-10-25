import Link from "@/components/TeamLink";
import { notFound } from "next/navigation";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { PlayerShareCard } from "@/components/PlayerShareCard";
import { buildPlayerCardData } from "@/lib/player-card";
import { StatCard } from "@/components/StatCard";
import { getDateRange, quickDateRanges } from "@/lib/date-range";
import { parsePlayerPosition } from "@/lib/player-position";
import { getTeamPrisma } from "@/lib/teams";
import { calculatePlayerStats, calculatePlayerStreakHistories, formatDate, formatPlayerRecord, getResultLabel, matchStatus, type PlayerStreakRecord, type PlayerWithStats } from "@/lib/stats";

export default async function PlayerDetailPage({ params }: { params: { id: string } }) {
  const prisma = await getTeamPrisma();
  const player = await prisma.player.findFirst({
    where: { id: Number(params.id), isActive: true },
    include: {
      matchPlayers: {
        where: { match: { status: matchStatus.completed } },
        include: { match: true },
        orderBy: { match: { matchDate: "desc" } }
      },
      scoredGoals: {
        where: { match: { status: matchStatus.completed } },
        include: { match: true, assister: { select: { id: true, name: true } } },
        orderBy: [{ match: { matchDate: "desc" } }, { sequence: "asc" }]
      },
      assistedGoals: {
        where: { match: { status: matchStatus.completed } },
        include: { match: true, scorer: { select: { id: true, name: true } } },
        orderBy: [{ match: { matchDate: "desc" } }, { sequence: "asc" }]
      }
    }
  });

  if (!player) notFound();

  const stats = calculatePlayerStats(player);
  const streakHistories = calculatePlayerStreakHistories(player.matchPlayers);
  const halfYearStats = quickDateRanges
    .filter((range) => range.label !== "전체")
    .map((range) => {
      const dateRange = getDateRange({ startDate: range.startDate, endDate: range.endDate });
      const matchPlayers = player.matchPlayers.filter((record) => {
        const matchDate = record.match.matchDate;

        return matchDate >= dateRange.start && matchDate <= dateRange.end;
      });

      return {
        label: range.label,
        period: `${range.startDate} ~ ${range.endDate}`,
        stats: calculatePlayerStats({ ...player, matchPlayers })
      };
    });
  const position = parsePlayerPosition(player.position);
  const missingGoalDetails = Math.max(0, stats.goals - player.scoredGoals.length);
  const missingAssistDetails = Math.max(0, stats.assists - player.assistedGoals.length);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-arena-line bg-arena-panel p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <PlayerAvatar playerId={player.id} name={player.name} profileImageUrl={player.profileImageUrl} size="lg" />
          <div>
            <p className="text-sm font-bold uppercase text-arena-lime">Player</p>
            <h1 className="mt-1 text-3xl font-black text-white">{player.name}</h1>
            <p className="mt-2 text-slate-300">
              {player.nickname ? `${player.nickname} · ` : ""}
              {position} · 등번호 {player.number ?? "-"}
            </p>
            <Link href={`/chemistry?playerId=${player.id}`} className="mt-3 inline-flex rounded-md border border-arena-line bg-white px-3 py-2 text-sm font-bold text-arena-cyan hover:border-arena-cyan">
              동료·상대 전적 분석 →
            </Link>
          </div>
        </div>
      </section>

      <PlayerShareCard data={buildPlayerCardData({ ...stats, position }, player.matchPlayers.map((record) => record.match.matchDate))} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="출장 경기 수" value={stats.totalMatches} detail={formatPlayerRecord(stats)} />
        <StatCard label="승률" value={`${stats.winRate}%`} />
        <StatCard label="득점" value={stats.goals} detail="도움을 준 선수 확인" href="#goal-details" />
        <StatCard label="도움" value={stats.assists} detail="도움을 받은 득점자 확인" href="#assist-details" />
        <StatCard label="MOM" value={stats.mvpCount} detail="선정 횟수" />
      </div>

      <section>
        <div className="mb-4">
          <p className="text-sm font-black uppercase text-arena-red">Goal Connections</p>
          <h2 className="mt-1 text-xl font-black text-white">득점·도움 연결 기록</h2>
          <p className="mt-1 text-sm text-slate-400">각 골의 득점자와 도움자를 경기별로 확인할 수 있습니다.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <article id="goal-details" className="scroll-mt-24 rounded-lg border border-arena-line bg-arena-panel p-5 shadow-lg shadow-slate-200/50">
            <div className="flex items-center justify-between gap-3 border-b border-arena-line pb-3">
              <div>
                <h3 className="font-black text-white">내 득점</h3>
                <p className="mt-1 text-xs text-slate-400">내 골을 도와준 선수</p>
              </div>
              <strong className="text-2xl font-black text-arena-red">{stats.goals}</strong>
            </div>

            <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto pr-1 arena-scrollbar">
              {player.scoredGoals.map((goal) => (
                <div key={goal.id} className="grid gap-2 rounded-md border border-arena-line bg-black/20 p-3 sm:grid-cols-[100px_1fr_auto] sm:items-center">
                  <div>
                    <p className="text-xs font-bold text-slate-500">{formatDate(goal.match.matchDate)}</p>
                    <p className="mt-1 text-xs font-black text-arena-red">{goal.sequence}번째 골</p>
                  </div>
                  <Link className="text-sm font-bold text-white transition hover:text-arena-red" href={`/matches/${goal.matchId}`}>
                    {goal.match.teamAName} {goal.match.teamAScore} : {goal.match.teamBScore} {goal.match.teamBName}
                  </Link>
                  <p className="text-sm font-semibold text-slate-500 sm:text-right">
                    도움: {goal.assistKnown ? (
                      goal.assister ? (
                        <Link className="font-black text-arena-cyan hover:underline" href={`/players/${goal.assister.id}`}>
                          {goal.assister.name}
                        </Link>
                      ) : (
                        <span className="font-bold text-slate-600">없음</span>
                      )
                    ) : (
                      <span className="font-bold text-slate-500">기존 상세정보 없음</span>
                    )}
                  </p>
                </div>
              ))}
              {missingGoalDetails > 0 ? (
                <p className="rounded-md border border-dashed border-arena-line bg-black/20 p-3 text-sm text-slate-500">
                  기존 득점 {missingGoalDetails}골은 도움 연결 정보가 저장되어 있지 않습니다.
                </p>
              ) : null}
              {stats.goals === 0 ? <p className="py-6 text-center text-sm text-slate-400">등록된 득점이 없습니다.</p> : null}
            </div>
          </article>

          <article id="assist-details" className="scroll-mt-24 rounded-lg border border-arena-line bg-arena-panel p-5 shadow-lg shadow-slate-200/50">
            <div className="flex items-center justify-between gap-3 border-b border-arena-line pb-3">
              <div>
                <h3 className="font-black text-white">내 도움</h3>
                <p className="mt-1 text-xs text-slate-400">내 패스로 득점한 선수</p>
              </div>
              <strong className="text-2xl font-black text-arena-cyan">{stats.assists}</strong>
            </div>

            <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto pr-1 arena-scrollbar">
              {player.assistedGoals.map((goal) => (
                <div key={goal.id} className="grid gap-2 rounded-md border border-arena-line bg-black/20 p-3 sm:grid-cols-[100px_1fr_auto] sm:items-center">
                  <div>
                    <p className="text-xs font-bold text-slate-500">{formatDate(goal.match.matchDate)}</p>
                    <p className="mt-1 text-xs font-black text-arena-cyan">도움</p>
                  </div>
                  <Link className="text-sm font-bold text-white transition hover:text-arena-red" href={`/matches/${goal.matchId}`}>
                    {goal.match.teamAName} {goal.match.teamAScore} : {goal.match.teamBScore} {goal.match.teamBName}
                  </Link>
                  <p className="text-sm font-semibold text-slate-500 sm:text-right">
                    득점: <Link className="font-black text-arena-red hover:underline" href={`/players/${goal.scorer.id}`}>{goal.scorer.name}</Link>
                  </p>
                </div>
              ))}
              {missingAssistDetails > 0 ? (
                <p className="rounded-md border border-dashed border-arena-line bg-black/20 p-3 text-sm text-slate-500">
                  기존 도움 {missingAssistDetails}개는 연결된 득점자 정보가 저장되어 있지 않습니다.
                </p>
              ) : null}
              {stats.assists === 0 ? <p className="py-6 text-center text-sm text-slate-400">등록된 도움이 없습니다.</p> : null}
            </div>
          </article>
        </div>
      </section>

      <section className="rounded-lg border border-arena-line bg-arena-panel p-5">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white">상반기 / 하반기 기록</h2>
          <p className="mt-1 text-sm text-slate-400">전체 기록을 2026년 상반기와 하반기로 나눠 집계했습니다.</p>
        </div>
        <div className="grid gap-3 md:hidden">
          {halfYearStats.map((period) => (
            <article key={period.label} className="rounded-md border border-arena-line bg-black/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-white">{period.label}</h3>
                  <p className="mt-1 text-xs text-slate-400">{period.period}</p>
                </div>
                <p className="rounded-md bg-white/5 px-2.5 py-1 text-sm font-black text-arena-lime">{period.stats.winRate}%</p>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                <MobileRecordStat label="경기" value={`${period.stats.totalMatches}`} />
                <MobileRecordStat label="승패" value={formatPlayerRecord(period.stats)} />
                <MobileRecordStat label="득점" value={`${period.stats.goals}`} />
                <MobileRecordStat label="도움" value={`${period.stats.assists}`} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <MobileRecordStat label="MOM" value={`${period.stats.mvpCount}`} />
                <MobileRecordStat label="승률" value={`${period.stats.winRate}%`} />
              </div>
            </article>
          ))}
        </div>
        <div className="hidden overflow-hidden rounded-md border border-arena-line md:block">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-slate-300">
              <tr>
                <th className="px-3 py-2">구분</th>
                <th className="px-3 py-2">기간</th>
                <th className="px-3 py-2 text-right">경기</th>
                <th className="px-3 py-2 text-right">승</th>
                <th className="px-3 py-2 text-right">패</th>
                <th className="px-3 py-2 text-right">무</th>
                <th className="px-3 py-2 text-right">승률</th>
                <th className="px-3 py-2 text-right">득점</th>
                <th className="px-3 py-2 text-right">도움</th>
                <th className="px-3 py-2 text-right">MOM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-arena-line">
              {halfYearStats.map((period) => (
                <HalfYearStatRow key={period.label} label={period.label} period={period.period} stats={period.stats} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-arena-line bg-arena-panel p-5">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white">최근 흐름</h2>
          <p className="mt-1 text-sm text-slate-400">최근 출전 경기부터 이어지고 있는 개인 기록입니다.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="최근 연승" value={stats.currentWinStreak} detail="연속 승리" />
          <StatCard label="연속 경기 득점" value={stats.currentGoalStreak} detail="최근 득점 경기" />
          <StatCard label="연속 경기 도움" value={stats.currentAssistStreak} detail="최근 도움 경기" />
        </div>
      </section>

      <section className="rounded-lg border border-arena-line bg-arena-panel p-5">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white">연속 기록 히스토리</h2>
          <p className="mt-1 text-sm text-slate-400">전체 경기 기록에서 가장 길게 이어진 최고 기록과 해당 기간입니다.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <StreakHistoryCard title="최고 연승" unit="연승" histories={streakHistories.win} />
          <StreakHistoryCard title="최고 연속 골" unit="경기" histories={streakHistories.goal} />
          <StreakHistoryCard title="최고 연속 도움" unit="경기" histories={streakHistories.assist} />
        </div>
      </section>

      <section className="rounded-lg border border-arena-line bg-arena-panel p-5">
        <h2 className="text-xl font-bold text-white">최근 경기 기록</h2>
        <div className="mt-4 grid gap-3 md:hidden">
          {player.matchPlayers.map((record) => (
            <article key={record.id} className="rounded-md border border-arena-line bg-black/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-400">{formatDate(record.match.matchDate)}</p>
                  <p className="mt-1 text-sm font-bold leading-snug text-white">
                    {record.match.teamAName} {record.match.teamAScore} : {record.match.teamBScore} {record.match.teamBName}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-arena-cyan">소속팀: {record.teamName}</p>
                </div>
                <span className="shrink-0 rounded-md border border-arena-line bg-white/5 px-2.5 py-1 text-sm font-black text-arena-lime">
                  {getResultLabel(record.result)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <MobileRecordStat label="득점" value={`${record.goals}`} />
                <MobileRecordStat label="도움" value={`${record.assists}`} />
                <MobileRecordStat label="MOM" value={record.isMvp ? "🏆" : "-"} />
              </div>
            </article>
          ))}
        </div>

        <div className="mt-4 hidden overflow-hidden rounded-md border border-arena-line md:block">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-white/5 text-left text-slate-300">
              <tr>
                <th className="px-3 py-2">날짜</th>
                <th className="px-3 py-2">경기</th>
                <th className="px-3 py-2">소속팀</th>
                <th className="px-3 py-2">결과</th>
                <th className="px-3 py-2 text-right">득점</th>
                <th className="px-3 py-2 text-right">도움</th>
                <th className="px-3 py-2 text-right">MOM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-arena-line">
              {player.matchPlayers.map((record) => (
                <tr key={record.id}>
                  <td className="px-3 py-3 text-slate-300">{formatDate(record.match.matchDate)}</td>
                  <td className="px-3 py-3 text-white">
                    {record.match.teamAName} {record.match.teamAScore} : {record.match.teamBScore} {record.match.teamBName}
                  </td>
                  <td className="px-3 py-3 font-semibold text-arena-cyan">{record.teamName}</td>
                  <td className="px-3 py-3">{getResultLabel(record.result)}</td>
                  <td className="px-3 py-3 text-right">{record.goals}</td>
                  <td className="px-3 py-3 text-right">{record.assists}</td>
                  <td className="px-3 py-3 text-right" aria-label={record.isMvp ? "MOM" : "MOM 아님"}>
                    {record.isMvp ? "🏆" : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function HalfYearStatRow({ label, period, stats }: { label: string; period: string; stats: PlayerWithStats }) {
  return (
    <tr>
      <td className="px-3 py-3 font-bold text-white">{label}</td>
      <td className="px-3 py-3 text-slate-400">{period}</td>
      <td className="px-3 py-3 text-right">{stats.totalMatches}</td>
      <td className="px-3 py-3 text-right">{stats.wins}</td>
      <td className="px-3 py-3 text-right">{stats.losses}</td>
      <td className="px-3 py-3 text-right">{stats.draws}</td>
      <td className="px-3 py-3 text-right font-bold text-white">{stats.winRate}%</td>
      <td className="px-3 py-3 text-right">{stats.goals}</td>
      <td className="px-3 py-3 text-right">{stats.assists}</td>
      <td className="px-3 py-3 text-right">{stats.mvpCount}</td>
    </tr>
  );
}

function StreakHistoryCard({ title, unit, histories }: { title: string; unit: string; histories: PlayerStreakRecord[] }) {
  const bestLength = histories[0]?.length ?? 0;

  return (
    <article className="rounded-lg border border-arena-line bg-black/20 p-4">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-2 text-3xl font-black text-white">
        {bestLength}
        <span className="ml-1 text-base font-bold text-slate-300">{unit}</span>
      </p>
      {histories.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-bold uppercase text-arena-lime">기록 기간</p>
          {histories.map((history) => (
            <div key={`${history.startMatchId}-${history.endMatchId}`} className="rounded-md bg-white/5 px-3 py-2 text-sm text-slate-200">
              {formatStreakPeriod(history)}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-md bg-white/5 px-3 py-2 text-sm text-slate-400">아직 기록이 없습니다.</p>
      )}
    </article>
  );
}

function formatStreakPeriod(history: PlayerStreakRecord) {
  const startDate = formatDate(history.startDate);
  const endDate = formatDate(history.endDate);

  return startDate === endDate ? startDate : `${startDate} ~ ${endDate}`;
}

function MobileRecordStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/5 px-3 py-2 text-center">
      <p className="text-[11px] font-semibold text-slate-400">{label}</p>
      <p className="mt-1 text-base font-black text-white">{value}</p>
    </div>
  );
}
