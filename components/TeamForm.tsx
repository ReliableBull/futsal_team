"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { TeamFormState } from "@/lib/team-validation";

type TeamFields = { name: string; slug: string; region: string; description: string; color: string; sport: string; schedule: string; recruiting: boolean; joinUrl: string };
function Submit({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="platform-button w-full disabled:opacity-50" type="submit">{pending ? "저장하는 중…" : editing ? "팀 정보 저장" : "우리 팀 시작하기 →"}</button>;
}
export function TeamForm({ action, signedIn, initial }: { action: (state: TeamFormState, form: FormData) => Promise<TeamFormState>; signedIn: boolean; initial?: TeamFields }) {
  const [state, formAction] = useFormState(action, {});
  return <form action={formAction} className="space-y-6">
    {state.error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">{state.error}</p>}
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="platform-label">팀 이름<input className="platform-input" name="name" placeholder="예: 한강 FC" minLength={2} maxLength={60} defaultValue={initial?.name} required /></label>
      <label className="platform-label">활동 지역<input className="platform-input" name="region" placeholder="예: 서울 마포구" maxLength={60} defaultValue={initial?.region} /></label>
    </div>
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="platform-label">주요 종목<select className="platform-input" name="sport" defaultValue={initial?.sport || "FUTSAL"}><option value="FUTSAL">풋살</option><option value="FOOTBALL">축구</option><option value="BOTH">축구 · 풋살 모두</option></select></label>
      <label className="platform-label">정기 모임<input className="platform-input" name="schedule" placeholder="예: 매주 토요일 오전 9시" maxLength={100} defaultValue={initial?.schedule} /></label>
    </div>
    <div className="space-y-4 rounded-xl bg-slate-50 p-4">
      <label className="flex items-center gap-3 text-sm font-bold"><input className="h-4 w-4 accent-emerald-700" name="recruiting" type="checkbox" defaultChecked={initial?.recruiting} />새 회원을 모집하고 있어요</label>
      <label className="platform-label">가입 문의 링크 (선택)<input className="platform-input" name="joinUrl" type="url" placeholder="https://open.kakao.com/…" maxLength={300} defaultValue={initial?.joinUrl} /><span className="text-xs font-normal leading-5 text-slate-500">모집 중일 때 동호회 소개에 표시할 오픈채팅이나 가입 신청 링크입니다.</span></label>
    </div>
    <label className="platform-label">팀 주소<div className="flex items-center gap-2"><span className="text-sm font-normal text-slate-400">/t/</span><input className="platform-input" name="slug" placeholder="hangang-fc" minLength={3} maxLength={48} pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={initial?.slug} readOnly={Boolean(initial)} required /></div><span className="text-xs font-normal text-slate-500">영문 소문자, 숫자, 하이픈을 사용합니다. 만든 뒤에도 같은 주소를 유지합니다.</span></label>
    <label className="platform-label">팀 소개<textarea className="platform-input min-h-24 resize-y" name="description" placeholder="어떤 팀인가요? 함께 뛰는 우리 팀을 소개해주세요." maxLength={300} defaultValue={initial?.description} /></label>
    <label className="platform-label">팀 색상<input className="h-11 w-20 cursor-pointer rounded-lg border border-slate-200 bg-white p-1" type="color" name="color" defaultValue={initial?.color || "#e53935"} /></label>
    {!signedIn && <fieldset className="space-y-5 border-t border-slate-200 pt-6"><legend className="pr-3 text-base font-black">계정 만들기</legend><p className="text-sm text-slate-500">동호회를 만들면 회장(운영자)이 되어 선수와 경기를 관리합니다. 기록은 팀 주소로 누구나 볼 수 있습니다.</p><label className="platform-label">아이디<input className="platform-input" name="username" autoComplete="username" minLength={3} maxLength={32} pattern="[a-zA-Z0-9_-]+" required /></label><label className="platform-label">비밀번호<input className="platform-input" name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required /><span className="text-xs font-normal text-slate-500">10자 이상 입력해주세요.</span></label><a href="/login" className="inline-block text-sm font-bold text-red-600 underline">이미 계정이 있나요? 로그인</a></fieldset>}
    <Submit editing={Boolean(initial)} />
  </form>;
}
