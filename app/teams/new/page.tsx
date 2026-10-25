import { TeamForm } from "@/components/TeamForm";
import { createTeam } from "@/lib/team-actions";
import { getSignedInAdmin } from "@/lib/auth";
import { requirePlatformMode } from "@/lib/teams";
export default async function NewTeamPage() {
  requirePlatformMode();
  const admin = await getSignedInAdmin();
  return <section className="mx-auto max-w-2xl py-8"><a href="/teams" className="text-sm font-bold text-slate-500">← 동호회 찾기</a><p className="mt-9 text-xs font-black tracking-[.25em] text-red-600">YOUR TEAM, YOUR STORY</p><h1 className="mt-3 text-3xl font-black text-slate-900 sm:text-4xl">우리 동호회의 시작, ARENA.</h1><p className="mt-4 text-sm leading-6 text-slate-500">축구·풋살 동호회를 소개하고, 함께 뛰는 선수와 경기를 관리하세요.{admin && ` ${admin.username} 계정으로 관리합니다.`}</p><div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"><TeamForm action={createTeam} signedIn={Boolean(admin)} /></div></section>;
}
