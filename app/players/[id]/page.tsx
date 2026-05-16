import { notFound } from "next/navigation";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { StatCard } from "@/components/StatCard";
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
              등번호 {player.number ?? "-"}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="출장 경기 수" value={stats.totalMatches} detail={formatPlayerRecord(stats)} />
        <StatCard label="승률" value={`${stats.winRate}%`} />
        <StatCard label="득점" value={stats.goals} detail={`${stats.assists} 도움`} />
        <StatCard label="MVP" value={stats.mvpCount} detail="선정 횟수" />
      </div>

      <section className="rounded-lg border border-arena-line bg-arena-panel p-5">
        <h2 className="text-xl font-bold text-white">최근 경기 기록</h2>
        <div className="mt-4 overflow-hidden rounded-md border border-arena-line">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-white/5 text-left text-slate-300">
              <tr>
                <th className="px-3 py-2">날짜</th>
                <th className="px-3 py-2">경기</th>
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
                  <td className="px-3 py-3">{getResultLabel(record.result)}</td>
                  <td className="px-3 py-3 text-right">{record.goals}</td>
                  <td className="px-3 py-3 text-right">{record.assists}</td>
                  <td className="px-3 py-3 text-right">{record.isMvp ? "Yes" : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
