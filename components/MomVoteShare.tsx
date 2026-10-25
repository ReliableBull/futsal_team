"use client";
import { useTeamPath } from "@/components/TeamProvider";

import Link from "@/components/TeamLink";
import { useEffect, useRef, useState } from "react";

export function MomVoteShare({ matchId }: { matchId: number }) {
  const scopedPath = useTeamPath();
  const [message, setMessage] = useState("");
  const [manualLink, setManualLink] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const path = scopedPath(`/matches/${matchId}/mom-vote`);
  useEffect(() => { if (manualLink) { input.current?.focus(); input.current?.select(); } }, [manualLink]);

  async function copyLink() {
    // Use the configured reachable address when a manager opens localhost.
    const url = new URL(path, process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).href;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setManualLink("");
      setMessage("투표 링크를 복사했습니다. 카카오톡이나 문자에 붙여넣어 보내세요.");
    } catch {
      setManualLink(url);
      setMessage("아래 투표 링크를 길게 누르거나 선택해서 복사해주세요.");
    }
  }

  return (
    <section aria-label="MOM 투표 공유" className="rounded-xl border border-red-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black tracking-widest text-arena-red">MOM VOTE · 투표 진행 중</p>
          <h2 className="mt-2 text-xl font-black text-slate-900">오늘의 MOM을 함께 뽑아주세요</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">로그인 없이 각 팀에서 1명씩 선택합니다. 경기별로 같은 IP에서는 한 번만 투표할 수 있습니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={path} className="rounded-lg bg-arena-red px-4 py-3 text-sm font-black text-[#fff] hover:bg-red-600">MOM 투표하기</Link>
          <button type="button" onClick={() => void copyLink()} className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50">투표 링크 복사</button>
        </div>
      </div>
      <p role="status" className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
      {manualLink && <label className="mt-2 block text-xs font-bold text-slate-600">공유할 투표 링크<input ref={input} readOnly value={manualLink} onFocus={(event) => event.currentTarget.select()} className="mt-2 w-full rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm font-normal text-slate-900" /></label>}
    </section>
  );
}
