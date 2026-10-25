"use client";
import { useTeamPath } from "@/components/TeamProvider";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MomPoll } from "@/lib/mom-vote-types";

export function MomVoteForm({ matchId }: { matchId: number }) {
  const scopedPath = useTeamPath();
  const [poll, setPoll] = useState<MomPoll | null>(null);
  const [selected, setSelected] = useState<{ A?: number; B?: number }>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const pending = useRef(false);
  const endpoint = scopedPath(`/api/matches/${matchId}/mom-vote`);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "투표 정보를 불러오지 못했습니다.");
      if (!signal?.aborted) setPoll(result);
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "투표 정보를 불러오지 못했습니다.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [endpoint]);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const timer = window.setInterval(() => { if (!document.hidden && !pending.current) void refresh(controller.signal); }, 30000);
    const focus = () => { if (!pending.current) void refresh(controller.signal); };
    window.addEventListener("focus", focus);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", focus); };
  }, [refresh]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !selected.A || !selected.B) return;
    pending.current = true; setBusy(true); setError("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamAPlayerId: selected.A, teamBPlayerId: selected.B }) });
      const result = await response.json();
      if (!response.ok) {
        await refresh();
        throw new Error(result.error || "투표하지 못했습니다. 다시 시도해주세요.");
      }
      setSubmitted(true);
      setPoll((current) => current ? { ...current, hasVoted: true } : current);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "연결을 확인한 뒤 다시 시도해주세요."); }
    finally { pending.current = false; setBusy(false); }
  }

  if (loading) return <p role="status" className="rounded-xl border border-arena-line bg-white p-6 text-slate-600">출전 선수와 투표 상태를 확인하고 있습니다.</p>;
  if (!poll) return <div role="alert" className="rounded-xl border border-arena-line bg-white p-6"><p>{error}</p><button type="button" onClick={() => { setLoading(true); setError(""); void refresh(); }} className="mt-4 rounded-lg bg-slate-900 px-4 py-3 font-bold text-[#fff]">다시 불러오기</button></div>;
  if (poll.status !== "IN_PROGRESS") return <div role="status" className="rounded-xl border border-arena-line bg-white p-6"><h2 className="text-xl font-black">투표가 마감되었습니다</h2><p className="mt-2 text-sm leading-6 text-slate-600">경기 결과가 등록되어 더 이상 투표할 수 없습니다. 최종 MOM은 운영자가 확정합니다.</p></div>;
  if (poll.hasVoted || submitted) return <div role="status" className="rounded-xl border border-green-200 bg-white p-6"><h2 className="text-xl font-black text-green-800">{submitted ? "MOM 투표가 완료되었습니다" : "이미 투표를 하셨습니다."}</h2>{submitted && <p className="mt-2 text-sm leading-6 text-slate-600">두 팀의 선택을 모두 저장했습니다. 최종 MOM은 운영자가 투표 결과를 보고 확정합니다.</p>}</div>;
  const valid = poll.teams.every((team) => team.players.some((player) => player.id === selected[team.key]));
  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        {poll.teams.map((team) => <fieldset key={team.key} disabled={busy} className="min-w-0 rounded-xl border border-arena-line bg-white p-5">
          <legend className="px-2 text-lg font-black text-slate-900">{team.name} MOM · 1명 선택</legend>
          <div className="space-y-2">
            {team.players.map((player) => <label key={player.id} className={`flex min-h-20 cursor-pointer items-center gap-3 rounded-lg border-2 p-3 focus-within:ring-2 focus-within:ring-arena-red ${selected[team.key] === player.id ? "border-arena-red bg-red-50" : "border-slate-200 hover:border-slate-400"}`}>
              <input type="radio" name={`mom-${team.key}`} value={player.id} checked={selected[team.key] === player.id} onChange={() => setSelected((current) => ({ ...current, [team.key]: player.id }))} aria-label={`${team.name} ${player.name}`} className="h-4 w-4 shrink-0 accent-arena-red" required />
              <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-slate-100 text-lg font-black text-slate-600">{player.number ?? "–"}</span>
              <span className="min-w-0"><span className="block break-keep font-black text-slate-900">{player.name}</span><span className="mt-1 block text-xs text-slate-500">{player.goals}골 · {player.assists}도움</span></span>
              {selected[team.key] === player.id && <span className="ml-auto shrink-0 text-xs font-bold text-arena-red">선택</span>}
            </label>)}
            {!team.players.length && <p className="py-4 text-sm text-slate-600">아직 출전 선수가 등록되지 않았습니다.</p>}
          </div>
        </fieldset>)}
      </div>
      <div className="rounded-xl border border-arena-line bg-white p-5">
        <h2 className="font-black">선택한 MOM</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">{poll.teams.map((team) => <li key={team.key}>{team.name}: <strong>{team.players.find((p) => p.id === selected[team.key])?.name ?? "선수를 선택해주세요"}</strong></li>)}</ul>
        <p className="mt-4 text-xs leading-6 text-slate-500">제출 후에는 선택을 바꿀 수 없습니다. 같은 와이파이를 사용하는 사람들은 한 번의 투표만 가능할 수 있습니다. IP는 원문 대신 중복 확인용 값으로 변환해 저장합니다.</p>
        {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
        <button type="submit" disabled={busy || !valid} className="mt-4 w-full rounded-lg bg-arena-red px-5 py-4 font-black text-[#fff] hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-45">{busy ? "투표 저장 중…" : "두 팀의 MOM 투표하기"}</button>
      </div>
    </form>
  );
}
