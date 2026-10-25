"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClubPollView } from "@/lib/club-polls";
import { formatPollDate, pollIsClosed } from "@/lib/poll-validation";
import { PollTurnout } from "./PollTurnout";
import { PollOptionLabel } from "./PollOptionLabel";

export function StandalonePollVote({ initial, endpoint }: { initial: ClubPollView; endpoint: string }) {
  const [poll, setPoll] = useState(initial);
  const [name, setName] = useState("");
  const [optionId, setOptionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const refreshing = useRef(false);
  const revision = useRef(0);
  const [refreshError, setRefreshError] = useState("");
  const refresh = useCallback(async (signal: AbortSignal) => {
    if (pending.current || refreshing.current) return;
    refreshing.current = true;
    const requestRevision = revision.current;
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal });
      if (!response.ok) throw new Error();
      const next: ClubPollView = await response.json();
      if (!signal.aborted && requestRevision === revision.current && !pending.current) {
        // A slow refresh must never undo a successful submission in this tab.
        setPoll(current => ({ ...next, selectedOptionId: current.id === next.id ? current.selectedOptionId ?? next.selectedOptionId : next.selectedOptionId }));
        setRefreshError("");
      }
    } catch {
      if (!signal.aborted && requestRevision === revision.current) setRefreshError("참여 현황을 갱신하지 못했습니다. 연결되면 자동으로 다시 갱신합니다.");
    } finally { refreshing.current = false; }
  }, [endpoint]);
  useEffect(() => {
    const controller = new AbortController();
    const update = () => { if (!document.hidden) void refresh(controller.signal); };
    const timer = window.setInterval(update, 3000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", update); };
  }, [refresh]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || poll.selectedOptionId) return;
    pending.current = true; ++revision.current; setBusy(true); setError("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, optionId }) });
      const result = await response.json();
      if (!response.ok) {
        // Recover this browser's receipt or a closed poll after a failed submit.
        const current = await fetch(endpoint, { cache: "no-store" });
        if (current.ok) setPoll(await current.json());
        throw new Error(result.error || "투표를 제출하지 못했습니다.");
      }
      setPoll(result); setRefreshError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "연결을 확인하고 다시 시도해주세요."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="space-y-6">
    <header><p className="text-xs font-bold tracking-widest text-emerald-700">의견을 들려주세요</p><h1 className="mt-3 break-words text-2xl font-black leading-snug sm:text-3xl">{poll.title}</h1>{poll.description && <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">{poll.description}</p>}</header>
    {poll.turnout && <PollTurnout turnout={poll.turnout} />}
    {refreshError && <p role="status" className="text-xs text-slate-500">{refreshError}</p>}
    {poll.selectedOptionId ? <section role="status" className="rounded-2xl border border-emerald-200 bg-white p-7 text-center shadow-sm"><span aria-hidden="true" className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-2xl text-emerald-800">✓</span><h2 className="mt-5 text-2xl font-black">투표가 완료되었습니다</h2><p className="mt-4 text-sm leading-7 text-slate-600">제출한 내용은 변경하거나 다시 제출할 수 없습니다.<br />참여해주셔서 감사합니다. 이 창을 닫으셔도 됩니다.</p></section>
      : pollIsClosed(poll) ? <section role="status" className="rounded-2xl border border-slate-200 bg-white p-7"><h2 className="text-xl font-black">접수가 마감되었습니다</h2><p className="mt-3 text-sm text-slate-600">더 이상 투표를 제출할 수 없습니다.</p></section>
      : <form onSubmit={submit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        {poll.closesAt && <p className="text-xs text-slate-500">제출 기한: {formatPollDate(poll.closesAt)} · 한국 시간</p>}
        <label className="platform-label">참여자 이름<input name="voterName" className="platform-input" autoComplete="name" placeholder="본인 이름을 입력해주세요" value={name} onChange={event => setName(event.target.value)} required minLength={2} maxLength={40} disabled={busy} /><span className="block text-xs font-normal leading-6 text-slate-500">동명이인은 운영자와 상의해 구분할 이름을 사용해주세요.</span></label>
        <fieldset disabled={busy} className="space-y-3"><legend className="mb-3 text-sm font-bold">한 가지를 선택해주세요</legend>{poll.options.some(option => option.playerId) && <p className="text-xs leading-6 text-slate-500">시즌 기록은 투표를 만든 {formatPollDate(poll.createdAt)} 기준입니다.</p>}{poll.options.map(option => <label key={option.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 focus-within:ring-2 focus-within:ring-emerald-600 ${optionId === option.id ? "border-emerald-700 bg-emerald-50" : "border-slate-200"}`}><input type="radio" name="optionId" value={option.id} checked={optionId === option.id} onChange={() => setOptionId(option.id)} required className="h-4 w-4 shrink-0 accent-emerald-700" /><PollOptionLabel option={option} /></label>)}</fieldset>
        <p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">입력한 이름과 선택은 관리자만 확인합니다. 제출 후에는 수정하거나 다시 투표할 수 없으니 내용을 확인해주세요.</p>
        {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
        <button type="submit" disabled={busy || !name.trim() || !optionId} className="platform-button w-full disabled:opacity-40">{busy ? "제출하는 중…" : "투표 제출"}</button>
      </form>}
    <p className="text-center text-xs leading-6 text-slate-500">참여 인원과 투표율만 공개됩니다. 항목별 결과와 이름별 선택은 관리자만 확인할 수 있습니다.</p>
  </div>;
}
