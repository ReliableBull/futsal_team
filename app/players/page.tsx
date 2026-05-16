import { PlayersSortableList, type SortablePlayer } from "@/components/PlayersSortableList";
import { getPlayersWithStats } from "@/lib/stats";

export default async function PlayersPage() {
  const players = await getPlayersWithStats();
  const sortablePlayers: SortablePlayer[] = players.map((player) => ({
    id: player.id,
    name: player.name,
    nickname: player.nickname,
    profileImageUrl: player.profileImageUrl,
    number: player.number,
    totalMatches: player.totalMatches,
    wins: player.wins,
    losses: player.losses,
    draws: player.draws,
    winRate: player.winRate,
    goals: player.goals,
    mvpCount: player.mvpCount
  }));

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-bold uppercase text-arena-lime">Players</p>
        <h1 className="text-3xl font-black text-white">선수 목록</h1>
      </div>

      <PlayersSortableList players={sortablePlayers} />
    </div>
  );
}
