import type { NextApiRequest, NextApiResponse } from "next";
import { getVoteClientIp, hashVoteIp } from "@/lib/mom-vote-ip";
import { getMomPoll, MomVoteError, submitMomBallot } from "@/lib/mom-votes";

// Pages API provides the real TCP peer; App Router request headers alone cannot
// distinguish a client-supplied X-Forwarded-For value from a trusted proxy value.
export const config = { api: { bodyParser: { sizeLimit: "2kb" } } };

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (request.method !== "GET" && request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "지원하지 않는 요청입니다." });
  }
  const rawId = request.query.id;
  const matchId = typeof rawId === "string" && /^[1-9]\d*$/.test(rawId) ? Number(rawId) : NaN;
  if (!Number.isSafeInteger(matchId) || matchId > 2147483647) return response.status(400).json({ error: "경기 ID가 올바르지 않습니다." });
  try {
    if (request.method === "POST") {
      // JSON-only requests and same-origin checks also prevent other websites
      // from silently consuming a visitor's one vote through a form submission.
      if (request.headers["content-type"]?.split(";")[0].trim() !== "application/json") throw new MomVoteError(415, "JSON 형식으로 투표해주세요.");
      if (request.headers["sec-fetch-site"] === "cross-site") throw new MomVoteError(403, "투표 페이지에서 다시 시도해주세요.");
      const origin = request.headers.origin;
      if (origin) {
        let allowed = false;
        try { const url = new URL(origin); allowed = ["http:", "https:"].includes(url.protocol) && (url.host === request.headers.host || url.origin === new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").origin); } catch {}
        if (!allowed) throw new MomVoteError(403, "투표 페이지에서 다시 시도해주세요.");
      }
    }
    const ip = getVoteClientIp(request.socket.remoteAddress, request.headers["x-forwarded-for"]);
    if (!ip) throw new MomVoteError(503, "접속 정보를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.");
    const voterHash = hashVoteIp(matchId, ip);
    if (request.method === "GET") return response.status(200).json(await getMomPoll(matchId, voterHash));
    await submitMomBallot(matchId, voterHash, request.body);
    return response.status(201).json({ hasVoted: true, message: "두 팀의 MOM 투표가 완료되었습니다." });
  } catch (error) {
    if (error instanceof MomVoteError) return response.status(error.status).json({ error: error.message });
    console.error("MOM vote request failed:", error instanceof Error ? error.name : "UnknownError");
    return response.status(500).json({ error: "투표를 처리하지 못했습니다. 잠시 후 다시 시도해주세요." });
  }
}
