"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SavedImage = { url: string; expiresAt: number };

export function CardImageSave({ blob, imageUrl, filename, title, downloadLabel }: { blob: Blob; imageUrl: string; filename: string; title: string; downloadLabel: string }) {
  const file = useMemo(() => typeof File === "undefined" ? null : new File([blob], filename, { type: "image/png" }), [blob, filename]);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<SavedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [canShare, setCanShare] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const sharing = useRef(false);
  const mounted = useRef(true);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mounted.current = true;
    try { setCanShare(Boolean(file && typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] }))); } catch { setCanShare(false); }
    return () => { mounted.current = false; controller.current?.abort(); };
  }, [file]);

  useEffect(() => {
    if (open) { panel.current?.focus({ preventScroll: true }); panel.current?.scrollIntoView({ block: "nearest" }); }
  }, [open]);

  useEffect(() => {
    if (!saved) return;
    const timeout = window.setTimeout(() => { setSaved(null); setError("저장 시간이 만료되었습니다. 이미지를 다시 준비해주세요."); }, Math.max(0, saved.expiresAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [saved]);

  async function prepareImage() {
    setOpen(true);
    setError("");
    if (saved && saved.expiresAt > Date.now()) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    try {
      const response = await fetch(`/api/card-images?filename=${encodeURIComponent(filename)}`, { method: "POST", headers: { "Content-Type": "image/png" }, body: blob, signal: request.signal });
      if (!response.ok) throw new Error("Image upload failed");
      const result: SavedImage = await response.json();
      if (!request.signal.aborted) setSaved(result);
    } catch {
      if (!request.signal.aborted) setError("저장용 이미지를 준비하지 못했습니다. 다시 시도해주세요.");
    } finally { if (!request.signal.aborted) setBusy(false); }
  }

  async function savePhoto() {
    if (sharing.current) return;
    if (canShare && file) {
      sharing.current = true;
      setBusy(true);
      try {
        // The File is ready before the tap. Call share before any await/network request
        // so Safari retains the user activation required to open the native sheet.
        await navigator.share({ files: [file], title });
      } catch (cause) {
        const cancelled = typeof cause === "object" && cause !== null && "name" in cause && cause.name === "AbortError";
        if (mounted.current && !cancelled) await prepareImage();
      } finally { sharing.current = false; if (mounted.current) setBusy(false); }
    } else { await prepareImage(); }
  }

  function closePanel() { controller.current?.abort(); setOpen(false); setBusy(false); }

  return (
    <div className="space-y-3">
      <a href={imageUrl} download={filename} onClick={(event) => {
        if (busy) { event.preventDefault(); return; }
        const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 0 && window.matchMedia("(pointer: coarse)").matches);
        if (mobile) { event.preventDefault(); void savePhoto(); }
      }} className="block rounded-lg bg-slate-900 px-5 py-3.5 text-center text-sm font-black text-[#fff] hover:bg-slate-700" aria-disabled={busy}>{downloadLabel}</a>
      <button type="button" onClick={() => void savePhoto()} disabled={busy} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50">
        {busy ? "저장 준비 중…" : canShare ? "사진으로 저장 / 공유" : "사진으로 저장"}
      </button>
      {open && (
        <div ref={panel} tabIndex={-1} role="region" aria-label="사진 저장 안내" className="scroll-mt-24 space-y-3 rounded-lg border border-slate-300 bg-white p-4 text-sm text-slate-700 outline-none">
          <div className="flex items-center justify-between gap-3"><p className="font-black text-slate-900">사진으로 저장하기</p><button type="button" onClick={closePanel} className="shrink-0 text-xs font-bold underline">저장 안내 닫기</button></div>
          {error ? <div role="alert"><p>{error}</p><button type="button" onClick={() => void prepareImage()} className="mt-2 font-bold underline">이미지 다시 준비</button></div> : saved ? (
            <>
              <p className="text-xs leading-5">아래 이미지를 길게 눌러 ‘사진에 저장’ 또는 ‘이미지 다운로드’를 선택하세요.</p>
              {/* A real same-origin PNG URL supports mobile image menus even over HTTP. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={saved.url} alt={`${title} 저장용 이미지`} onError={() => { setSaved(null); setError("이미지를 불러오지 못했습니다. 다시 준비해주세요."); }} className="mx-auto h-auto w-full max-w-[400px] rounded-lg" />
              <div className="flex flex-wrap gap-2">
                <a href={`${saved.url}?download=1`} download={filename} className="rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-[#fff]">PNG 파일 받기</a>
                <a href={saved.url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-bold">이미지 크게 열기</a>
              </div>
              <p className="text-xs leading-5 text-slate-500">저장 메뉴가 나오지 않으면 브라우저 메뉴에서 Safari나 Chrome으로 열어주세요.</p>
            </>
          ) : <p role="status" className="text-xs leading-5">저장용 이미지를 준비하고 있습니다…</p>}
        </div>
      )}
    </div>
  );
}
