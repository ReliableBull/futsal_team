import { prisma } from "@/lib/prisma";
import { listClubPolls } from "@/lib/club-polls";
import { pollPageContext } from "@/lib/poll-page";
import { formatPollDate, pollIsClosed } from "@/lib/poll-validation";
import { PollAccessNotice } from "@/components/PollAccessNotice";

export default async function PollsPage() {
  const { team, account, base, role, legacy, access } = await pollPageContext();
  if (!legacy && !role) return <PollAccessNotice />;
  const polls = await listClubPolls(prisma, team.id, account?.id ?? null, access);
  return <div className="mx-auto max-w-4xl space-y-7">
    {legacy && <a href="/abcd" className="text-sm font-bold text-slate-500">← 관리자 페이지</a>}
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="community-eyebrow">{team.name} · 함께 결정해요</p><h1 className="mt-3 text-3xl font-black">동호회 투표</h1><p className="mt-3 text-sm leading-7 text-slate-500">모임 일정부터 운영 방향까지, 우리 동호회의 의견을 모아보세요.</p></div>{role === "PRESIDENT" && <a href={`${base}/new`} className="platform-button">+ 투표 만들기</a>}</div>
    <div className="space-y-3">{polls.map(poll => <a key={poll.id} href={`${base}/${poll.id}`} className="block rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-emerald-600 focus-visible:outline-emerald-700"><div className="flex flex-wrap items-center gap-2 text-xs font-bold"><span className={`rounded-full px-3 py-1 ${pollIsClosed(poll) ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-800"}`}>{pollIsClosed(poll) ? "마감" : "진행 중"}</span>{poll.ballots.length > 0 && <span className="text-emerald-800">참여 완료</span>}</div><h2 className="mt-3 break-words text-lg font-black">{poll.title}</h2><p className="mt-3 text-xs leading-6 text-slate-500">{poll._count.ballots}명 참여 · {poll.closesAt ? `${formatPollDate(poll.closesAt)} 마감` : legacy ? "관리자가 직접 마감" : "회장이 직접 마감"}</p></a>)}</div>
    {!polls.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="text-xl font-black">아직 등록된 투표가 없어요</h2><p className="mt-3 text-sm text-slate-500">{role === "PRESIDENT" ? "첫 투표를 만들고 링크를 회원들에게 공유해보세요." : legacy ? "관리자가 투표를 만들면 이름을 입력하고 참여할 수 있어요." : "회장이 투표를 만들면 이곳에서 참여할 수 있어요."}</p></div>}
    {polls.length === 100 && <p className="text-xs text-slate-500">최근 투표 100개를 표시합니다. 이전 투표는 공유 링크로 열 수 있습니다.</p>}
  </div>;
}
