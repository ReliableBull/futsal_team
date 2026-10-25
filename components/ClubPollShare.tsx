"use client";
import { useEffect, useRef, useState } from "react";
import { pollShareUrl } from "@/lib/poll-share";

export function ClubPollShare({ path, title, siteUrl, namedVoting = false }: { path: string; title: string; siteUrl?: string; namedVoting?: boolean }) {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { setUrl(pollShareUrl(path, window.location.origin, siteUrl)); }, [path, siteUrl]);
  async function copyLink() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error();
      await navigator.clipboard.writeText(url);
      setMessage("링크를 복사했습니다. 카카오톡이나 문자에 붙여넣어 보내세요.");
    } catch {
      input.current?.focus(); input.current?.select();
      let copied = false;
      try { copied = document.execCommand("copy"); } catch { /* Manual selection remains available. */ }
      setMessage(copied ? "링크를 복사했습니다. 카카오톡이나 문자에 붙여넣어 보내세요." : "아래 주소를 길게 누르거나 선택해 복사해주세요.");
    }
  }
  async function share() {
    if (!navigator.share) { await copyLink(); return; }
    try { await navigator.share({ title, text: namedVoting ? "동호회 투표에 참여해주세요. 로그인 없이 이름을 입력하면 투표할 수 있습니다." : "동호회 투표에 참여해주세요. 회원 계정으로 로그인하면 투표할 수 있습니다.", url }); }
    catch (cause) { if (!(cause instanceof Error && cause.name === "AbortError")) await copyLink(); }
  }
  return <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6" aria-label="투표 공유">
    <h2 className="text-lg font-black text-emerald-950">회원들에게 투표를 알려주세요</h2>
    <p className="mt-2 text-sm leading-7 text-emerald-900">{namedVoting ? "별도의 투표 전용 화면에서 이름을 입력하고 참여합니다. 참여 인원과 투표율은 공개되며, 항목별 결과와 이름별 선택은 관리자만 확인합니다." : "링크를 카카오톡이나 문자로 보내면, 동호회 회원이 로그인 후 바로 참여할 수 있습니다."}</p>
    <div className="mt-4 flex flex-wrap gap-2">{namedVoting && <a href={path} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-emerald-300 bg-white px-5 py-3 text-sm font-bold">참여 화면 열기</a>}<button type="button" disabled={!url} onClick={() => void copyLink()} className="platform-button disabled:opacity-50">투표 링크 복사</button><button type="button" disabled={!url} onClick={() => void share()} className="rounded-xl border border-emerald-300 bg-white px-5 py-3 text-sm font-bold disabled:opacity-50">공유하기</button></div>
    <label className="mt-4 block text-xs font-bold text-emerald-950">공유할 주소<input ref={input} value={url} readOnly onFocus={event => event.currentTarget.select()} className="mt-2 w-full min-w-0 rounded-xl border border-emerald-200 bg-white p-3 text-sm font-normal text-slate-700" /></label>
    <p role="status" className="mt-2 text-sm text-emerald-900">{message}</p>
  </section>;
}
