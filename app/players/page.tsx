import Link from "next/link";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { getPlayersWithStats, type PlayerWithStats } from "@/lib/stats";

function PlayerIdentity({ player }: { player: PlayerWithStats }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <PlayerAvatar playerId={player.id} name={player.name} profileImageUrl={player.profileImageUrl} size="sm" />
      <div className="min-w-0">
        <Link className="block truncate font-bold text-white hover:text-arena-cyan" href={`/players/${player.id}`}>
          {player.name}
        </Link>
        <p className="truncate text-xs text-slate-500">
          {player.nickname ? `${player.nickname} · ` : ""}
          #{player.number ?? "-"}
        </p>
      </div>
    </div>
  );
}

function MobileStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-white/5 px-3 py-2 text-center">
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}

export default async function PlayersPage() {
  const players = await getPlayersWithStats();

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-bold uppercase text-arena-lime">Players</p>
        <h1 className="text-3xl font-black text-white">선수 목록</h1>
      </div>

      <div className="grid gap-3 md:hidden">
        {players.map((player) => (
          <article key={player.id} className="rounded-lg border border-arena-line bg-[radial-gradient(circle_at_top,rgba(64,217,255,0.12),transparent_42%),#151d2d] p-4 text-center shadow-xl shadow-black/20">
            <div className="flex flex-col items-center">
              <Link className="transition hover:scale-[1.03]" href={`/players/${player.id}`} aria-label={`${player.name} 상세 보기`}>
                <PlayerAvatar playerId={player.id} name={player.name} profileImageUrl={player.profileImageUrl} size="lg" />
              </Link>
              <Link className="mt-3 text-xl font-black text-white hover:text-arena-cyan" href={`/players/${player.id}`}>
                {player.name}
              </Link>
              <p className="mt-1 text-sm text-slate-400">
                {player.nickname ? `${player.nickname} · ` : ""}
                #{player.number ?? "-"}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-4 gap-2">
              <MobileStat label="승" value={player.wins} />
              <MobileStat label="패" value={player.losses} />
              <MobileStat label="무" value={player.draws} />
              <MobileStat label="승률" value={`${player.winRate}%`} />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <MobileStat label="경기" value={player.totalMatches} />
              <MobileStat label="득점" value={player.goals} />
              <MobileStat label="MVP" value={player.mvpCount} />
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-arena-line bg-arena-panel md:block">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-slate-300">
            <tr>
              <th className="px-4 py-3">선수</th>
              <th className="px-3 py-3 text-right">경기</th>
              <th className="px-3 py-3 text-right">승</th>
              <th className="px-3 py-3 text-right">패</th>
              <th className="px-3 py-3 text-right">무</th>
              <th className="px-3 py-3 text-right">승률</th>
              <th className="px-3 py-3 text-right">득점</th>
              <th className="px-3 py-3 text-right">MVP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-arena-line">
            {players.map((player) => (
              <tr key={player.id}>
                <td className="px-4 py-3">
                  <PlayerIdentity player={player} />
                </td>
                <td className="px-3 py-3 text-right">{player.totalMatches}</td>
                <td className="px-3 py-3 text-right">{player.wins}</td>
                <td className="px-3 py-3 text-right">{player.losses}</td>
                <td className="px-3 py-3 text-right">{player.draws}</td>
                <td className="px-3 py-3 text-right font-bold text-white">{player.winRate}%</td>
                <td className="px-3 py-3 text-right">{player.goals}</td>
                <td className="px-3 py-3 text-right">{player.mvpCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
