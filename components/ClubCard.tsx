import { clubHref, sportLabel, type ClubSummary } from "@/lib/community";
import { TeamRoleBadge } from "./TeamRoleBadge";

export function ClubCard({ club, destination = "profile" }: { club: ClubSummary; destination?: "profile" | "site" }) {
  const directToSite = destination === "site" && !club.example;
  const title = <>{club.name}<span className="float-right text-slate-300" aria-hidden>↗</span></>;
  const card = <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:shadow-lg">
    <div className="flex items-start justify-between gap-3"><div className="grid h-14 w-14 place-items-center rounded-2xl text-xl font-black text-[#fff]" style={{ background: club.color }}>{club.name.slice(0, 2)}</div><div className="flex flex-wrap justify-end gap-1.5">{club.example && <span className="community-tag">예시 동호회</span>}<span className={`community-tag ${club.recruiting ? "!bg-emerald-50 !text-emerald-800" : ""}`}>{club.recruiting ? "회원 모집 중" : "모집 마감"}</span></div></div>
    {club.role && <div className="mt-4"><TeamRoleBadge role={club.role} /></div>}
    <p className="mt-5 text-xs font-bold text-slate-500">{sportLabel(club.sport)} <span className="mx-1.5 text-slate-300">·</span> {club.region || "지역 미등록"}</p>
    <h3 className="mt-2 text-xl font-black">{directToSite ? title : <a className="hover:text-emerald-800" href={clubHref(club)}>{title}</a>}</h3>
    <p className="mb-5 mt-3 line-clamp-2 min-h-12 text-sm leading-6 text-slate-500">{club.description || "함께 뛰고, 함께 기록하는 우리 동호회입니다."}</p>
    <p className="mb-5 text-xs font-semibold text-slate-600">◷ &nbsp; {club.schedule || "정기 모임 시간 미등록"}</p>
    <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs"><div className="flex gap-3 text-slate-500"><span>선수 <strong className="text-slate-900">{club.playerCount}</strong></span><span>경기 <strong className="text-slate-900">{club.matchCount}</strong></span></div>{directToSite ? <span className="font-black text-emerald-800">동호회 바로가기 →</span> : <a href={club.managed ? `/t/${club.slug}/abcd` : club.role ? `/t/${club.slug}` : clubHref(club)} className="font-black text-emerald-800">{club.managed ? "동호회 관리" : club.role ? "동호회 기록 보기" : "동호회 보기"} →</a>}</div>
  </article>;
  return directToSite ? <a href={`/t/${club.slug}`} aria-label={`${club.name} 동호회 사이트로 이동`} className="block h-full rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700">{card}</a> : card;
}
