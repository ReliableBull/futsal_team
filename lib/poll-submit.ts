import { prisma } from "./prisma";
import { castClubVote, getClubPoll } from "./club-polls";
import { newPollReceipt, pollAccess, pollReceiptCookie, readPollReceipt } from "./poll-access";
import { pollJson } from "./poll-http";
import type { PollAccess } from "./club-polls";

export async function submitPoll(request: Request, id: string, input: Record<string, unknown>, context: { teamId: number; accountId: number | null; access: PollAccess }) {
  const { teamId, accountId, access } = context;
  const receipt = access.audience === "LEGACY" ? readPollReceipt() || newPollReceipt() : null;
  const voterAccess = receipt ? pollAccess(receipt) : access;
  await castClubVote(prisma, teamId, accountId, id, input.optionId, voterAccess, input.name);
  const response = pollJson(await getClubPoll(prisma, teamId, accountId, id, voterAccess), 201);
  if (receipt) response.cookies.set(pollReceiptCookie, receipt, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365, secure: new URL(request.url).protocol === "https:" });
  return response;
}
