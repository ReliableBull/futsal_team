"use client";

import { useEffect, useRef, useState } from "react";
import { CardImageSave } from "@/components/CardImageSave";
import { drawMatchShareCard, matchShareTitle, type MatchShareData } from "@/lib/match-share-card";

export function MatchShareCard({ data }: { data: MatchShareData }) {
  const [open, setOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imageError, setImageError] = useState("");
  const [message, setMessage] = useState("");
  const [manualLink, setManualLink] = useState("");
  const [retry, setRetry] = useState(0);
  const manualInput = useRef<HTMLInputElement>(null);
  const filename = `arena-fc-${data.date}-match-${data.id}.png`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let objectUrl = "";
    setImageUrl("");
    setImageBlob(null);
    setImageError("");
    async function render() {
      try {
        await document.fonts.ready;
        if (cancelled) return;
        const canvas = document.createElement("canvas");
        drawMatchShareCard(canvas, data);
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("이미지 생성 실패")), "image/png"));
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
        setImageBlob(blob);
      } catch {
        if (!cancelled) setImageError("공유 카드를 만들지 못했습니다. 다시 시도해주세요.");
      }
    }
    void render();
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [open, data, retry]);

  useEffect(() => {
    if (manualLink) { manualInput.current?.focus(); manualInput.current?.select(); }
  }, [manualLink]);

  async function copyLink() {
    const url = new URL(`/matches/${data.id}`, window.location.origin).href;
    setMessage("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setManualLink("");
      setMessage("경기 링크를 복사했습니다.");
    } catch {
      setManualLink(url);
      setMessage("아래 경기 링크를 선택해 직접 복사해주세요.");
    }
  }

  return (
    <section aria-labelledby="match-share-title" className="rounded-xl border border-arena-line bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="match-share-title" className="text-xl font-black text-slate-900">경기 결과 공유</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">스코어·득점·도움·MOM을 한 장에 담아 공유하세요.{!data.completed && " 진행 중인 경기임을 카드에 표시합니다."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="match-share-preview" className="rounded-lg bg-arena-red px-4 py-2.5 text-sm font-black text-[#fff] hover:bg-red-600">
            {open ? "미리보기 닫기" : "카드 미리보기"}
          </button>
          <button type="button" onClick={copyLink} className="rounded-lg border border-arena-line px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">경기 링크 복사</button>
        </div>
      </div>
      <p role="status" className="mt-2 text-sm text-slate-600">{message}</p>
      {manualLink && (
        <label className="mt-3 block text-sm font-bold text-slate-700">경기 링크
          <input ref={manualInput} type="text" readOnly value={manualLink} onFocus={(event) => event.currentTarget.select()} className="mt-2 w-full rounded-lg border border-arena-line bg-slate-50 p-3 font-normal" />
        </label>
      )}
      {open && (
        <div id="match-share-preview" className="mt-5 border-t border-arena-line pt-5">
          {imageError ? (
            <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
              <p>{imageError}</p><button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-2 font-bold underline">다시 만들기</button>
            </div>
          ) : imageUrl && imageBlob ? (
            <>
              <div className="mx-auto mb-4 max-w-[540px]">
                <CardImageSave key={imageUrl} blob={imageBlob} imageUrl={imageUrl} filename={filename} title={matchShareTitle(data)} downloadLabel="PNG 이미지 저장" />
              </div>
              {/* A local blob URL preserves the exact canvas rendering and supports long-press saving. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt={`${matchShareTitle(data)} · 팀별 출전 선수의 득점·도움·MOM 공유 카드`} className="mx-auto h-auto w-full max-w-[540px] rounded-lg shadow-lg" />
            </>
          ) : <p role="status" className="rounded-lg bg-slate-50 p-8 text-center text-sm text-slate-500">공유 카드를 만들고 있습니다.</p>}
        </div>
      )}
    </section>
  );
}
