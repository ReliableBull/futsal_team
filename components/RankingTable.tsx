import Link from "next/link";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { parsePlayerPosition } from "@/lib/player-position";
import type { PlayerWithStats } from "@/lib/stats";

type RankingTableProps = {
  title: string;
  players: PlayerWithStats[];
  valueKey: "goals" | "assists" | "mvpCount" | "winRate" | "currentWinStreak" | "currentGoalStreak" | "currentAssistStreak";
  suffix?: string;
};

export function RankingTable({ title, players, valueKey, suffix = "" }: RankingTableProps) {
  const accent = {
    winRate: "border-t-arena-green text-arena-green",
    mvpCount: "border-t-arena-gold text-arena-gold",
    goals: "border-t-arena-red text-arena-red",
    assists: "border-t-sky-500 text-sky-400",
    currentWinStreak: "border-t-arena-green text-arena-green",
    currentGoalStreak: "border-t-arena-red text-arena-red",
    currentAssistStreak: "border-t-sky-500 text-sky-400"
  }[valueKey];

  const [borderClass, textClass] = accent.split(" ");

  return (
    <section className={`border border-arena-line border-t-2 ${borderClass} bg-arena-panel shadow-xl shadow-black/20`}>
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-arena-line px-4">
        <h2 className="text-base font-black text-white">{title}</h2>
        <Link href="/players" className="text-xs font-black text-slate-500 transition hover:text-white">
          전체 보기 →
        </Link>
      </div>
      <div className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black/25 text-left text-[11px] uppercase text-slate-500">
            <tr>
              <th className="w-10 px-3 py-2">#</th>
              <th className="px-2 py-2">선수</th>
              <th className="px-3 py-2 text-right">기록</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-arena-line">
            {players.map((player, index) => (
              <tr key={player.id} className="transition hover:bg-white/[0.025]">
                <td className={`px-3 py-3 text-base font-black ${index === 0 ? textClass : "text-slate-500"}`}>{index + 1}</td>
                <td className="px-2 py-3">
                  <div className="flex items-center gap-2">
                    <PlayerAvatar playerId={player.id} name={player.name} profileImageUrl={player.profileImageUrl} size="sm" />
                    <div className="min-w-0">
                      <Link className="block truncate font-black text-white transition hover:text-arena-red" href={`/players/${player.id}`}>
                        {player.name}
                      </Link>
                      <p className="truncate text-[10px] font-bold text-slate-600">{parsePlayerPosition(player.position)}</p>
                    </div>
                  </div>
                </td>
                <td className={`px-3 py-3 text-right text-base font-black ${textClass}`}>
                  {valueKey === "goals" || valueKey === "assists" ? (
                    <Link
                      className="hover:underline"
                      href={`/players/${player.id}#${valueKey === "goals" ? "goal-details" : "assist-details"}`}
                    >
                      {player[valueKey]}{suffix}
                    </Link>
                  ) : (
                    <>{player[valueKey]}{suffix}</>
                  )}
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
