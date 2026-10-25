"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PollCandidate } from "@/lib/poll-candidates";
import { PollOptionLabel } from "./PollOptionLabel";

type DraftOption = { label: string; playerId?: number };
const defaultOptions: DraftOption[] = [{ label: "찬성" }, { label: "반대" }];

export function ClubPollCreateForm({ base, namedVoting = false, candidates = [], maxOptions = 10 }: { base: string; namedVoting?: boolean; candidates?: PollCandidate[]; maxOptions?: number }) {
  const router = useRouter();
  const [options, setOptions] = useState(defaultOptions);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const byId = new Map(candidates.map(candidate => [candidate.id, candidate]));
  const chosen = new Set(options.flatMap(option => option.playerId ? [option.playerId] : []));
  const matches = candidates.filter(candidate => candidate.name.includes(query.trim()));
  function addCandidates(list: PollCandidate[]) {
    // Untouched 찬성/반대 defaults give way to the first roster candidates.
    const current = options === defaultOptions ? [] : options;
    const added = list.filter(candidate => !chosen.has(candidate.id)).map(candidate => ({ label: candidate.name, playerId: candidate.id }));
    if (current.length + added.length > maxOptions) { setError(`선택지는 최대 ${maxOptions}개까지 추가할 수 있습니다.`); return; }
    setError(""); setOptions([...current, ...added]);
  }
  function removeCandidates(ids: Set<number>) {
    const next = options.filter(option => !option.playerId || !ids.has(option.playerId));
    setOptions(next.length ? next : defaultOptions);
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const form = new FormData(event.currentTarget);
    const deadline = String(form.get("closesAt") || "");
    pending.current = true; setBusy(true); setError("");
    try {
      const response = await fetch(base.replace(/\/polls$/, "/api/polls"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        title: form.get("title"), description: form.get("description"),
        options: options.map(option => option.playerId ? { playerId: option.playerId } : option.label),
        closesAt: deadline ? `${deadline}:00+09:00` : null
      }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "투표를 만들지 못했습니다.");
      router.push(`${base}/${result.id}`); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "연결을 확인하고 다시 시도해주세요."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
    <fieldset disabled={busy} className="space-y-6">
      <label className="platform-label">투표 제목<input className="platform-input" name="title" placeholder="예: 다음 정기 모임은 언제 할까요?" required minLength={2} maxLength={120} /></label>
      <label className="platform-label">설명 (선택)<textarea className="platform-input min-h-28" name="description" placeholder="회원들이 결정할 때 참고할 내용을 적어주세요." maxLength={2000} /></label>
      <div><h2 className="text-sm font-bold">선택지 <span className="font-normal text-slate-500">2~{maxOptions}개 · 한 가지 선택</span></h2>
        {namedVoting && candidates.length > 0 && <div className="mt-3 rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold">활성 회원에서 후보 고르기 <span className="font-normal text-slate-500">{chosen.size}/{candidates.length}명</span></h3>
            <div className="flex gap-4 text-xs font-bold"><button type="button" onClick={() => addCandidates(candidates)} className="text-emerald-800">전체 추가</button><button type="button" disabled={!chosen.size} onClick={() => removeCandidates(new Set(chosen))} className="text-slate-500 disabled:opacity-40">후보 모두 빼기</button></div></div>
          <p className="mt-1 text-xs leading-6 text-slate-500">시즌 MVP·회장 선출처럼 회원을 뽑을 때 사용합니다. 선택한 회원은 투표 화면에 사진과 시즌 기록이 함께 표시되며, 기록은 투표를 만드는 시점 기준으로 저장됩니다.</p>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }} placeholder="이름 검색" aria-label="후보 이름 검색" className="platform-input mt-3" />
          <ul className="mt-3 max-h-96 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">{matches.map(candidate => <li key={candidate.id}><label className="flex cursor-pointer items-center gap-3 p-3 hover:bg-slate-50"><input type="checkbox" checked={chosen.has(candidate.id)} onChange={event => event.target.checked ? addCandidates([candidate]) : removeCandidates(new Set([candidate.id]))} className="h-4 w-4 shrink-0 accent-emerald-700" /><PollOptionLabel option={{ label: candidate.name, detail: `#${candidate.number ?? "-"} · ${candidate.position} · ${candidate.detail}`, playerId: candidate.id, profileImageUrl: candidate.profileImageUrl }} compact /></label></li>)}
            {!matches.length && <li className="p-4 text-sm text-slate-500">검색 결과가 없습니다.</li>}</ul>
        </div>}
        <div className="mt-3 space-y-3">{options.map((option, index) => <div key={option.playerId ? `player-${option.playerId}` : `text-${index}`} className="flex items-end gap-2">
          {option.playerId
            ? <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3"><span className="mb-2 block text-xs text-slate-500">선택지 {index + 1} · 회원 후보</span><PollOptionLabel option={{ label: option.label, playerId: option.playerId, detail: byId.get(option.playerId)?.detail, profileImageUrl: byId.get(option.playerId)?.profileImageUrl }} /></div>
            : <label className="platform-label flex-1"><span className="text-xs text-slate-500">선택지 {index + 1}</span><input className="platform-input" value={option.label} onChange={event => setOptions(current => current.map((value, i) => i === index ? { label: event.target.value } : value))} required maxLength={120} /></label>}
          {options.length > 2 && <button className="rounded-xl border border-slate-300 px-3 py-3 text-sm" type="button" aria-label={`선택지 ${index + 1} 삭제`} onClick={() => setOptions(current => current.filter((_, i) => i !== index))}>삭제</button>}
        </div>)}</div>
        <button type="button" disabled={options.length >= maxOptions} onClick={() => setOptions(current => [...current, { label: "" }])} className="mt-3 text-sm font-bold text-emerald-800 disabled:opacity-40">{candidates.length ? "+ 직접 입력 선택지 추가" : "+ 선택지 추가"}</button>
      </div>
      <label className="platform-label">마감 일시 (선택 · 한국 시간)<input type="datetime-local" step="60" name="closesAt" className="platform-input" /><span className="block text-xs font-normal leading-6 text-slate-500">비워두면 {namedVoting ? "관리자" : "회장"}가 직접 마감할 때까지 진행됩니다.</span></label>
      <p className="rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">{namedVoting ? "링크를 받은 사람이 로그인 없이 이름을 적고 참여합니다. 같은 이름과 브라우저의 중복 참여를 제한하며, 본인 인증은 하지 않습니다. 중복이거나 잘못된 표는 관리자가 무효 처리할 수 있습니다." : "회장과 일반 회원 모두 한 번씩 참여합니다."} 제출한 선택과 개설한 투표 내용은 변경할 수 없습니다. {namedVoting ? "결과와 이름별 선택 내역은 관리자만 확인하며, 참여자에게는 공개되지 않습니다." : "결과는 이름 없이 합계로 표시됩니다."}</p>
      {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
      <button className="platform-button w-full disabled:opacity-50" type="submit">{busy ? "만드는 중…" : "투표 만들기"}</button>
    </fieldset>
  </form>;
}
