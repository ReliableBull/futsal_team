"use client";

import { useMemo, useState } from "react";
import type { Player } from "@prisma/client";

type MatchFormAction = (formData: FormData) => void | Promise<void>;

export type MatchFormInitialData = {
  matchDate: string;
  location: string;
  teamAName: string;
  teamBName: string;
  teamAScore: number;
  teamBScore: number;
  teamAPlayerIds: number[];
  teamBPlayerIds: number[];
  goalsByPlayerId: Record<number, number>;
  assistsByPlayerId: Record<number, number>;
  chairmanTeamMvpId: number | null;
  managerTeamMvpId: number | null;
  memo: string;
};

type AdminMatchFormProps = {
  action: MatchFormAction;
  players: Player[];
  initialData?: MatchFormInitialData;
  submitLabel?: string;
};

const defaultInitialData: MatchFormInitialData = {
  matchDate: "",
  location: "",
  teamAName: "회장팀",
  teamBName: "총무팀",
  teamAScore: 0,
  teamBScore: 0,
  teamAPlayerIds: [],
  teamBPlayerIds: [],
  goalsByPlayerId: {},
  assistsByPlayerId: {},
  chairmanTeamMvpId: null,
  managerTeamMvpId: null,
  memo: ""
};

export function AdminMatchForm({ action, players, initialData = defaultInitialData, submitLabel = "경기 등록" }: AdminMatchFormProps) {
  const [teamAIds, setTeamAIds] = useState<number[]>(initialData.teamAPlayerIds);
  const [teamBIds, setTeamBIds] = useState<number[]>(initialData.teamBPlayerIds);
  const [teamAName, setTeamAName] = useState(initialData.teamAName);
  const [teamBName, setTeamBName] = useState(initialData.teamBName);
  const [chairmanTeamMvpId, setChairmanTeamMvpId] = useState(initialData.chairmanTeamMvpId?.toString() ?? "");
  const [managerTeamMvpId, setManagerTeamMvpId] = useState(initialData.managerTeamMvpId?.toString() ?? "");

  const selectedIds = useMemo(() => new Set([...teamAIds, ...teamBIds]), [teamAIds, teamBIds]);
  const teamAPlayers = useMemo(() => players.filter((player) => teamAIds.includes(player.id)), [players, teamAIds]);
  const teamBPlayers = useMemo(() => players.filter((player) => teamBIds.includes(player.id)), [players, teamBIds]);

  function togglePlayer(team: "A" | "B", playerId: number) {
    const setter = team === "A" ? setTeamAIds : setTeamBIds;
    const otherSetter = team === "A" ? setTeamBIds : setTeamAIds;
    const clearOwnMvp = team === "A" ? setChairmanTeamMvpId : setManagerTeamMvpId;
    const clearOtherMvp = team === "A" ? setManagerTeamMvpId : setChairmanTeamMvpId;

    setter((current) => {
      if (current.includes(playerId)) {
        clearOwnMvp((mvpId) => (mvpId === playerId.toString() ? "" : mvpId));
        return current.filter((id) => id !== playerId);
      }

      return [...current, playerId];
    });
    otherSetter((current) => current.filter((id) => id !== playerId));
    clearOtherMvp((mvpId) => (mvpId === playerId.toString() ? "" : mvpId));
  }

  return (
    <form action={action} className="space-y-5 rounded-lg border border-arena-line bg-arena-panel p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold text-slate-200">
          경기 날짜
          <input className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2" name="matchDate" type="date" defaultValue={initialData.matchDate} required />
        </label>
        <label className="space-y-2 text-sm font-semibold text-slate-200">
          장소
          <input className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2" name="location" defaultValue={initialData.location} required />
        </label>
        <label className="space-y-2 text-sm font-semibold text-slate-200">
          회장팀 이름
          <input className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2" name="teamAName" value={teamAName} onChange={(event) => setTeamAName(event.target.value)} required />
        </label>
        <label className="space-y-2 text-sm font-semibold text-slate-200">
          총무팀 이름
          <input className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2" name="teamBName" value={teamBName} onChange={(event) => setTeamBName(event.target.value)} required />
        </label>
        <label className="space-y-2 text-sm font-semibold text-slate-200">
          회장팀 점수
          <input className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2" name="teamAScore" type="number" min="0" defaultValue={initialData.teamAScore} required />
        </label>
        <label className="space-y-2 text-sm font-semibold text-slate-200">
          총무팀 점수
          <input className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2" name="teamBScore" type="number" min="0" defaultValue={initialData.teamBScore} required />
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(["A", "B"] as const).map((team) => {
          const teamIds = team === "A" ? teamAIds : teamBIds;
          const title = team === "A" ? teamAName || "회장팀" : teamBName || "총무팀";

          return (
            <div key={team} className="rounded-md border border-arena-line bg-black/20 p-4">
              <h3 className="font-bold text-white">{title} 선수 선택</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {players.map((player) => {
                  const checked = teamIds.includes(player.id);
                  const disabled = selectedIds.has(player.id) && !checked;

                  return (
                    <label key={player.id} className="flex items-center gap-2 rounded-md bg-white/5 px-3 py-2 text-sm text-slate-200">
                      <input
                        checked={checked}
                        disabled={disabled}
                        name={`team${team}Players`}
                        type="checkbox"
                        value={player.id}
                        onChange={() => togglePlayer(team, player.id)}
                      />
                      <span>{player.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-md border border-arena-line bg-black/20 p-4">
        <h3 className="font-bold text-white">선수별 득점 / 도움</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {players
            .filter((player) => selectedIds.has(player.id))
            .map((player) => (
              <div key={player.id} className="grid grid-cols-[1fr_80px_80px] items-center gap-2 rounded-md bg-white/5 p-3">
                <span className="text-sm font-semibold text-white">{player.name}</span>
                <input
                  className="min-w-0 rounded-md border border-arena-line bg-black/30 px-2 py-2 text-sm"
                  name={`goals_${player.id}`}
                  type="number"
                  min="0"
                  defaultValue={initialData.goalsByPlayerId[player.id] ?? 0}
                  aria-label={`${player.name} 득점`}
                />
                <input
                  className="min-w-0 rounded-md border border-arena-line bg-black/30 px-2 py-2 text-sm"
                  name={`assists_${player.id}`}
                  type="number"
                  min="0"
                  defaultValue={initialData.assistsByPlayerId[player.id] ?? 0}
                  aria-label={`${player.name} 도움`}
                />
              </div>
            ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-2 text-sm font-semibold text-slate-200">
          {teamAName || "회장팀"} MVP
          <select
            className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2"
            name="chairmanTeamMvpId"
            value={chairmanTeamMvpId}
            onChange={(event) => setChairmanTeamMvpId(event.target.value)}
            required
          >
            <option value="">회장팀 MVP 선택</option>
            {teamAPlayers.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2 text-sm font-semibold text-slate-200">
          {teamBName || "총무팀"} MVP
          <select
            className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2"
            name="managerTeamMvpId"
            value={managerTeamMvpId}
            onChange={(event) => setManagerTeamMvpId(event.target.value)}
            required
          >
            <option value="">총무팀 MVP 선택</option>
            {teamBPlayers.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-sm text-slate-400">저장하려면 회장팀 MVP와 총무팀 MVP를 각각 1명씩 선택해야 합니다.</p>

      <label className="block space-y-2 text-sm font-semibold text-slate-200">
        경기 메모
        <textarea className="min-h-24 w-full rounded-md border border-arena-line bg-black/30 px-3 py-2" name="memo" defaultValue={initialData.memo} />
      </label>

      <button className="w-full rounded-md bg-arena-lime px-4 py-3 font-black text-arena-black transition hover:bg-white" type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
