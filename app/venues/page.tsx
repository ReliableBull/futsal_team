import { VenueCard } from "@/components/VenueCard";
import { demoVenues } from "@/lib/demo-venues";
import { matchesSport, regions } from "@/lib/community";
import { requirePlatformMode } from "@/lib/teams";

export default function VenuesPage({ searchParams }: { searchParams: { q?: string; sport?: string; region?: string; setting?: string } }) {
  requirePlatformMode();
  const value = (key: keyof typeof searchParams) => typeof searchParams[key] === "string" ? searchParams[key]!.trim().slice(0, 60) : "";
  const query = value("q"), sport = value("sport"), region = value("region"), setting = value("setting");
  const venues = demoVenues.filter(venue => (!query || `${venue.name} ${venue.region}`.includes(query)) && matchesSport(venue.sport, sport) && (!region || venue.region.includes(region)) && (!setting || venue.setting === setting));
  return <div className="space-y-7 pb-12 pt-4"><div><p className="community-eyebrow">FIND YOUR FIELD</p><h1 className="mt-3 text-3xl font-black sm:text-4xl">이번 주, 어디서 뛸까요?</h1><p className="mt-4 text-sm leading-6 text-slate-500">우리 동호회에 맞는 구장을 찾고, 함께 뛸 시간을 골라보세요.</p></div>
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">예약 체험용 가상 구장 4곳입니다. 시설·요금·시간은 예시이며 실제 예약이나 결제가 진행되지 않습니다.</div>
    <form action="/venues" className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto]"><label className="platform-label">구장 검색<input className="platform-input" name="q" defaultValue={query} placeholder="구장 이름 또는 지역" maxLength={60} /></label><label className="platform-label">종목<select name="sport" defaultValue={sport} className="platform-input"><option value="">모든 종목</option><option value="FUTSAL">풋살</option><option value="FOOTBALL">축구</option></select></label><label className="platform-label">지역<select name="region" defaultValue={region} className="platform-input"><option value="">전국</option>{regions.map(area => <option key={area}>{area}</option>)}</select></label><label className="platform-label">구장 유형<select name="setting" defaultValue={setting} className="platform-input"><option value="">실내 · 야외</option><option>실내</option><option>야외</option></select></label><button className="platform-button self-end">구장 찾기</button></form>
    <div className="flex justify-between text-sm"><p className="font-bold">{venues.length}개 구장</p>{(query || sport || region || setting) && <a className="text-slate-500 underline" href="/venues">필터 초기화</a>}</div>
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{venues.map(venue => <VenueCard key={venue.slug} venue={venue} />)}</div>
    {!venues.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center"><h2 className="text-xl font-black">조건에 맞는 구장이 없어요</h2><p className="mt-3 text-sm text-slate-500">다른 지역이나 구장 유형으로 검색해보세요.</p><a className="platform-button mt-6 inline-block" href="/venues">전체 구장 보기</a></div>}
  </div>;
}
