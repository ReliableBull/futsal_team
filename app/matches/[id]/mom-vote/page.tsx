import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MomVoteForm } from "@/components/MomVoteForm";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const title = "오늘의 MOM 투표 | ARENA FC";
  const description = "진행 중인 경기의 MOM을 각 팀에서 1명씩 선택해주세요. 로그인 없이 참여할 수 있습니다.";
  return { title, description, robots: { index: false, follow: false }, openGraph: { title, description, url: `/matches/${params.id}/mom-vote` } };
}

export default async function MomVotePage({ params }: { params: { id: string } }) {
  const id = /^[1-9]\d*$/.test(params.id) ? Number(params.id) : NaN;
  if (!Number.isSafeInteger(id) || id > 2147483647) notFound();
  const match = await prisma.match.findUnique({ where: { id }, select: { matchDate: true, location: true, teamAName: true, teamBName: true } });
  if (!match) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-xl border border-arena-line bg-white p-5 sm:p-7">
        <p className="text-xs font-black tracking-widest text-arena-red">ARENA FC · MOM VOTE</p>
        <h1 className="mt-3 break-keep text-3xl font-black text-slate-900">오늘의 MOM 투표</h1>
        <p className="mt-3 break-keep font-bold text-slate-700">{match.teamAName} vs {match.teamBName}</p>
        <p className="mt-2 text-sm text-slate-500">{formatDate(match.matchDate)} · {match.location}</p>
        <p className="mt-4 text-sm leading-6 text-slate-600">각 팀에서 가장 인상적인 활약을 보여준 선수 1명씩을 골라주세요. 최종 MOM은 운영자가 투표 결과를 보고 확정합니다.</p>
      </section>
      <MomVoteForm matchId={id} />
      <Link href={`/matches/${id}`} className="inline-block py-3 text-sm font-bold text-slate-600 underline">경기 상세로 돌아가기</Link>
    </div>
  );
}
