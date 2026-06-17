import Link from "next/link";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import type { PlayerWithStats } from "@/lib/stats";

type RankingTableProps = {
  title: string;
  players: PlayerWithStats[];
  valueKey: "goals" | "assists" | "mvpCount" | "winRate";
  suffix?: string;
};

export function RankingTable({ title, players, valueKey, suffix = "" }: RankingTableProps) {
  return (
    <section className="rounded-lg border border-arena-line bg-arena-panel p-5 shadow-xl shadow-black/20">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <Link href="/players" className="text-sm font-bold text-arena-cyan hover:text-white">
          전체 보기
        </Link>
      </div>
      <div className="mt-4 overflow-hidden rounded-md border border-arena-line">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-slate-300">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">선수</th>
              <th className="px-3 py-2 text-right">기록</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-arena-line">
            {players.map((player, index) => (
              <tr key={player.id}>
                <td className="px-3 py-3 font-bold text-arena-lime">{index + 1}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <PlayerAvatar playerId={player.id} name={player.name} profileImageUrl={player.profileImageUrl} size="sm" />
                    <Link className="font-semibold text-white hover:text-arena-cyan" href={`/players/${player.id}`}>
                      {player.name}
                    </Link>
                  </div>
                </td>
                <td className="px-3 py-3 text-right font-bold text-white">
                  {player[valueKey]}
                  {suffix}
                </td>
              </tr>
            ))}
            {players.length === 0 ? (
              <tr>
                <td className="px-3 py-5 text-center text-slate-400" colSpan={3}>
                  표시할 기록이 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
