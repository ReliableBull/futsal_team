import { prisma } from "@/lib/prisma";
import { getClubPoll, invalidateGuestBallot } from "@/lib/club-polls";
import { pollBody, pollContext, pollError, pollJson } from "@/lib/poll-http";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const input = await pollBody(request);
    const { teamId, accountId, access } = await pollContext();
    await invalidateGuestBallot(prisma, teamId, accountId, params.id, input.ballotId, access);
    return pollJson(await getClubPoll(prisma, teamId, accountId, params.id, access));
  } catch (error) { return pollError(error); }
}
