"use client";

import { useEffect, useState, type FormEvent } from "react";
import { addDemoBooking, bookingDates, dateLabel, demoBookingsKey, isFutureSlot, readDemoBookings, slotLabel, won, type DemoBooking, type DemoVenue } from "@/lib/demo-venues";

export function DemoBookingForm({ venue }: { venue: DemoVenue }) {
  const [dates, setDates] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [hour, setHour] = useState<number | null>(null);
  const [bookings, setBookings] = useState<DemoBooking[]>([]);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState<DemoBooking | null>(null);
  const [now, setNow] = useState(new Date(0));
  useEffect(() => {
    const sync = () => {
      const current = new Date(), available = bookingDates(current);
      setNow(current); setDates(available); setDate(previous => available.includes(previous) ? previous : available[0]);
      try { setBookings(readDemoBookings(localStorage.getItem(demoBookingsKey))); } catch { setError("브라우저 저장소를 사용할 수 없습니다. 저장소 사용을 허용한 뒤 다시 시도해주세요."); }
    };
    sync();
    window.addEventListener("storage", sync); window.addEventListener("focus", sync);
    const timer = window.setInterval(sync, 60000);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener("focus", sync); window.clearInterval(timer); };
  }, []);
  const taken = (candidate: number) => bookings.some(b => b.venueSlug === venue.slug && b.date === date && b.hour === candidate && b.status === "REQUESTED");
  const available = (candidate: number) => Boolean(date) && isFutureSlot(date, candidate, now) && !taken(candidate);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    if (hour === null) { setError("이용할 시간을 선택해주세요."); return; }
    if (form.get("acknowledged") !== "on") { setError("예시 예약 안내를 확인해주세요."); return; }
    try {
      const latest = readDemoBookings(localStorage.getItem(demoBookingsKey));
      const next = addDemoBooking(latest, { venueSlug: venue.slug, date, hour, teamName: String(form.get("teamName") || "") }, crypto.randomUUID());
      localStorage.setItem(demoBookingsKey, JSON.stringify(next));
      setBookings(next); setComplete(next[0]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "예시 예약을 저장하지 못했습니다."); }
  }
  if (complete) return <section className="rounded-2xl border border-emerald-200 bg-white p-6 sm:p-8" aria-live="polite"><span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-2xl text-emerald-800">✓</span><h2 className="mt-5 text-2xl font-black">예시 예약 요청을 저장했어요</h2><p className="mt-3 text-sm leading-7 text-slate-500">실제 구장으로 전달되지 않는 체험 내역입니다. 현재 브라우저에서 확인하고 취소할 수 있어요.</p><dl className="my-6 space-y-3 rounded-xl bg-slate-50 p-5 text-sm"><div className="flex justify-between gap-3"><dt className="text-slate-500">동호회</dt><dd className="break-all text-right font-bold">{complete.teamName}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">날짜</dt><dd className="font-bold">{dateLabel(complete.date)}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">시간</dt><dd className="font-bold">{slotLabel(complete.hour)}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">예시 금액</dt><dd className="font-bold">{won(complete.price)}</dd></div></dl><a href="/bookings" className="platform-button block text-center">예시 예약 내역 확인 →</a><button onClick={() => { setComplete(null); setHour(null); }} className="mt-4 w-full py-2 text-sm font-bold text-slate-500">다른 시간도 둘러보기</button></section>;
  return <form onSubmit={submit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-7">
    <div><span className="community-tag !bg-amber-50 !text-amber-900">예시 예약</span><h2 className="mt-3 text-2xl font-black">함께 뛸 시간 선택</h2><p className="mt-2 text-xs leading-6 text-slate-500">오늘부터 7일간 · 한국 시간 기준 · 2시간 단위</p></div>
    {dates.length ? <><label className="platform-label">이용 날짜<select className="platform-input" value={date} onChange={event => { setDate(event.target.value); setHour(null); setError(""); }}>{dates.map(day => <option value={day} key={day}>{dateLabel(day)}{day === dates[0] ? " · 오늘" : ""}</option>)}</select></label>
      <fieldset><legend className="mb-3 text-sm font-bold">이용 시간</legend><div className="grid grid-cols-2 gap-2">{venue.hours.map(candidate => <button key={candidate} type="button" aria-pressed={hour === candidate} disabled={!available(candidate)} onClick={() => { setHour(candidate); setError(""); }} className={`rounded-xl border px-2 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-400 ${hour === candidate && available(candidate) ? "border-[#214d3c] bg-[#214d3c] text-[#fff]" : "border-slate-200 hover:border-emerald-700"}`}>{slotLabel(candidate)}<span className="mt-1 block text-[10px] font-normal">{taken(candidate) ? "예시 요청됨" : !isFutureSlot(date, candidate, now) ? "지난 시간" : "선택 가능"}</span></button>)}</div></fieldset></> : <p role="status" className="text-sm text-slate-500">예약 시간을 불러오는 중…</p>}
    <label className="platform-label">동호회 이름<input className="platform-input" name="teamName" minLength={2} maxLength={60} placeholder="예: 우리동네 FC" required /></label>
    <div className="flex items-end justify-between border-t border-slate-100 pt-5"><span className="text-sm text-slate-500">2시간 대관 · 예시 금액</span><strong className="text-2xl">{won(venue.price)}</strong></div>
    <label className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-xs leading-6 text-amber-900"><input className="mt-1.5 h-4 w-4 shrink-0 accent-emerald-700" type="checkbox" name="acknowledged" required /><span>실제 구장 예약·결제가 아닌 체험임을 확인했어요. 내역은 현재 브라우저에만 저장됩니다.</span></label>
    {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
    <button disabled={hour === null || !available(hour)} className="platform-button w-full disabled:cursor-not-allowed disabled:bg-slate-300" type="submit">예시 예약 요청</button>
  </form>;
}
