"use client";

import Link from "next/link";
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
  mvpCount: number;
};

type SortKey = "name" | "totalMatches" | "wins" | "losses" | "draws" | "winRate" | "goals" | "assists" | "mvpCount";
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
  { key: "mvpCount", label: "MVP" }
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

function MobileStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-white/5 px-3 py-2 text-center">
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
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

export function PlayersSortableList({ players }: { players: SortablePlayer[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("totalMatches");
  const [direction, setDirection] = useState<SortDirection>("desc");

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

  return (
    <div className="space-y-5">
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
                {player.position} · #{player.number ?? "-"}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-4 gap-2">
              <MobileStat label="승" value={player.wins} />
              <MobileStat label="패" value={player.losses} />
              <MobileStat label="무" value={player.draws} />
              <MobileStat label="승률" value={`${player.winRate}%`} />
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              <MobileStat label="경기" value={player.totalMatches} />
              <MobileStat label="득점" value={player.goals} />
              <MobileStat label="도움" value={player.assists} />
              <MobileStat label="MVP" value={player.mvpCount} />
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-arena-line bg-arena-panel md:block">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left">
            <tr>
              <th className="px-4 py-3">
                <SortButton sortKey="name" label="선수 이름" activeKey={sortKey} direction={direction} align="left" onClick={handleSort} />
              </th>
              {statSortOptions.map((option) => (
                <th key={option.key} className="px-3 py-3 text-right">
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
                <td className="px-3 py-3 text-right">{player.goals}</td>
                <td className="px-3 py-3 text-right">{player.assists}</td>
                <td className="px-3 py-3 text-right">{player.mvpCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
