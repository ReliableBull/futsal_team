import { PlayersSortableList, type SortablePlayer } from "@/components/PlayersSortableList";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { getDateRange } from "@/lib/date-range";
import { parsePlayerPosition } from "@/lib/player-position";
import { getPlayersWithStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function PlayersPage({ searchParams }: { searchParams: { startDate?: string; endDate?: string } }) {
  const dateRange = getDateRange(searchParams);
  const players = await getPlayersWithStats(dateRange);
  const sortablePlayers: SortablePlayer[] = players.map((player) => ({
    id: player.id,
    name: player.name,
    nickname: player.nickname,
    position: parsePlayerPosition(player.position),
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
        <p className="mt-2 text-sm text-slate-400">
          기록 집계 기간: {dateRange.startDate} ~ {dateRange.endDate}
        </p>
      </div>

      <DateRangeFilter actionPath="/players" range={dateRange} />

      <PlayersSortableList players={sortablePlayers} />
    </div>
  );
}
