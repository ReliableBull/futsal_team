"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClubPollView } from "@/lib/club-polls";
import { formatPollDate, pollIsClosed } from "@/lib/poll-validation";
import { PollTurnout } from "./PollTurnout";
import { PollOptionLabel } from "./PollOptionLabel";

export function ClubPollVote({ initial, endpoint }: { initial: ClubPollView; endpoint: string }) {
  const [poll, setPoll] = useState(initial);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmBallot, setConfirmBallot] = useState<string | null>(null);
  const [ballotError, setBallotError] = useState("");
  const [accessLost, setAccessLost] = useState(false);
  const pending = useRef(false);
  const refreshing = useRef(false);
  const revision = useRef(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (refreshing.current) return;
    refreshing.current = true;
    const requestRevision = ++revision.current;
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal });
      const result = await response.json();
      if (requestRevision !== revision.current || signal?.aborted) return;
      if (initial.namedVoting && response.ok && (!result.canManage || !result.canViewResults)) {
        setPoll(result); setAccessLost(true); throw new Error("관리자 권한이 필요합니다. 다시 로그인해주세요.");
      }
      if (!response.ok) {
        if ([401, 403, 404].includes(response.status)) setAccessLost(true);
        throw new Error(result.error);
      }
      if (!signal?.aborted) { setPoll(result); setError(""); setAccessLost(false); setUpdatedAt(new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date())); }
    } catch (cause) { if (!signal?.aborted && requestRevision === revision.current) setError(cause instanceof Error ? cause.message : "연결을 확인해주세요."); }
    finally { refreshing.current = false; }
  }, [endpoint, initial.namedVoting]);
  useEffect(() => {
    const controller = new AbortController();
    const update = () => { if (!document.hidden && !pending.current) void refresh(controller.signal); };
    const timer = window.setInterval(update, initial.namedVoting ? 3000 : 30000);
    window.addEventListener("focus", update);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", update); };
  }, [refresh, initial.namedVoting]);
  async function send(action: "votes" | "close" | "invalidate", body: Record<string, string> = {}) {
    if (pending.current) return;
    pending.current = true; ++revision.current; setBusy(true); setError(""); setBallotError("");
    try {
      const response = await fetch(`${endpoint}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) { await refresh(); throw new Error(result.error || "요청을 처리하지 못했습니다."); }
      setPoll(result); setConfirmClose(false); setConfirmBallot(null);
    } catch (cause) {
      // Ballot errors appear beside the participant table where the action was taken.
      (action === "invalidate" ? setBallotError : setError)(cause instanceof Error ? cause.message : "연결을 확인하고 다시 시도해주세요.");
    }
    finally { pending.current = false; setBusy(false); }
  }
  if (accessLost) return <div role="alert" className="rounded-2xl border border-slate-200 bg-white p-6"><p>{error}</p><a className="mt-4 inline-block text-sm font-bold underline" href={`${initial.namedVoting ? "/abcd/login" : "/login"}?next=${encodeURIComponent(endpoint.replace("/api/polls/", "/polls/"))}`}>다시 로그인하기</a></div>;
  const closed = poll.closed || pollIsClosed(poll);
  const totalVotes = poll.totalVotes ?? 0;
  return <div className="space-y-5">
    {poll.turnout && <PollTurnout turnout={poll.turnout} />}
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3"><span className={`rounded-full px-3 py-1 text-xs font-black ${closed ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-900"}`}>{closed ? "투표 마감" : "투표 진행 중"}</span><span className="text-xs text-slate-500">{poll.closesAt ? `${formatPollDate(poll.closesAt)} 마감 · 한국 시간` : poll.namedVoting ? "관리자가 마감할 때까지" : "회장이 마감할 때까지"}</span></div>
      {!poll.namedVoting && (poll.selectedOptionId ? <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 font-bold text-emerald-900">투표 완료 · 내 선택: {poll.options.find(option => option.id === poll.selectedOptionId)?.label}</p> : closed ? <p className="mt-5 text-sm text-slate-600">마감된 투표입니다. 아래에서 결과를 확인하세요.</p> : <form className="mt-6 space-y-4" onSubmit={event => { event.preventDefault(); void send("votes", { optionId: selected }); }}>
        <fieldset disabled={busy} className="space-y-3"><legend className="mb-4 text-lg font-black">한 가지를 선택해주세요</legend>{poll.options.map(option => <label key={option.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 focus-within:ring-2 focus-within:ring-emerald-600 ${selected === option.id ? "border-emerald-700 bg-emerald-50" : "border-slate-200"}`}><input type="radio" name="optionId" value={option.id} checked={selected === option.id} onChange={() => setSelected(option.id)} required className="h-4 w-4 shrink-0 accent-emerald-700" /><PollOptionLabel option={option} /></label>)}</fieldset>
        <p className="text-xs leading-6 text-slate-500">회원당 한 번 참여할 수 있습니다. 제출 후에는 변경할 수 없습니다.</p>
        <button disabled={busy || !selected} className="platform-button w-full disabled:opacity-40" type="submit">{busy ? "저장하는 중…" : "투표 제출"}</button>
      </form>)}
      {error && <p role="alert" className="mt-4 text-sm font-bold text-red-700">{error}</p>}
    </section>
    {poll.canViewResults && <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
      <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">{closed ? "최종 결과" : "현재 결과"}</h2><button type="button" disabled={busy} onClick={() => void refresh()} className="text-xs font-bold text-slate-500 underline">새로고침</button></div>
      <p className="mt-2 text-sm text-slate-500">총 {totalVotes}명 참여 · {poll.namedVoting ? "관리자 전용 결과" : "개인별 이름과 선택은 공개하지 않습니다."}</p>
      {poll.namedVoting && <p className="mt-2 text-xs text-slate-500">3초마다 자동 갱신{updatedAt ? ` · 최근 갱신 ${updatedAt}` : ""}</p>}
      <div className="mt-6 space-y-5">{poll.options.map(option => {
        const votes = option.votes ?? 0;
        const percent = totalVotes ? Math.round(votes / totalVotes * 100) : 0;
        return <div key={option.id}><div className="mb-2 flex items-center justify-between gap-3 text-sm"><PollOptionLabel option={option} compact /><span className="shrink-0 text-slate-600">{votes}표 · {percent}%</span></div><div role="progressbar" aria-label={`${option.label} 득표율`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-700" style={{ width: `${percent}%` }} /></div></div>;
      })}</div>
    </section>}
    {poll.canManage && poll.namedVoting && poll.participants && <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
      <h2 className="text-xl font-black">이름별 투표 내역</h2><p className="mt-2 text-sm text-slate-500">이름 · 선택 항목 · 제출 시각을 관리자만 확인할 수 있습니다. 중복이거나 잘못된 표는 무효 처리하면 결과와 투표율에서 빠집니다.</p>
      {poll.participants.length ? <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[540px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs text-slate-500"><th scope="col" className="py-3 pr-4">입력한 이름</th><th scope="col" className="py-3 pr-4">선택한 항목</th><th scope="col" className="py-3 pr-4">제출 시각 (한국 시간)</th><th scope="col" className="py-3 text-right">관리</th></tr></thead><tbody>{poll.participants.map(participant => <tr key={participant.id} className="border-b border-slate-100"><td className="break-words py-4 pr-4 font-bold">{participant.name}</td><td className="break-words py-4 pr-4">{participant.optionLabel}</td><td className="py-4 pr-4 text-xs text-slate-500">{formatPollDate(participant.createdAt)}</td><td className="py-4 text-right">{confirmBallot === participant.id
        ? <span className="inline-flex items-center gap-1"><button disabled={busy} type="button" aria-label={`${participant.name}님의 표 무효 확정`} onClick={() => void send("invalidate", { ballotId: participant.id })} className="whitespace-nowrap rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-[#fff] disabled:opacity-50">{busy ? "처리 중…" : "무효 확정"}</button><button disabled={busy} type="button" onClick={() => setConfirmBallot(null)} className="whitespace-nowrap px-2 py-2 text-xs font-bold">취소</button></span>
        : <button disabled={busy} type="button" aria-label={`${participant.name}님의 표 무효 처리`} onClick={() => { setConfirmBallot(participant.id); setBallotError(""); }} className="whitespace-nowrap rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">무효 처리</button>}</td></tr>)}</tbody></table></div> : <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">아직 제출된 투표가 없습니다.</p>}
      {ballotError && <p role="alert" className="mt-4 text-sm font-bold text-red-700">{ballotError}</p>}
      {poll.invalidBallots && poll.invalidBallots.length > 0 && <div className="mt-8">
        <h3 className="text-base font-black">무효 처리한 표 · {poll.invalidBallots.length}건</h3><p className="mt-1 text-xs leading-6 text-slate-500">결과와 투표율에서 제외됩니다. 같은 이름이나 브라우저로 다시 투표할 수 있습니다.</p>
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[540px] text-left text-sm text-slate-500"><thead><tr className="border-b border-slate-200 text-xs"><th scope="col" className="py-3 pr-4">입력한 이름</th><th scope="col" className="py-3 pr-4">선택했던 항목</th><th scope="col" className="py-3 pr-4">제출 시각</th><th scope="col" className="py-3">무효 처리 시각</th></tr></thead><tbody>{poll.invalidBallots.map(ballot => <tr key={ballot.id} className="border-b border-slate-100"><td className="break-words py-3 pr-4 font-bold line-through">{ballot.name}</td><td className="break-words py-3 pr-4 line-through">{ballot.optionLabel}</td><td className="py-3 pr-4 text-xs">{formatPollDate(ballot.createdAt)}</td><td className="py-3 text-xs">{formatPollDate(ballot.invalidatedAt)}</td></tr>)}</tbody></table></div>
      </div>}
    </section>}
    {poll.canManage && !closed && <section className="rounded-2xl border border-slate-200 bg-white p-5">
      {confirmClose ? <div><p className="text-sm font-bold">투표를 마감할까요? 마감하면 추가 투표를 받거나 다시 열 수 없습니다.</p><div className="mt-4 flex gap-3"><button disabled={busy} type="button" onClick={() => void send("close")} className="rounded-xl bg-red-700 px-4 py-3 text-sm font-bold text-[#fff] disabled:opacity-50">{busy ? "마감 중…" : "마감 확정"}</button><button disabled={busy} type="button" onClick={() => setConfirmClose(false)} className="px-4 py-3 text-sm font-bold">취소</button></div></div> : <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">{poll.namedVoting ? "관리자" : "회장(운영자)"}는 언제든 투표를 마감할 수 있습니다.</p><button disabled={busy} type="button" onClick={() => setConfirmClose(true)} className="rounded-xl border border-red-200 px-4 py-3 text-sm font-bold text-red-700">투표 마감하기</button></div>}
    </section>}
  </div>;
}
