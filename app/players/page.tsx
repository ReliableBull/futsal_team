import { PlayersSortableList, type SortablePlayer } from "@/components/PlayersSortableList";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { getDateRange } from "@/lib/date-range";
import { parsePlayerPosition } from "@/lib/player-position";
import { getPlayersWithStats } from "@/lib/stats-data";

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
    assists: player.assists,
    attackPoints: player.goals + player.assists,
    attackPointsPerMatch: player.totalMatches > 0 ? Math.round(((player.goals + player.assists) * 100) / player.totalMatches) / 100 : 0,
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
        <p className="mt-1 text-xs text-slate-500">공격 포인트 = 득점 + 도움 · 완료된 경기만 집계합니다.</p>
        <p className="mt-1 text-xs text-slate-500">경기당 공격 포인트 = 공격 포인트 ÷ 출전 경기 수</p>
      </div>

      <DateRangeFilter actionPath="/players" range={dateRange} />

      <PlayersSortableList players={sortablePlayers} startDate={dateRange.startDate} endDate={dateRange.endDate} />
    </div>
  );
}
