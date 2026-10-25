"use client";
import { useTeam } from "@/components/TeamProvider";

import Link from "@/components/TeamLink";
import { useMemo, useState } from "react";
import { PlayerAvatar } from "@/components/PlayerAvatar";

export type SortablePlayer = {
  id: number;
  name: string;
  nickname: string | null;
  position: string;
  profileImageUrl: string | null;
  number: number | null;
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  goals: number;
  assists: number;
  attackPoints: number;
  attackPointsPerMatch: number;
  mvpCount: number;
};

type SortKey = "name" | "totalMatches" | "wins" | "losses" | "draws" | "winRate" | "goals" | "assists" | "attackPoints" | "attackPointsPerMatch" | "mvpCount";
type SortDirection = "asc" | "desc";

const sortOptions: Array<{ key: SortKey; label: string }> = [
  { key: "name", label: "선수 이름" },
  { key: "totalMatches", label: "경기" },
  { key: "wins", label: "승" },
  { key: "losses", label: "패" },
  { key: "draws", label: "무" },
  { key: "winRate", label: "승률" },
  { key: "goals", label: "득점" },
  { key: "assists", label: "도움" },
  { key: "attackPoints", label: "공격 포인트" },
  { key: "attackPointsPerMatch", label: "경기당 공격 포인트" },
  { key: "mvpCount", label: "MOM" }
];

const statSortOptions = sortOptions.filter((option) => option.key !== "name");

function PlayerIdentity({ player }: { player: SortablePlayer }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <PlayerAvatar playerId={player.id} name={player.name} profileImageUrl={player.profileImageUrl} size="sm" />
      <div className="min-w-0">
        <Link className="block truncate font-bold text-white hover:text-arena-cyan" href={`/players/${player.id}`}>
          {player.name}
        </Link>
        <p className="truncate text-xs text-slate-500">
          {player.nickname ? `${player.nickname} · ` : ""}
          {player.position} · #{player.number ?? "-"}
        </p>
      </div>
    </div>
  );
}

function MobileStat({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const content = (
    <>
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </>
  );

  return href ? (
    <Link className="rounded-md bg-white/5 px-3 py-2 text-center transition hover:bg-red-50 hover:text-arena-red" href={href}>
      {content}
    </Link>
  ) : (
    <div className="rounded-md bg-white/5 px-3 py-2 text-center">{content}</div>
  );
}

function SortButton({ sortKey, label, activeKey, direction, align = "right", onClick }: { sortKey: SortKey; label: string; activeKey: SortKey; direction: SortDirection; align?: "left" | "right"; onClick: (key: SortKey) => void }) {
  const isActive = activeKey === sortKey;

  return (
    <button
      className={`inline-flex w-full items-center gap-1 font-bold transition ${align === "left" ? "justify-start text-left" : "justify-end text-right"} ${isActive ? "text-arena-lime" : "text-slate-300 hover:text-white"}`}
      type="button"
      onClick={() => onClick(sortKey)}
    >
      <span>{label}</span>
      <span className="w-3 text-xs">{isActive ? (direction === "asc" ? "▲" : "▼") : ""}</span>
    </button>
  );
}

export function PlayersSortableList({ players, startDate, endDate }: { players: SortablePlayer[]; startDate: string; endDate: string }) {
  const team = useTeam();
  const [sortKey, setSortKey] = useState<SortKey>("totalMatches");
  const [direction, setDirection] = useState<SortDirection>("desc");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const sortedPlayers = useMemo(() => {
    const multiplier = direction === "asc" ? 1 : -1;

    return [...players].sort((a, b) => {
      const diff = sortKey === "name" ? a.name.localeCompare(b.name, "ko") * multiplier : (a[sortKey] - b[sortKey]) * multiplier;
      if (diff !== 0) return diff;

      return (a.number ?? 9999) - (b.number ?? 9999) || a.name.localeCompare(b.name, "ko");
    });
  }, [direction, players, sortKey]);

  function handleSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setDirection(nextKey === "name" ? "asc" : "desc");
  }

  async function downloadExcel() {
    if (exporting) return;
    setExporting(true);
    setExportError("");
    try {
      const { createPlayerListWorkbook, playerListExcelType } = await import("@/lib/player-list-excel");
      const bytes = createPlayerListWorkbook(sortedPlayers, {
        teamName: team.name,
        startDate, endDate, sortLabel: sortOptions.find((option) => option.key === sortKey)!.label, direction
      });
      const url = URL.createObjectURL(new Blob([bytes], { type: playerListExcelType }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `arena-fc-players-${startDate}_${endDate}.xlsx`;
      document.body.appendChild(link);
      try { link.click(); } finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
    } catch {
      setExportError("엑셀 파일을 만들지 못했습니다. 다시 시도해주세요.");
    } finally { setExporting(false); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">현재 조회 기간과 정렬 순서로 {players.length}명의 기록을 저장합니다.</p>
        <button type="button" onClick={downloadExcel} disabled={exporting} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-bold text-[#fff] hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5" /></svg>
          {exporting ? "엑셀 만드는 중…" : "엑셀 다운로드"}
        </button>
      </div>
      {exportError && <p role="alert" className="text-sm font-semibold text-red-700">{exportError}</p>}
      <div className="rounded-lg border border-arena-line bg-arena-panel p-4 md:hidden">
        <label className="block text-sm font-bold text-slate-200">
          정렬 기준
          <select
            className="mt-2 w-full rounded-md border border-arena-line bg-black/30 px-3 py-2"
            value={sortKey}
            onChange={(event) => handleSort(event.target.value as SortKey)}
          >
            {sortOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            className={`rounded-md border px-3 py-2 text-sm font-black transition ${direction === "desc" ? "border-arena-lime bg-arena-lime text-arena-black" : "border-arena-line text-slate-200"}`}
            type="button"
            onClick={() => setDirection("desc")}
          >
            내림차순
          </button>
          <button
            className={`rounded-md border px-3 py-2 text-sm font-black transition ${direction === "asc" ? "border-arena-lime bg-arena-lime text-arena-black" : "border-arena-line text-slate-200"}`}
            type="button"
            onClick={() => setDirection("asc")}
          >
            오름차순
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:hidden">
        {sortedPlayers.map((player) => (
          <article key={player.id} className="rounded-lg border border-arena-line bg-[radial-gradient(circle_at_top,rgba(239,65,54,0.09),transparent_42%),#ffffff] p-4 text-center shadow-lg shadow-slate-200/60">
            <div className="flex flex-col items-center">
              <Link className="transition hover:scale-[1.03]" href={`/players/${player.id}`} aria-label={`${player.name} 상세 보기`}>
                <PlayerAvatar playerId={player.id} name={player.name} profileImageUrl={player.profileImageUrl} size="lg" />
              </Link>
              <Link className="mt-3 text-xl font-black text-white hover:text-arena-cyan" href={`/players/${player.id}`}>
                {player.name}
              </Link>
              <p className="mt-1 text-sm text-slate-400">
                {player.nickname ? `${player.nickname} · ` : ""}
                {player.position} · #{player.number ?? "-"}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <MobileStat label="경기" value={player.totalMatches} />
              <MobileStat label="승률" value={`${player.winRate}%`} />
              <MobileStat label="MOM" value={player.mvpCount} />
              <MobileStat label="승" value={player.wins} />
              <MobileStat label="패" value={player.losses} />
              <MobileStat label="무" value={player.draws} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <MobileStat label="득점" value={player.goals} href={`/players/${player.id}#goal-details`} />
              <MobileStat label="도움" value={player.assists} href={`/players/${player.id}#assist-details`} />
              <MobileStat label="공격 포인트" value={player.attackPoints} />
              <MobileStat label="경기당 공격 포인트" value={player.attackPointsPerMatch.toFixed(2)} />
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-arena-line bg-arena-panel md:block">
        <table className="w-full min-w-[1050px] text-sm">
          <thead className="bg-white/5 text-left">
            <tr>
              <th className="px-4 py-3">
                <SortButton sortKey="name" label="선수 이름" activeKey={sortKey} direction={direction} align="left" onClick={handleSort} />
              </th>
              {statSortOptions.map((option) => (
                <th key={option.key} className="whitespace-nowrap px-3 py-3 text-right">
                  <SortButton sortKey={option.key} label={option.label} activeKey={sortKey} direction={direction} onClick={handleSort} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-arena-line">
            {sortedPlayers.map((player) => (
              <tr key={player.id}>
                <td className="px-4 py-3">
                  <PlayerIdentity player={player} />
                </td>
                <td className="px-3 py-3 text-right">{player.totalMatches}</td>
                <td className="px-3 py-3 text-right">{player.wins}</td>
                <td className="px-3 py-3 text-right">{player.losses}</td>
                <td className="px-3 py-3 text-right">{player.draws}</td>
                <td className="px-3 py-3 text-right font-bold text-white">{player.winRate}%</td>
                <td className="px-3 py-3 text-right">
                  <Link className="font-black text-arena-red hover:underline" href={`/players/${player.id}#goal-details`}>{player.goals}</Link>
                </td>
                <td className="px-3 py-3 text-right">
                  <Link className="font-black text-arena-cyan hover:underline" href={`/players/${player.id}#assist-details`}>{player.assists}</Link>
                </td>
                <td className="px-3 py-3 text-right font-black text-white">{player.attackPoints}</td>
                <td className="px-3 py-3 text-right font-black text-white">{player.attackPointsPerMatch.toFixed(2)}</td>
                <td className="px-3 py-3 text-right">{player.mvpCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
