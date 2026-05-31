import Link from "next/link";
import { notFound } from "next/navigation";
import { WinnerBadge } from "@/components/WinnerBadge";
import { matchInclude } from "@/lib/matches";
import { prisma } from "@/lib/prisma";
import { formatDate, getTeamMvpNames, matchStatus } from "@/lib/stats";

export default async function MatchDetailPage({ params }: { params: { id: string } }) {
  const match = await prisma.match.findUnique({
    where: { id: Number(params.id) },
    include: matchInclude
  });

  if (!match) notFound();

  const teamAPlayers = match.matchPlayers.filter((record) => record.teamName === match.teamAName);
  const teamBPlayers = match.matchPlayers.filter((record) => record.teamName === match.teamBName);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-arena-line bg-arena-panel p-6">
        <p className="text-sm font-bold uppercase text-arena-lime">{formatDate(match.matchDate)}</p>
        <h1 className="mt-2 text-3xl font-black text-white">
          {match.teamAName} {match.teamAScore} : {match.teamBScore} {match.teamBName}
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-slate-300">
          <span>{match.location}</span>
          <span>·</span>
          <span>승리팀</span>
          {match.status === matchStatus.completed ? <WinnerBadge match={match} /> : <span className="font-bold text-white">-</span>}
          <span>
            · {match.teamAName} MVP {getTeamMvpNames(match.matchPlayers, match.teamAName)} · {match.teamBName} MVP{" "}
            {getTeamMvpNames(match.matchPlayers, match.teamBName)}
          </span>
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {[
          { title: match.teamAName, players: teamAPlayers, score: match.teamAScore },
          { title: match.teamBName, players: teamBPlayers, score: match.teamBScore }
        ].map((team) => (
          <section key={team.title} className="rounded-lg border border-arena-line bg-arena-panel p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">{team.title}</h2>
              <span className="text-3xl font-black text-arena-lime">{team.score}</span>
            </div>
            <div className="mt-4 overflow-hidden rounded-md border border-arena-line">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-left text-slate-300">
                  <tr>
                    <th className="px-3 py-2">선수</th>
                    <th className="px-3 py-2 text-right">득점</th>
                    <th className="px-3 py-2 text-right">도움</th>
                    <th className="px-3 py-2 text-right">MVP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-arena-line">
                  {team.players.map((record) => (
                    <tr key={record.id}>
                      <td className="px-3 py-3">
                        <Link className="font-semibold text-white hover:text-arena-cyan" href={`/players/${record.playerId}`}>
                          {record.player.name}
                        </Link>
                      </td>
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
        ))}
      </div>

      <section className="rounded-lg border border-arena-line bg-arena-panel p-5">
        <h2 className="text-xl font-bold text-white">경기 메모</h2>
        <p className="mt-3 whitespace-pre-wrap text-slate-300">{match.memo || "등록된 메모가 없습니다."}</p>
      </section>
    </div>
  );
}
