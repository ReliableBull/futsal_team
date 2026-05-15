import Link from "next/link";
import { getPlayersWithStats } from "@/lib/stats";

export default async function PlayersPage() {
  const players = await getPlayersWithStats();

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-bold uppercase text-arena-lime">Players</p>
        <h1 className="text-3xl font-black text-white">선수 목록</h1>
      </div>
      <div className="overflow-hidden rounded-lg border border-arena-line bg-arena-panel">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-white/5 text-left text-slate-300">
            <tr>
              <th className="px-4 py-3">선수</th>
              <th className="px-4 py-3">포지션</th>
              <th className="px-4 py-3">등번호</th>
              <th className="px-4 py-3 text-right">경기</th>
              <th className="px-4 py-3 text-right">승률</th>
              <th className="px-4 py-3 text-right">득점</th>
              <th className="px-4 py-3 text-right">MVP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-arena-line">
            {players.map((player) => (
              <tr key={player.id}>
                <td className="px-4 py-3">
                  <Link className="font-bold text-white hover:text-arena-cyan" href={`/players/${player.id}`}>
                    {player.name}
                  </Link>
                  {player.nickname ? <span className="ml-2 text-slate-500">{player.nickname}</span> : null}
                </td>
                <td className="px-4 py-3 text-slate-300">{player.position}</td>
                <td className="px-4 py-3 text-slate-300">{player.number ?? "-"}</td>
                <td className="px-4 py-3 text-right">{player.totalMatches}</td>
                <td className="px-4 py-3 text-right">{player.winRate}%</td>
                <td className="px-4 py-3 text-right">{player.goals}</td>
                <td className="px-4 py-3 text-right">{player.mvpCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
