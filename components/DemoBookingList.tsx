"use client";

import { useEffect, useState } from "react";
import { dateLabel, demoBookingsKey, getDemoVenue, readDemoBookings, slotLabel, won, type DemoBooking } from "@/lib/demo-venues";

export function DemoBookingList() {
  const [bookings, setBookings] = useState<DemoBooking[]>([]), [ready, setReady] = useState(false), [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null), [clear, setClear] = useState(false);
  useEffect(() => {
    const sync = () => { try { setBookings(readDemoBookings(localStorage.getItem(demoBookingsKey))); } catch { setError("브라우저에 저장된 내역을 불러오지 못했습니다."); } setReady(true); };
    sync(); window.addEventListener("storage", sync); return () => window.removeEventListener("storage", sync);
  }, []);
  function update(id: string | null) {
    try {
      const latest = readDemoBookings(localStorage.getItem(demoBookingsKey));
      const next = id === null ? [] : latest.map(b => b.id === id ? { ...b, status: "CANCELLED" as const } : b);
      localStorage.setItem(demoBookingsKey, JSON.stringify(next)); setBookings(next); setConfirmId(null); setClear(false); setError("");
    } catch { setError("예시 예약 내역을 저장하지 못했습니다. 다시 시도해주세요."); }
  }
  if (!ready) return <p role="status" className="py-12 text-center text-sm text-slate-500">예시 예약 내역을 불러오는 중…</p>;
  return <div className="space-y-5">{error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
    {bookings.length === 0 ? <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><p className="community-eyebrow">NEXT GAME STARTS HERE</p><h2 className="mt-4 text-2xl font-black">아직 예시 예약 내역이 없어요</h2><p className="mt-4 text-sm text-slate-500">마음에 드는 구장과 시간을 골라 예약 흐름을 체험해보세요.</p><a className="platform-button mt-7 inline-block" href="/venues">구장 둘러보기 →</a></section> : bookings.map(booking => {
      const venue = getDemoVenue(booking.venueSlug)!;
      return <article key={booking.id} className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex flex-wrap items-center justify-between gap-3"><span className={`community-tag ${booking.status === "REQUESTED" ? "!bg-emerald-50 !text-emerald-800" : ""}`}>{booking.status === "REQUESTED" ? "예시 요청 · 실제 예약 아님" : "체험 예약 취소됨"}</span><span className="text-xs text-slate-500">예시 예약 #{booking.id.slice(0, 8)}</span></div><h2 className="mt-5 text-xl font-black"><a href={`/venues/${venue.slug}`}>{venue.name} ↗</a></h2><p className="mt-2 break-all text-sm text-slate-500">{booking.teamName} · {venue.region}</p><div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5"><p className="text-sm font-bold">{dateLabel(booking.date)}<span className="mt-1 block font-normal text-slate-500">{slotLabel(booking.hour)}</span></p><strong>{won(booking.price)} <span className="text-xs font-normal text-slate-500">(예시 금액)</span></strong>{booking.status === "REQUESTED" && <button type="button" onClick={() => setConfirmId(booking.id)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold">예시 예약 취소</button>}</div>{confirmId === booking.id && <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-4" role="group" aria-label="예약 취소 확인"><p className="mr-auto text-sm">이 예시 예약을 취소할까요?</p><button onClick={() => update(booking.id)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-[#fff]">취소하기</button><button onClick={() => setConfirmId(null)} className="px-3 py-2 text-sm font-bold">유지하기</button></div>}</article>;
    })}
    {bookings.length > 0 && <div className="pt-3 text-right">{clear ? <div className="flex flex-wrap items-center justify-end gap-3 text-sm"><span>모든 예시 예약 내역을 지울까요?</span><button onClick={() => update(null)} className="font-bold text-red-700">모두 지우기</button><button onClick={() => setClear(false)}>유지하기</button></div> : <button onClick={() => setClear(true)} className="text-xs text-slate-500 underline">체험 내역 초기화</button>}</div>}
  </div>;
}
