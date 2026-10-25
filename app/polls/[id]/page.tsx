import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getClubPoll } from "@/lib/club-polls";
import { PollError } from "@/lib/poll-validation";
import { pollPageContext } from "@/lib/poll-page";
import { PollAccessNotice } from "@/components/PollAccessNotice";
import { ClubPollVote } from "@/components/ClubPollVote";
import { ClubPollShare } from "@/components/ClubPollShare";

export const metadata = { title: "동호회 투표", description: "동호회 투표에 참여하고 함께 결정해주세요.", robots: { index: false, follow: false } };

export default async function PollPage({ params }: { params: { id: string } }) {
  const { team, account, base, role, legacy, access } = await pollPageContext(`/${params.id}`);
  if (!legacy && !role) return <PollAccessNotice />;
  let poll;
  try { poll = await getClubPoll(prisma, team.id, account?.id ?? null, params.id, access); }
  catch (error) { if (error instanceof PollError && error.status === 404) notFound(); throw error; }
  // Keep previously shared URLs usable without exposing the management screen.
  if (legacy && !poll.canManage) redirect(`/vote/${poll.id}`);
  return <div className="mx-auto max-w-3xl space-y-6">
    {(!legacy || poll.canManage) && <a href={base} className="text-sm font-bold text-slate-500">← 투표 목록</a>}
    <header className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"><p className="community-eyebrow">{team.name} · 회원 투표</p><h1 className="mt-4 break-words text-2xl font-black sm:text-3xl">{poll.title}</h1>{poll.description && <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">{poll.description}</p>}</header>
    <ClubPollVote initial={poll} endpoint={`${base.replace(/\/polls$/, "/api/polls")}/${poll.id}`} />
    <ClubPollShare path={legacy ? `/vote/${poll.id}` : `${base}/${poll.id}`} title={`${team.name} · ${poll.title}`} siteUrl={process.env.NEXT_PUBLIC_SITE_URL} namedVoting={legacy} />
  </div>;
}
