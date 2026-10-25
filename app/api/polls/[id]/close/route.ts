import { prisma } from "@/lib/prisma";
import { closeClubPoll, getClubPoll } from "@/lib/club-polls";
import { pollBody, pollContext, pollError, pollJson } from "@/lib/poll-http";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await pollBody(request);
    const { teamId, accountId, access } = await pollContext();
    await closeClubPoll(prisma, teamId, accountId, params.id, access);
    return pollJson(await getClubPoll(prisma, teamId, accountId, params.id, access));
  } catch (error) { return pollError(error); }
}
