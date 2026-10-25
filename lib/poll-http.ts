import { NextResponse } from "next/server";
import { getSignedInAdmin } from "./auth";
import { getCurrentTeam } from "./teams";
import { pollAccess } from "./poll-access";
import { PollError } from "./poll-validation";

export async function pollContext() {
  const team = await getCurrentTeam();
  const account = await getSignedInAdmin();
  return { teamId: team.id, accountId: account?.id ?? null, access: pollAccess() };
}

export function pollJson(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function pollError(error: unknown) {
  if (error instanceof PollError) return pollJson({ error: error.message }, error.status);
  if (error && typeof error === "object" && "digest" in error && error.digest === "NEXT_NOT_FOUND") return pollJson({ error: "투표를 찾을 수 없습니다." }, 404);
  console.error("Club poll request failed:", error instanceof Error ? error.name : "UnknownError");
  return pollJson({ error: "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요." }, 500);
}

export async function pollBody(request: Request): Promise<Record<string, unknown>> {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new PollError(403, "동호회 페이지에서 다시 시도해주세요.");
  if (origin) {
    let url: URL;
    try { url = new URL(origin); } catch { throw new PollError(403, "요청 주소를 확인해주세요."); }
    if (!["http:", "https:"].includes(url.protocol) || url.host !== request.headers.get("host")) throw new PollError(403, "동호회 페이지에서 다시 시도해주세요.");
  }
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new PollError(415, "JSON 형식으로 전송해주세요.");
  const reader = request.body?.getReader();
  if (!reader) throw new PollError(400, "요청 내용을 확인해주세요.");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 16384) { await reader.cancel(); throw new PollError(413, "투표 내용이 너무 깁니다."); }
    chunks.push(value);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new PollError(400, "요청 내용을 확인해주세요."); }
}
