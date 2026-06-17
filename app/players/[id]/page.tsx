import { notFound } from "next/navigation";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { StatCard } from "@/components/StatCard";
import { parsePlayerPosition } from "@/lib/player-position";
import { prisma } from "@/lib/prisma";
import { calculatePlayerStats, formatDate, formatPlayerRecord, getResultLabel, matchStatus } from "@/lib/stats";

export default async function PlayerDetailPage({ params }: { params: { id: string } }) {
  const player = await prisma.player.findFirst({
    where: { id: Number(params.id), isActive: true },
    include: {
      matchPlayers: {
        where: { match: { status: matchStatus.completed } },
        include: { match: true },
        orderBy: { match: { matchDate: "desc" } }
      }
    }
  });

  if (!player) notFound();

  const stats = calculatePlayerStats(player);
  const position = parsePlayerPosition(player.position);

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
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="출장 경기 수" value={stats.totalMatches} detail={formatPlayerRecord(stats)} />
        <StatCard label="승률" value={`${stats.winRate}%`} />
        <StatCard label="득점" value={stats.goals} />
        <StatCard label="도움" value={stats.assists} />
        <StatCard label="MVP" value={stats.mvpCount} detail="선정 횟수" />
      </div>

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
                <MobileRecordStat label="MVP" value={record.isMvp ? "🏆" : "-"} />
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
                <th className="px-3 py-2 text-right">MVP</th>
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
                  <td className="px-3 py-3 text-right" aria-label={record.isMvp ? "MVP" : "MVP 아님"}>
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

function MobileRecordStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/5 px-3 py-2 text-center">
      <p className="text-[11px] font-semibold text-slate-400">{label}</p>
      <p className="mt-1 text-base font-black text-white">{value}</p>
    </div>
  );
}
