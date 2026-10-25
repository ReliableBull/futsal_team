import { prisma } from "@/lib/prisma";
import { getClubPoll } from "@/lib/club-polls";
import { pollContext, pollError, pollJson } from "@/lib/poll-http";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const { teamId, accountId, access } = await pollContext();
    return pollJson(await getClubPoll(prisma, teamId, accountId, params.id, access));
  } catch (error) { return pollError(error); }
}
