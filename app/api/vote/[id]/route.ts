import { prisma } from "@/lib/prisma";
import { getClubPoll } from "@/lib/club-polls";
import { pollAccess } from "@/lib/poll-access";
import { pollBody, pollError, pollJson } from "@/lib/poll-http";
import { submitPoll } from "@/lib/poll-submit";
import { PollError } from "@/lib/poll-validation";
import { getCurrentTeam, isLegacyMode } from "@/lib/teams";

export const dynamic = "force-dynamic";
async function publicContext() {
  if (!isLegacyMode()) throw new PollError(404, "투표를 찾을 수 없습니다.");
  const team = await getCurrentTeam();
  // A management session never changes this endpoint into a results endpoint.
  return { teamId: team.id, accountId: null, access: pollAccess() };
}
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const { teamId, accountId, access } = await publicContext();
    return pollJson(await getClubPoll(prisma, teamId, accountId, params.id, access));
  } catch (error) { return pollError(error); }
}
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const context = await publicContext();
    return await submitPoll(request, params.id, await pollBody(request), context);
  } catch (error) { return pollError(error); }
}
