import { headers } from "next/headers";
import { AccessLogBeacon } from "@/components/AccessLogBeacon";
import { DesktopNav } from "@/components/DesktopNav";
import { MobileNavMenu } from "@/components/MobileNavMenu";
import { TeamProvider } from "@/components/TeamProvider";
import { TeamRoleBadge } from "@/components/TeamRoleBadge";
import { getSignedInAdmin, getTeamRole } from "@/lib/auth";
import { logoutPlatform } from "@/lib/team-actions";
import { getCurrentTeam, getTeamBasePath, isLegacyMode } from "@/lib/teams";
import { isPlatformPath } from "@/lib/team-paths";
import { isStandaloneVotePath } from "@/lib/poll-paths";

export default async function Template({ children }: { children: React.ReactNode }) {
  const basePath = getTeamBasePath();
  const legacy = isLegacyMode();
  const pathname = headers().get("x-futsal-path") || "/";
  if (legacy && isStandaloneVotePath(pathname)) return <main className="mx-auto min-h-screen max-w-xl px-4 py-10 sm:py-16">{children}</main>;
  const platform = !legacy && !basePath && isPlatformPath(pathname);
  const team = platform ? null : await getCurrentTeam();
  const admin = await getSignedInAdmin();
  const role = admin && team ? await getTeamRole(admin.id, team.id) : null;
  const navItems = [
    { href: "/", label: "홈" }, { href: "/players", label: "선수목록" }, { href: "/matches", label: "경기결과" },
    { href: "/chemistry", label: "조합 분석" }, { href: "/hall-of-fame", label: "🏆 명예의 전당" },
    ...(!legacy ? [{ href: "/polls", label: "투표" }] : []),
    ...(!legacy && role === "PRESIDENT" ? [{ href: "/abcd", label: "팀 관리" }] : []),
    ...(!legacy ? [{ href: "/teams", label: "다른 팀" }] : [])
  ];
  return <TeamProvider value={{ basePath, name: team?.name || "ARENA", slug: team?.slug || "", color: team?.color || "#e53935", platform }}>
    {!platform && <AccessLogBeacon />}
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      {platform ? <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex min-h-16 items-center justify-between gap-4 lg:min-h-20">
          <a href="/" className="flex shrink-0 items-center gap-2.5 text-xl font-black tracking-tight text-slate-900"><span className="grid h-9 w-9 -skew-x-6 place-items-center rounded-lg bg-[#102c25] text-[#c5edaa]">A</span>ARENA<span className="ml-1 hidden border-l border-slate-200 pl-3 text-[11px] font-medium text-slate-500 xl:block">축구와 풋살, 함께 뛰는 시작</span></a>
          <nav className="hidden items-center gap-7 text-sm font-bold lg:flex" aria-label="서비스 메뉴">{[{ href: "/teams", label: "동호회 찾기" }, { href: "/venues", label: "구장 예약" }, { href: "/bookings", label: "예시 예약 내역" }].map(item => <a key={item.href} href={item.href} aria-current={pathname.startsWith(item.href) ? "page" : undefined} className={pathname.startsWith(item.href) ? "text-emerald-800" : "text-slate-600"}>{item.label}</a>)}</nav>
          <div className="flex items-center gap-3 text-xs font-bold sm:text-sm">{admin ? <><a href="/teams?mine=1">내 동호회</a><form action={logoutPlatform}><button className="text-slate-500" type="submit">로그아웃</button></form></> : <><a href="/login" className="text-slate-500">로그인</a><a href="/teams/new" className="rounded-lg bg-slate-900 px-3 py-2.5 text-[#fff]">동호회 만들기</a></>}</div>
        </div>
        <nav className="flex justify-between gap-4 border-t border-slate-100 py-3.5 text-xs font-bold sm:justify-start sm:gap-8 sm:text-sm lg:hidden" aria-label="모바일 서비스 메뉴">{[{ href: "/", label: "홈" }, { href: "/teams", label: "동호회 찾기" }, { href: "/venues", label: "구장 예약" }, { href: "/bookings", label: "예시 예약 내역" }].map(item => <a key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined} className={pathname === item.href ? "text-emerald-800" : "text-slate-600"}>{item.label}</a>)}</nav>
      </div>
      : <div className="relative mx-auto flex min-h-16 max-w-[1480px] items-center justify-between gap-2 px-4 sm:px-6"><div className="flex min-w-0 items-center gap-3"><MobileNavMenu items={navItems} /><a href={basePath || "/"} className="flex min-w-0 items-center gap-2.5 text-xl font-black text-slate-900"><span className="grid h-8 w-8 shrink-0 -skew-x-6 place-items-center border-2 text-base" style={{ borderColor: team!.color, color: team!.color }}>{team!.name.slice(0, 1)}</span><span className="max-w-44 truncate italic">{team!.name}</span></a></div><DesktopNav items={navItems} />{legacy && <span className="hidden border border-arena-line px-3 py-2 text-xs font-bold text-slate-500 lg:block">2026 SEASON RECORD</span>}</div>}
    </header>
    {!platform && !legacy && role && <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-3 px-4 pt-5 sm:px-6"><a href="/teams?mine=1" className="text-sm font-bold text-slate-600">← 내 동호회</a><TeamRoleBadge role={role} /></div>}
    <main className={`mx-auto px-4 py-5 sm:px-6 sm:py-7 ${platform ? "max-w-7xl" : "max-w-[1480px]"}`}>{children}</main>
    {platform && <footer className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 border-t border-slate-200 px-6 py-7 text-xs text-slate-500"><span className="font-black">ARENA · EVERY TEAM HAS A STORY</span><span>동호회부터 구장까지. 함께 뛰는 모든 순간.</span></footer>}
  </TeamProvider>;
}
