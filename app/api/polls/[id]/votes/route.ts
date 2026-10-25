import { pollBody, pollContext, pollError } from "@/lib/poll-http";
import { submitPoll } from "@/lib/poll-submit";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const input = await pollBody(request);
    return await submitPoll(request, params.id, input, await pollContext());
  } catch (error) { return pollError(error); }
}
