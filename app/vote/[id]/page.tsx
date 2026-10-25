import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getClubPoll } from "@/lib/club-polls";
import { pollAccess } from "@/lib/poll-access";
import { PollError } from "@/lib/poll-validation";
import { getCurrentTeam, isLegacyMode } from "@/lib/teams";
import { StandalonePollVote } from "@/components/StandalonePollVote";

export default async function SharedVotePage({ params }: { params: { id: string } }) {
  if (!isLegacyMode()) notFound();
  const team = await getCurrentTeam();
  let poll;
  try { poll = await getClubPoll(prisma, team.id, null, params.id, pollAccess()); }
  catch (error) { if (error instanceof PollError && error.status === 404) notFound(); throw error; }
  return <StandalonePollVote initial={poll} endpoint={`/api/vote/${poll.id}`} />;
}
