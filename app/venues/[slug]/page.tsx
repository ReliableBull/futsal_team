import { notFound } from "next/navigation";
import { getDemoVenue } from "@/lib/demo-venues";
import { sportLabel } from "@/lib/community";
import { requirePlatformMode } from "@/lib/teams";
import { PitchArt } from "@/components/PitchArt";
import { DemoBookingForm } from "@/components/DemoBookingForm";

export default function VenuePage({ params }: { params: { slug: string } }) {
  requirePlatformMode();
  const venue = getDemoVenue(params.slug);
  if (!venue) notFound();
  return <div className="space-y-6 pb-12 pt-3"><a href="/venues" className="text-sm font-bold text-slate-500">← 구장 둘러보기</a><div className="grid items-start gap-7 lg:grid-cols-[1.35fr_1fr]"><div className="space-y-6"><div className="relative overflow-hidden rounded-3xl"><PitchArt theme={venue.theme} large /><span className="absolute left-5 top-5 rounded-lg bg-white/95 px-3 py-2 text-xs font-bold">예시 구장 · 일러스트</span></div><section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"><p className="community-eyebrow">{venue.region} · {sportLabel(venue.sport)}</p><h1 className="mt-3 text-3xl font-black">{venue.name}</h1><p className="mt-4 text-sm leading-7 text-slate-500">{venue.description}</p><div className="mt-6 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 py-5 text-center"><div><p className="text-xs text-slate-500">구장 유형</p><p className="mt-2 text-sm font-black">{venue.setting}</p></div><div><p className="text-xs text-slate-500">추천 인원</p><p className="mt-2 text-sm font-black">{venue.format}</p></div><div><p className="text-xs text-slate-500">구장 크기</p><p className="mt-2 text-sm font-black">{venue.size}</p></div></div><h2 className="mt-7 text-base font-black">시설 안내</h2><div className="mt-4 flex flex-wrap gap-2">{venue.facilities.map(item => <span key={item} className="community-tag">✓ {item}</span>)}</div><div className="mt-7 border-t border-slate-100 pt-6"><h2 className="font-black">예약 체험 안내</h2><p className="mt-3 text-sm leading-7 text-slate-500">이 구장은 서비스 체험을 위한 가상의 장소입니다. 표시된 시설과 금액은 예시이며 실제 위치·잔여 시간과 관계가 없습니다. 예약 요청은 구장에 전달되지 않으며 결제도 발생하지 않습니다.</p></div></section></div><div className="lg:sticky lg:top-28"><DemoBookingForm venue={venue} /></div></div></div>;
}
