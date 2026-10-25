import { prisma } from "@/lib/prisma";
import { pollPageContext } from "@/lib/poll-page";
import { getPollCandidates } from "@/lib/poll-candidates";
import { legacyPollRules } from "@/lib/poll-validation";
import { ClubPollCreateForm } from "@/components/ClubPollCreateForm";
import { PollAccessNotice } from "@/components/PollAccessNotice";

export default async function NewPollPage() {
  const { team, base, role, legacy } = await pollPageContext("/new");
  if (role !== "PRESIDENT") return <PollAccessNotice ownerOnly={Boolean(role)} legacy={legacy} />;
  const candidates = legacy ? await getPollCandidates(prisma, team.id) : [];
  return <div className="mx-auto max-w-2xl space-y-6"><a href={base} className="text-sm font-bold text-slate-500">← 투표 목록</a><div><p className="community-eyebrow">{team.name}</p><h1 className="mt-3 text-3xl font-black">함께 결정할 일을 올려주세요</h1><p className="mt-3 text-sm leading-7 text-slate-500">투표를 만들면 회원들에게 보낼 공유 링크가 생성됩니다.</p></div><ClubPollCreateForm base={base} namedVoting={legacy} candidates={candidates} maxOptions={legacy ? legacyPollRules.maxOptions : undefined} /></div>;
}
