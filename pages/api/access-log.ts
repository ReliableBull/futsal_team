import type { NextApiRequest, NextApiResponse } from "next";
import { normalizeAccessPath, normalizeReferrer, normalizeUserAgent, recordAccessLog } from "@/lib/access-logs";
import { adminSessionCookieName, isTeamAdminSession } from "@/lib/auth";
import { getVoteClientIp } from "@/lib/mom-vote-ip";
import { getPagesTeam } from "@/lib/teams";

// Pages API provides the real TCP peer, so visitors cannot forge the logged IP
// with X-Forwarded-For. Proxy trust follows MOM_VOTE_TRUSTED_PROXY_IPS.
export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };

function isSameOrigin(request: NextApiRequest) {
  if (request.headers["sec-fetch-site"] === "cross-site") return false;
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return ["http:", "https:"].includes(url.protocol) && (url.host === request.headers.host || url.origin === new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").origin);
  } catch {
    return false;
  }
}

function resolveClientIp(request: NextApiRequest) {
  try {
    return getVoteClientIp(request.socket.remoteAddress, request.headers["x-forwarded-for"]) ?? "unknown";
  } catch (error) {
    console.error("Access log IP resolution failed:", error instanceof Error ? error.message : "UnknownError");
    return "unknown";
  }
}

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  response.setHeader("Cache-Control", "private, no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).end();
  }
  if (request.headers["content-type"]?.split(";")[0].trim() !== "application/json") return response.status(415).end();
  if (!isSameOrigin(request)) return response.status(403).end();

  const path = normalizeAccessPath(request.body?.path);
  if (!path) return response.status(400).end();

  try {
    const team = await getPagesTeam(request.headers["x-futsal-team"]);
    if (!team) return response.status(404).end();
    await recordAccessLog({
      teamId: team.id,
      ip: resolveClientIp(request),
      path,
      referrer: normalizeReferrer(request.body?.referrer),
      userAgent: normalizeUserAgent(request.headers["user-agent"]),
      isAdmin: await isTeamAdminSession(request.cookies[adminSessionCookieName], team.id)
    });
  } catch (error) {
    console.error("Access log write failed:", error instanceof Error ? error.message : "UnknownError");
  }
  return response.status(204).end();
}
