"use client";

import { useMemo, useState } from "react";
import type { Player } from "@prisma/client";
import { matchStatus, type MatchStatusValue } from "@/lib/stats";

type MatchFormAction = (formData: FormData) => void | Promise<void>;
type TeamKey = "A" | "B";
type FormTab = "manual" | "random";
type ScoreMode = "goals" | "manual";

export type MatchFormInitialData = {
  matchDate: string;
  status: MatchStatusValue;
  location: string;
  teamAName: string;
  teamBName: string;
  teamAScore: number;
  teamBScore: number;
  teamAPlayerIds: number[];
  teamBPlayerIds: number[];
  goalsByPlayerId: Record<number, number>;
  assistsByPlayerId: Record<number, number>;
  chairmanTeamMvpIds: number[];
  managerTeamMvpIds: number[];
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
  status: matchStatus.inProgress,
  location: "",
  teamAName: "회장팀",
  teamBName: "총무팀",
  teamAScore: 0,
  teamBScore: 0,
  teamAPlayerIds: [],
  teamBPlayerIds: [],
  goalsByPlayerId: {},
  assistsByPlayerId: {},
  chairmanTeamMvpIds: [],
  managerTeamMvpIds: [],
  memo: ""
};

function shuffleIds(ids: number[]) {
  const copied = [...ids];
  for (let index = copied.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copied[index], copied[randomIndex]] = [copied[randomIndex], copied[index]];
  }
  return copied;
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function AdminMatchForm({ action, players, initialData = defaultInitialData, submitLabel = "경기 등록" }: AdminMatchFormProps) {
  const [activeTab, setActiveTab] = useState<FormTab>("manual");
  const [teamAIds, setTeamAIds] = useState<number[]>(initialData.teamAPlayerIds);
  const [teamBIds, setTeamBIds] = useState<number[]>(initialData.teamBPlayerIds);
  const [participantIds, setParticipantIds] = useState<number[]>([...initialData.teamAPlayerIds, ...initialData.teamBPlayerIds]);
  const [teamAName, setTeamAName] = useState(initialData.teamAName);
  const [teamBName, setTeamBName] = useState(initialData.teamBName);
  const [status, setStatus] = useState<MatchStatusValue>(initialData.status);
  const [teamAScore, setTeamAScore] = useState(initialData.teamAScore);
  const [teamBScore, setTeamBScore] = useState(initialData.teamBScore);
  const [goalsByPlayerId, setGoalsByPlayerId] = useState<Record<number, number>>(initialData.goalsByPlayerId);
  const [scoreMode, setScoreMode] = useState<ScoreMode>(() => {
    const initialTeamAGoals = sumGoals(initialData.teamAPlayerIds, initialData.goalsByPlayerId);
    const initialTeamBGoals = sumGoals(initialData.teamBPlayerIds, initialData.goalsByPlayerId);

    return initialTeamAGoals === initialData.teamAScore && initialTeamBGoals === initialData.teamBScore ? "goals" : "manual";
  });
  const [chairmanTeamMvpIds, setChairmanTeamMvpIds] = useState<number[]>(initialData.chairmanTeamMvpIds);
  const [managerTeamMvpIds, setManagerTeamMvpIds] = useState<number[]>(initialData.managerTeamMvpIds);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawPreviewIds, setDrawPreviewIds] = useState<number[]>([]);
  const [hasRandomTeams, setHasRandomTeams] = useState(initialData.teamAPlayerIds.length > 0 && initialData.teamBPlayerIds.length > 0);

  const selectedIds = useMemo(() => new Set([...teamAIds, ...teamBIds]), [teamAIds, teamBIds]);
  const participantSet = useMemo(() => new Set(participantIds), [participantIds]);
  const teamAPlayers = useMemo(() => players.filter((player) => teamAIds.includes(player.id)), [players, teamAIds]);
  const teamBPlayers = useMemo(() => players.filter((player) => teamBIds.includes(player.id)), [players, teamBIds]);
  const drawPreviewPlayers = useMemo(() => players.filter((player) => drawPreviewIds.includes(player.id)), [players, drawPreviewIds]);
  const canDrawTeams = participantIds.length >= 2 && participantIds.length % 2 === 0 && !isDrawing;
  const canSubmit = teamAIds.length > 0 && teamBIds.length > 0;

  function sumGoals(playerIds: number[], nextGoalsByPlayerId: Record<number, number>) {
    return playerIds.reduce((sum, playerId) => sum + (nextGoalsByPlayerId[playerId] ?? 0), 0);
  }

  function syncScores(nextTeamAIds = teamAIds, nextTeamBIds = teamBIds, nextGoalsByPlayerId = goalsByPlayerId) {
    if (scoreMode === "manual") return;

    setTeamAScore(sumGoals(nextTeamAIds, nextGoalsByPlayerId));
    setTeamBScore(sumGoals(nextTeamBIds, nextGoalsByPlayerId));
  }

  function switchScoreMode(nextScoreMode: ScoreMode) {
    setScoreMode(nextScoreMode);

    if (nextScoreMode === "goals") {
      setTeamAScore(sumGoals(teamAIds, goalsByPlayerId));
      setTeamBScore(sumGoals(teamBIds, goalsByPlayerId));
    }
  }

  function setTeams(nextTeamAIds: number[], nextTeamBIds: number[]) {
    setTeamAIds(nextTeamAIds);
    setTeamBIds(nextTeamBIds);
    setChairmanTeamMvpIds([]);
    setManagerTeamMvpIds([]);
    syncScores(nextTeamAIds, nextTeamBIds);
  }

  function togglePlayer(team: TeamKey, playerId: number) {
    const setter = team === "A" ? setTeamAIds : setTeamBIds;
    const otherSetter = team === "A" ? setTeamBIds : setTeamAIds;
    const clearOwnMvp = team === "A" ? setChairmanTeamMvpIds : setManagerTeamMvpIds;
    const clearOtherMvp = team === "A" ? setManagerTeamMvpIds : setChairmanTeamMvpIds;

    setHasRandomTeams(false);
    setter((current) => {
      if (current.includes(playerId)) {
        clearOwnMvp((mvpIds) => mvpIds.filter((mvpId) => mvpId !== playerId));
        const nextOwnIds = current.filter((id) => id !== playerId);
        if (team === "A") {
          syncScores(nextOwnIds, teamBIds);
        } else {
          syncScores(teamAIds, nextOwnIds);
        }
        return nextOwnIds;
      }

      const nextOwnIds = [...current, playerId];
      if (team === "A") {
        syncScores(nextOwnIds, teamBIds.filter((id) => id !== playerId));
      } else {
        syncScores(teamAIds.filter((id) => id !== playerId), nextOwnIds);
      }
      return nextOwnIds;
    });
    otherSetter((current) => current.filter((id) => id !== playerId));
    clearOtherMvp((mvpIds) => mvpIds.filter((mvpId) => mvpId !== playerId));
  }

  function toggleMvp(team: TeamKey, playerId: number) {
    const setter = team === "A" ? setChairmanTeamMvpIds : setManagerTeamMvpIds;
    setter((current) => (current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId]));
  }

  function toggleParticipant(playerId: number) {
    setParticipantIds((current) => (current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId]));
    setTeams([], []);
    setHasRandomTeams(false);
  }

  function updatePlayerGoals(playerId: number, value: string) {
    const nextGoals = {
      ...goalsByPlayerId,
      [playerId]: Math.max(0, Number(value) || 0)
    };
    setGoalsByPlayerId(nextGoals);
    syncScores(teamAIds, teamBIds, nextGoals);
  }

  function switchTab(tab: FormTab) {
    if (tab === "random" && selectedIds.size > 0) {
      setParticipantIds([...teamAIds, ...teamBIds]);
    }
    setActiveTab(tab);
  }

  async function drawRandomTeams() {
    if (!canDrawTeams) return;

    setIsDrawing(true);
    setHasRandomTeams(false);

    for (let round = 0; round < 18; round += 1) {
      setDrawPreviewIds(shuffleIds(participantIds).slice(0, Math.min(6, participantIds.length)));
      await wait(80 + round * 8);
    }

    const shuffled = shuffleIds(participantIds);
    const middle = shuffled.length / 2;
    const nextTeamAIds = shuffled.slice(0, middle);
    const nextTeamBIds = shuffled.slice(middle);

    setTeams(nextTeamAIds, nextTeamBIds);
    setDrawPreviewIds([]);
    setHasRandomTeams(true);
    setIsDrawing(false);
  }

  return (
    <form action={action} className="space-y-5 rounded-lg border border-arena-line bg-arena-panel p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold text-slate-200">
          경기 날짜
          <input className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2" name="matchDate" type="date" defaultValue={initialData.matchDate} required />
        </label>
        <label className="space-y-2 text-sm font-semibold text-slate-200">
          경기 상태
          <select
            className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2"
            name="status"
            value={status}
            onChange={(event) => setStatus(event.target.value as MatchStatusValue)}
          >
            <option value={matchStatus.inProgress}>경기 진행중</option>
            <option value={matchStatus.completed}>결과 등록 완료</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold text-slate-200">
          장소
          <input className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2" name="location" defaultValue={initialData.location} required />
        </label>
        <label className="space-y-2 text-sm font-semibold text-slate-200">
          A팀 이름
          <input className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2" name="teamAName" value={teamAName} onChange={(event) => setTeamAName(event.target.value)} required />
        </label>
        <label className="space-y-2 text-sm font-semibold text-slate-200">
          B팀 이름
          <input className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2" name="teamBName" value={teamBName} onChange={(event) => setTeamBName(event.target.value)} required />
        </label>
        <div className="space-y-2 md:col-span-2">
          <span className="block text-sm font-semibold text-slate-200">점수 입력 방식</span>
          <div className="grid gap-2 rounded-md border border-arena-line bg-black/20 p-1 sm:grid-cols-2">
            {[
              { key: "goals", label: "선수 득점 합산" },
              { key: "manual", label: "팀 점수 직접 입력" }
            ].map((mode) => (
              <button
                key={mode.key}
                className={`rounded px-3 py-2 text-sm font-bold transition ${
                  scoreMode === mode.key ? "bg-arena-lime text-arena-black" : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
                type="button"
                onClick={() => switchScoreMode(mode.key as ScoreMode)}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
        <label className="space-y-2 text-sm font-semibold text-slate-200">
          A팀 점수
          <input
            className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2 text-arena-lime"
            name="teamAScore"
            type="number"
            min="0"
            value={teamAScore}
            readOnly={scoreMode === "goals"}
            onChange={(event) => setTeamAScore(Math.max(0, Number(event.target.value) || 0))}
            required
          />
        </label>
        <label className="space-y-2 text-sm font-semibold text-slate-200">
          B팀 점수
          <input
            className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2 text-arena-cyan"
            name="teamBScore"
            type="number"
            min="0"
            value={teamBScore}
            readOnly={scoreMode === "goals"}
            onChange={(event) => setTeamBScore(Math.max(0, Number(event.target.value) || 0))}
            required
          />
        </label>
      </div>

      <div className="flex rounded-md border border-arena-line bg-black/20 p-1">
        {[
          { key: "manual", label: "수동 팀 선택" },
          { key: "random", label: "랜덤 팀 구성" }
        ].map((tab) => (
          <button
            key={tab.key}
            className={`flex-1 rounded px-3 py-2 text-sm font-bold transition ${
              activeTab === tab.key ? "bg-arena-lime text-arena-black" : "text-slate-300 hover:bg-white/5 hover:text-white"
            }`}
            type="button"
            onClick={() => switchTab(tab.key as FormTab)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {teamAIds.map((playerId) => (
        <input key={`team-a-${playerId}`} name="teamAPlayers" type="hidden" value={playerId} />
      ))}
      {teamBIds.map((playerId) => (
        <input key={`team-b-${playerId}`} name="teamBPlayers" type="hidden" value={playerId} />
      ))}

      {activeTab === "manual" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {(["A", "B"] as const).map((team) => {
            const teamIds = team === "A" ? teamAIds : teamBIds;
            const title = team === "A" ? teamAName || "A팀" : teamBName || "B팀";

            return (
              <div key={team} className="rounded-md border border-arena-line bg-black/20 p-4">
                <h3 className="font-bold text-white">{title} 선수 선택</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {players.map((player) => {
                    const checked = teamIds.includes(player.id);
                    const disabled = selectedIds.has(player.id) && !checked;

                    return (
                      <label key={player.id} className="flex items-center gap-2 rounded-md bg-white/5 px-3 py-2 text-sm text-slate-200">
                        <input checked={checked} disabled={disabled} type="checkbox" value={player.id} onChange={() => togglePlayer(team, player.id)} />
                        <span>{player.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4 rounded-md border border-arena-line bg-black/20 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="font-bold text-white">참가 선수 선택</h3>
              <p className="mt-1 text-sm text-slate-400">짝수 인원을 선택하면 로또 추첨처럼 섞어서 두 팀으로 나눕니다.</p>
            </div>
            <button
              className="rounded-md bg-arena-cyan px-4 py-2 text-sm font-black text-arena-black transition hover:bg-white disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
              disabled={!canDrawTeams}
              type="button"
              onClick={drawRandomTeams}
            >
              {isDrawing ? "추첨 중..." : "랜덤 팀 뽑기"}
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {players.map((player) => (
              <label key={player.id} className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${participantSet.has(player.id) ? "bg-arena-lime text-arena-black" : "bg-white/5 text-slate-200"}`}>
                <input checked={participantSet.has(player.id)} type="checkbox" value={player.id} onChange={() => toggleParticipant(player.id)} />
                <span className="font-semibold">{player.name}</span>
              </label>
            ))}
          </div>

          <div className="rounded-md border border-dashed border-arena-line bg-black/30 p-4">
            {isDrawing ? (
              <div className="flex flex-wrap justify-center gap-3 py-4">
                {drawPreviewPlayers.map((player, index) => (
                  <span key={`${player.id}-${index}`} className="lotto-ball grid h-16 w-16 place-items-center rounded-full bg-arena-lime text-xs font-black text-arena-black shadow-lg shadow-arena-lime/20">
                    {player.name}
                  </span>
                ))}
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <TeamPreview title={teamAName || "A팀"} players={teamAPlayers} />
                <TeamPreview title={teamBName || "B팀"} players={teamBPlayers} />
              </div>
            )}
          </div>

          {!canDrawTeams && !isDrawing ? <p className="text-sm text-slate-400">랜덤 팀 구성은 2명 이상의 짝수 인원을 선택해야 사용할 수 있습니다.</p> : null}
          {hasRandomTeams ? <p className="text-sm font-semibold text-arena-lime">팀 구성이 완료되었습니다. 진행중 경기는 MVP 없이도 먼저 등록할 수 있습니다.</p> : null}
        </div>
      )}

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
                  value={goalsByPlayerId[player.id] ?? 0}
                  onChange={(event) => updatePlayerGoals(player.id, event.target.value)}
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
        {[
          { team: "A" as const, title: teamAName || "A팀", players: teamAPlayers, mvpIds: chairmanTeamMvpIds },
          { team: "B" as const, title: teamBName || "B팀", players: teamBPlayers, mvpIds: managerTeamMvpIds }
        ].map(({ team, title, players: teamPlayers, mvpIds }) => (
          <fieldset key={team} className="rounded-md border border-arena-line bg-black/20 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-200">{title} MVP</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {teamPlayers.length > 0 ? (
                teamPlayers.map((player) => (
                  <label key={player.id} className="flex items-center gap-2 rounded-md bg-white/5 px-3 py-2 text-sm text-slate-200">
                    <input
                      checked={mvpIds.includes(player.id)}
                      name={team === "A" ? "chairmanTeamMvpIds" : "managerTeamMvpIds"}
                      type="checkbox"
                      value={player.id}
                      onChange={() => toggleMvp(team, player.id)}
                    />
                    <span>{player.name}</span>
                  </label>
                ))
              ) : (
                <p className="text-sm text-slate-400">팀 선수를 먼저 선택해주세요.</p>
              )}
            </div>
          </fieldset>
        ))}
      </div>

      <p className="text-sm text-slate-400">
        MVP는 선택사항이며 팀별로 여러 명을 선정할 수 있습니다. 선택하지 않으면 경기 결과에는 MVP가 없음으로 표시됩니다.
      </p>

      <label className="block space-y-2 text-sm font-semibold text-slate-200">
        경기 메모
        <textarea className="min-h-24 w-full rounded-md border border-arena-line bg-black/30 px-3 py-2" name="memo" defaultValue={initialData.memo} />
      </label>

      <button
        className="w-full rounded-md bg-arena-lime px-4 py-3 font-black text-arena-black transition hover:bg-white disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
        disabled={!canSubmit}
        type="submit"
      >
        {submitLabel}
      </button>
    </form>
  );
}

function TeamPreview({ title, players }: { title: string; players: Player[] }) {
  return (
    <div className="rounded-md border border-arena-line bg-black/20 p-4">
      <h4 className="font-bold text-white">
        {title} <span className="text-sm text-slate-400">({players.length}명)</span>
      </h4>
      <div className="mt-3 flex flex-wrap gap-2">
        {players.length > 0 ? (
          players.map((player) => (
            <span key={player.id} className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-slate-100">
              {player.name}
            </span>
          ))
        ) : (
          <span className="text-sm text-slate-400">아직 구성된 선수가 없습니다.</span>
        )}
      </div>
    </div>
  );
}
