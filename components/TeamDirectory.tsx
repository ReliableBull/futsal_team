import { getSignedInAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { findClubs } from "@/lib/club-directory";
import { regions } from "@/lib/community";
import { ClubCard } from "./ClubCard";

export async function TeamDirectory({ search = "", mine = false, sport = "", region = "", recruiting = false }: { search?: string; mine?: boolean; sport?: string; region?: string; recruiting?: boolean }) {
  const admin = await getSignedInAdmin();
  if (mine && !admin) redirect("/login");
  const clubs = await findClubs({ search, mine, sport, region, recruiting, adminId: admin?.id });
  const filtered = Boolean(search || sport || region || recruiting);
  const groups = mine ? [
    { title: "내가 운영하는 동호회", description: "회장(운영자)으로 선수와 경기 기록을 관리해요.", clubs: clubs.filter(club => club.role === "PRESIDENT") },
    { title: "회원으로 참여하는 동호회", description: "함께하는 동호회의 선수와 경기 기록을 확인해요.", clubs: clubs.filter(club => club.role === "MEMBER") }
  ].filter(group => group.clubs.length > 0) : [];
  return <div className="space-y-7 pb-12 pt-4">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="community-eyebrow">{mine ? "MY CLUBS" : "FIND YOUR PEOPLE"}</p><h1 className="mt-3 text-3xl font-black sm:text-4xl">{mine ? "내가 속한 동호회" : "같이 뛸 사람들을 만나요."}</h1><p className="mt-4 text-sm leading-6 text-slate-500">{mine ? "함께하는 동호회와 각 동호회에서의 내 역할을 확인하세요." : "사는 곳도, 좋아하는 종목도, 뛰는 시간도. 나와 잘 맞는 동호회를 찾아보세요."}</p></div><a className="platform-button" href="/teams/new">+ 동호회 만들기</a></div>
    <div className="flex gap-2 border-b border-slate-200 pb-4"><a href="/teams" aria-current={!mine ? "page" : undefined} className={`community-tab ${!mine ? "community-tab-active" : ""}`}>동호회 찾기</a><a href={admin ? "/teams?mine=1" : "/login"} aria-current={mine ? "page" : undefined} className={`community-tab ${mine ? "community-tab-active" : ""}`}>내 동호회</a></div>
    <form action="/teams" className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_auto]">
      {mine && <input type="hidden" name="mine" value="1" />}
      <label className="platform-label">동호회 검색<input className="platform-input" name="q" defaultValue={search.slice(0, 60)} placeholder="동호회 이름 또는 활동 지역" maxLength={60} /></label>
      <label className="platform-label">종목<select className="platform-input" name="sport" defaultValue={sport}><option value="">모든 종목</option><option value="FUTSAL">풋살</option><option value="FOOTBALL">축구</option></select></label>
      <label className="platform-label">활동 지역<select className="platform-input" name="region" defaultValue={region}><option value="">전국</option>{regions.map(area => <option key={area}>{area}</option>)}</select></label>
      <button className="platform-button self-end">동호회 찾기</button>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 sm:col-span-2"><input type="checkbox" name="recruiting" value="1" defaultChecked={recruiting} className="h-4 w-4 accent-emerald-700" />회원 모집 중인 동호회만 보기</label>
    </form>
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><p className="font-bold">{clubs.length}개 동호회 {clubs.length >= 100 && "(최근 등록순 최대 100개 + 예시)"}</p>{filtered && <a href={mine ? "/teams?mine=1" : "/teams"} className="text-slate-500 underline">필터 초기화</a>}</div>
    {mine ? <div className="space-y-10">{groups.map(group => <section key={group.title} className="space-y-4">
      <div><h2 className="text-xl font-black">{group.title} <span className="ml-1 text-base text-slate-500">{group.clubs.length}</span></h2><p className="mt-2 text-sm text-slate-500">{group.description}</p></div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{group.clubs.map(club => <ClubCard key={club.slug} club={club} destination="site" />)}</div>
    </section>)}</div> : <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{clubs.map(club => <ClubCard key={`${club.example}-${club.slug}`} club={club} />)}</div>}
    {clubs.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><h2 className="text-xl font-black">{filtered ? "조건에 맞는 동호회가 없어요" : mine ? "아직 속한 동호회가 없어요" : "등록된 동호회가 없어요"}</h2><p className="mt-3 text-sm text-slate-500">{filtered ? "지역이나 종목을 바꿔 다시 찾아보세요." : "함께 뛸 동호회를 찾아보거나 새로운 동호회를 만들어보세요."}</p><a className="platform-button mt-6 inline-block" href={filtered && mine ? "/teams?mine=1" : "/teams"}>{filtered && mine ? "내 동호회 전체 보기" : "동호회 찾아보기"}</a></div>}
    {clubs.some(club => club.example) && <p className="text-xs leading-6 text-slate-500">‘예시 동호회’는 서비스 체험을 위한 가상 데이터이며 실제 회원을 모집하지 않습니다.</p>}
  </div>;
}
