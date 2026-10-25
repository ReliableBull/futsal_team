"use client";
import { useTeam } from "@/components/TeamProvider";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { CardImageSave } from "@/components/CardImageSave";
import { drawPlayerCard, loadPlayerCardPhoto, playerCardThemes, type PlayerCardData, type PlayerCardTheme } from "@/lib/player-card";
import { getPlayerCardPhotos, type PlayerCardPhoto } from "@/lib/player-card-photos";

function DesignSwatch({ theme }: { theme: (typeof playerCardThemes)[number] }) {
  const editorial = theme.id === "editorial";
  const noir = theme.id === "noir";
  const archive = theme.id === "archive";
  const ink = editorial ? "#20221f" : "#f2f0dc";
  return (
    <svg viewBox="0 0 54 72" className="w-10 shrink-0 rounded-sm shadow-sm sm:w-12" aria-hidden="true" focusable="false">
      <rect width="54" height="72" fill={theme.background} />
      <rect x="2" y="2" width="50" height="68" fill="none" stroke={theme.muted} strokeOpacity=".35" strokeWidth=".3" />
      <text x="4" y="8" fill={ink} fontFamily={noir || archive ? "Georgia, serif" : "sans-serif"} fontSize="4" fontWeight="bold">ARENA</text>
      {editorial && <text x="3" y="20" fill={ink} fontSize="12" fontWeight="900" fontFamily="sans-serif">ARENA</text>}
      <rect x={noir ? 5 : 26} y={noir ? 12 : 11} width={noir ? 44 : 24} height="29" rx={archive ? 12 : 0} fill={theme.panel} />
      <circle cx={noir ? 27 : 38} cy="22" r="6" fill={theme.muted} opacity=".75" />
      <path d={noir ? "M 11 40 Q 11 27 27 27 Q 43 27 43 40 Z" : "M 28 40 Q 28 28 38 28 Q 48 28 48 40 Z"} fill={theme.muted} opacity=".55" />
      {!noir && <text x="4" y="34" fill={archive ? theme.accent : ink} fontSize="12" fontFamily={archive ? "Georgia, serif" : "sans-serif"}>01</text>}
      {archive && <path d="M 0 43 L 54 41 L 54 48 L 0 50 Z" fill={theme.panel} />}
      <rect x={noir ? 18 : 4} y="44" width="16" height="3" fill={archive ? theme.background : ink} />
      {[0, 1, 2, 3, 4, 5].map((index) => <rect key={index} x={7 + index % 3 * 16} y={53 + Math.floor(index / 3) * 8} width="7" height="3" fill={editorial || noir || archive ? ink : theme.accent} />)}
      <path d="M 4 67 H 50" stroke={theme.muted} strokeWidth=".35" strokeDasharray={archive ? "1 1" : undefined} />
    </svg>
  );
}

export function PlayerShareCard({ data }: { data: PlayerCardData }) {
  const team = useTeam();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<PlayerCardTheme>("arena");
  const photos = useMemo(() => getPlayerCardPhotos(data.id, data.photoUrl, team.slug === "arena-fc"), [data.id, data.photoUrl, team.slug]);
  const [photoId, setPhotoId] = useState<PlayerCardPhoto["id"]>("profile");
  const selectedPhoto = photos.find((photo) => photo.id === photoId) ?? photos[0];
  const [retry, setRetry] = useState(0);
  const [preview, setPreview] = useState<{ url: string; blob: Blob; theme: PlayerCardTheme; data: PlayerCardData; photo: PlayerCardPhoto; retry: number; hasPhoto: boolean } | null>(null);
  const [error, setError] = useState("");
  const ready = preview?.theme === theme && preview.data === data && preview.photo === selectedPhoto && preview.retry === retry ? preview : null;

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let objectUrl = "";
    setPreview(null);
    setError("");
    async function render() {
      try {
        const [photo] = await Promise.all([loadPlayerCardPhoto(selectedPhoto.url, controller.signal), document.fonts.ready]);
        if (controller.signal.aborted) return;
        const canvas = document.createElement("canvas");
        drawPlayerCard(canvas, { ...data, teamName: team.name }, theme, photo, selectedPhoto.fit);
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("이미지 생성 실패")), "image/png"));
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setPreview({ url: objectUrl, blob, theme, data, photo: selectedPhoto, retry, hasPhoto: Boolean(photo) });
      } catch {
        if (!controller.signal.aborted) setError("선수 카드를 만들지 못했습니다. 다시 시도해주세요.");
      }
    }
    void render();
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [open, theme, data, selectedPhoto, retry, team.name]);

  return (
    <section aria-labelledby="player-card-title" className="overflow-hidden rounded-xl border border-arena-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div>
          <p className="text-xs font-black tracking-widest text-arena-red">{team.name} · PLAYER CARD</p>
          <h2 id="player-card-title" className="mt-1 text-xl font-black text-slate-900">나만의 선수 카드</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">내 사진과 통산 기록으로 만드는 선수 카드. 사진과 디자인을 골라 PNG로 간직하세요.</p>
        </div>
        <button type="button" aria-expanded={open} aria-controls="player-card-preview" onClick={() => { setOpen((value) => !value); setPreview(null); }} className="shrink-0 rounded-lg bg-arena-red px-5 py-3 text-sm font-black text-[#fff] hover:bg-red-600">
          {open ? "선수 카드 닫기" : "선수 카드 만들기"}
        </button>
      </div>
      {open && (
        <div id="player-card-preview" className="grid gap-6 border-t border-arena-line bg-slate-50 p-5 sm:p-6 lg:grid-cols-[1fr_400px] lg:items-start">
          <div className="space-y-5 lg:sticky lg:top-24">
            <fieldset>
              <legend className="text-sm font-black text-slate-900">카드 사진 · {selectedPhoto.label}</legend>
              <div className="mt-3 grid max-w-md grid-cols-3 gap-2 sm:gap-3">
                {photos.map((item) => (
                  <label key={`${data.id}-${item.id}`} className={`min-w-0 cursor-pointer overflow-hidden rounded-lg border-2 bg-white p-2 transition focus-within:ring-2 focus-within:ring-slate-500 focus-within:ring-offset-2 ${selectedPhoto.id === item.id ? "border-slate-900 shadow-sm" : "border-slate-200 hover:border-slate-400"}`}>
                    <div className="relative aspect-[2/3] overflow-hidden rounded bg-slate-100">
                      <span aria-hidden="true" className="absolute inset-0 grid place-items-center text-2xl font-black text-slate-300">{data.name.slice(0, 1)}</span>
                      {item.url && <Image src={item.url} alt={`${data.name} · ${item.label}`} width={160} height={240} sizes="(min-width: 1024px) 160px, 30vw" unoptimized={item.id === "profile"} onLoad={(event) => { event.currentTarget.style.visibility = "visible"; }} onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} className={`relative h-full w-full ${item.fit === "contain" ? "object-contain" : "object-cover object-top"}`} />}
                    </div>
                    <span className="mt-2 flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 sm:text-sm">
                      <input type="radio" name={`player-card-photo-${data.id}`} value={item.id} aria-label={item.label} checked={selectedPhoto.id === item.id} onChange={() => setPhotoId(item.id)} className="shrink-0 accent-slate-900" />
                      <span className="break-keep text-center">{item.label}</span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">{photos.some((photo) => photo.id.startsWith("cartoon-")) ? "ARENA FC 실사 또는 스포츠 웹툰풍 카툰으로 팔짱·화이팅 포즈를 선택하세요." : photos.length > 1 ? "ARENA FC 로고가 있는 팔짱·화이팅 사진을 선택할 수 있습니다." : "이 선수는 준비된 포즈 사진이 없어 기존 프로필로 카드를 만듭니다."}</p>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-black text-slate-900">카드 디자인 · {playerCardThemes.length}종</legend>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {playerCardThemes.map((item) => (
                  <label key={item.id} className={`flex min-w-0 cursor-pointer items-center gap-2 rounded-lg border-2 p-2.5 transition focus-within:ring-2 focus-within:ring-slate-500 focus-within:ring-offset-2 sm:gap-3 sm:p-3 ${theme === item.id ? "border-slate-900 bg-white shadow-sm" : "border-slate-200 bg-white hover:border-slate-400"}`}>
                    <DesignSwatch theme={item} />
                    <span className="min-w-0">
                      <span className="flex items-start gap-1.5 text-xs font-bold leading-5 text-slate-700 sm:text-sm">
                        <input type="radio" name="player-card-theme" value={item.id} aria-label={item.label} aria-describedby={`player-card-design-${item.id}`} checked={theme === item.id} onChange={() => setTheme(item.id)} className="mt-1 shrink-0 accent-slate-900" />
                        <span className="break-keep">{item.label}</span>
                      </span>
                      <span id={`player-card-design-${item.id}`} className="mt-1 block break-keep text-[10px] leading-4 text-slate-500 sm:text-xs">{item.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
              <p className="font-bold text-slate-900">{data.name}의 통산 기록</p>
              <p className="mt-2 leading-6">{data.totalMatches}경기 · {data.goals}골 · {data.assists}도움 · MOM {data.mvpCount}회</p>
              <p className="mt-1 leading-6">{data.wins}승 {data.draws}무 {data.losses}패 · 승률 {data.winRate.toFixed(1)}%</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">{data.periodLabel}<br />완료된 경기만 집계합니다.</p>
            </div>
            {ready ? (
              <CardImageSave key={ready.url} blob={ready.blob} imageUrl={ready.url} filename={`arena-fc-player-${data.id}-${theme}-${selectedPhoto.id}.png`} title={`${data.name} 선수 카드 · ${selectedPhoto.label}`} downloadLabel="선수 카드 PNG 다운로드" />
            ) : <button type="button" disabled className="block w-full rounded-lg bg-slate-200 px-5 py-3.5 text-sm font-bold text-slate-500">{error ? "카드 생성 후 다운로드" : "선수 카드 만드는 중…"}</button>}
            <p className="text-xs leading-5 text-slate-500">1080 × 1440 고화질 PNG로 저장합니다. 휴대폰에서는 ‘사진으로 저장’을 눌러 저장 메뉴를 열어주세요.</p>
            {ready && !ready.hasPhoto && (
              <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                {selectedPhoto.label} 사진을 불러오지 못해 이름과 등번호로 카드를 만들었습니다.
                <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-1 block font-bold underline">사진 다시 불러오기</button>
              </div>
            )}
          </div>
          <div className="min-w-0">
            {error ? (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                <p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-3 font-bold underline">선수 카드 다시 만들기</button>
              </div>
            ) : ready ? (
              // Local canvas blob supports image saving and retains exactly the previewed design.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ready.url} alt={`${data.name} 선수 카드 · ${selectedPhoto.label} · ${playerCardThemes.find((item) => item.id === theme)?.label} · ${data.totalMatches}경기 ${data.goals}골 ${data.assists}도움 MOM ${data.mvpCount}회`} className="mx-auto h-auto w-full max-w-[400px] rounded-xl shadow-xl" width={1080} height={1440} />
            ) : <div role="status" className="mx-auto grid aspect-[3/4] w-full max-w-[400px] place-items-center rounded-xl bg-slate-200 p-8 text-center text-sm text-slate-600">사진과 기록을 카드에 담고 있습니다.</div>}
          </div>
        </div>
      )}
    </section>
  );
}
