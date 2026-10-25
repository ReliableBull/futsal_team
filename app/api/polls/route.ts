import { prisma } from "@/lib/prisma";
import { createClubPoll } from "@/lib/club-polls";
import { pollBody, pollContext, pollError, pollJson } from "@/lib/poll-http";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const input = await pollBody(request);
    const { teamId, accountId, access } = await pollContext();
    return pollJson(await createClubPoll(prisma, teamId, accountId, input, access), 201);
  } catch (error) { return pollError(error); }
}
