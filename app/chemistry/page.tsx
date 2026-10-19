import type { Metadata } from "next";
import Link from "next/link";
import { ChemistryResults } from "@/components/ChemistryResults";
import { getChemistryPlayers, getPlayerChemistry } from "@/lib/player-chemistry-data";
import { parseChemistryFilters, type ChemistryFilters } from "@/lib/player-chemistry";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "선수 조합 분석 | ARENA FC" };

export default async function ChemistryPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const players = await getChemistryPlayers();
  const now = new Date();
  let filters: ChemistryFilters = parseChemistryFilters({}, now);
  let error = "";
  try { filters = parseChemistryFilters(searchParams, now); }
  catch (cause) { error = cause instanceof Error ? cause.message : "조회 조건을 확인해주세요."; }
  const player = filters.playerId ? players.find((item) => item.id === filters.playerId) : players[0];
  if (!error && filters.playerId && !player) error = "해당 선수를 찾을 수 없습니다. 선수를 다시 선택해주세요.";
  const data = player && !error ? await getPlayerChemistry(player.id, filters) : null;
  const fieldClass = "mt-2 w-full min-w-0 rounded-lg border border-arena-line bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-arena-red";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-black tracking-widest text-arena-red">TEAM CHEMISTRY</p>
        <h1 className="mt-2 text-3xl font-black text-slate-900">선수 조합 분석</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">함께 이긴 동료, 맞붙었던 상대, 골을 만든 파트너를 기록으로 확인하세요.</p>
      </div>
      {players.length === 0 ? <p className="rounded-xl border border-arena-line bg-white p-6 text-slate-500">등록된 선수가 없습니다.</p> : (
        <form key={JSON.stringify(filters)} action="/chemistry" className="rounded-xl border border-arena-line bg-white p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto] lg:items-end">
            <label className="min-w-0 text-sm font-bold text-slate-700">기준 선수
              <select className={fieldClass} name="playerId" defaultValue={player?.id}>
                {players.map((item) => <option key={item.id} value={item.id}>{item.name}{item.nickname ? ` (${item.nickname})` : ""}{!item.isActive ? " · 비활성" : ""}</option>)}
              </select>
            </label>
            <label className="min-w-0 text-sm font-bold text-slate-700">시작일<input className={fieldClass} type="date" name="startDate" defaultValue={filters.startDate} /></label>
            <label className="min-w-0 text-sm font-bold text-slate-700">종료일<input className={fieldClass} type="date" name="endDate" defaultValue={filters.endDate} /></label>
            <label className="text-sm font-bold text-slate-700">최소 경기 수
              <select className={fieldClass} name="minMatches" defaultValue={filters.minMatches}>
                {[1, 3, 5, 10].map((count) => <option key={count} value={count}>{count}경기 이상</option>)}
              </select>
            </label>
            <button type="submit" className="rounded-lg bg-arena-red px-5 py-3 text-sm font-black text-[#fff] hover:bg-red-600">분석 보기</button>
          </div>
          <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-slate-500">
            <span>날짜를 비우면 모든 연도를 조회합니다. 진행 중 경기는 제외됩니다.</span>
            <Link href={`/chemistry?${new URLSearchParams({ ...(player ? { playerId: String(player.id) } : {}), startDate: "", endDate: "", minMatches: String(filters.minMatches) })}`} className="font-bold text-arena-cyan hover:underline">전체 기간으로 보기</Link>
          </div>
        </form>
      )}
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {player && data && <ChemistryResults player={player} data={data} minimum={filters.minMatches} />}
    </div>
  );
}
