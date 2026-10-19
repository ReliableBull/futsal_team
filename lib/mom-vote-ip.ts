import { createHmac } from "node:crypto";
import { isIP } from "node:net";

export function normalizeIp(value: string | undefined | null): string | null {
  const ip = value?.trim();
  if (!ip || ip.includes("%") || !isIP(ip)) return null;
  if (isIP(ip) === 4) return ip;
  // URL canonicalization makes expanded/compressed IPv6 addresses equivalent.
  const normalized = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  const mapped = /^::ffff:([a-f0-9]+):([a-f0-9]+)$/.exec(normalized);
  if (!mapped) return normalized;
  const high = parseInt(mapped[1], 16), low = parseInt(mapped[2], 16);
  return [high >> 8, high & 255, low >> 8, low & 255].join(".");
}

/** Never trust a visitor-supplied forwarding header unless the socket peer is trusted. */
export function getVoteClientIp(peer: string | undefined, forwarded: string | string[] | undefined, trustedProxyIps = process.env.MOM_VOTE_TRUSTED_PROXY_IPS ?? ""): string | null {
  const socketIp = normalizeIp(peer);
  if (!socketIp) return null;
  const configured = trustedProxyIps.split(",").map((ip) => ip.trim()).filter(Boolean);
  const trusted = new Set(configured.map(normalizeIp));
  if (trusted.has(null)) throw new Error("MOM_VOTE_TRUSTED_PROXY_IPS must contain exact IP addresses.");
  if (!trusted.has(socketIp)) return socketIp;
  if (typeof forwarded !== "string" || forwarded.length > 2048) return null;
  const chain = forwarded.split(",").map(normalizeIp);
  if (chain.length > 20 || chain.some((ip) => !ip)) return null;
  // Walk away from our server, stopping at the first untrusted hop. Ignore any
  // earlier addresses a client may have prepended to X-Forwarded-For.
  let current = socketIp;
  for (let index = chain.length - 1; index >= 0 && trusted.has(current); index--) current = chain[index]!;
  return current;
}

export function hashVoteIp(matchId: number, ip: string, secret = process.env.MOM_VOTE_SECRET): string {
  if (!secret || secret.length < 32) throw new Error("MOM_VOTE_SECRET must contain at least 32 characters.");
  return createHmac("sha256", secret).update(`mom-v1:${matchId}:${ip}`).digest("hex");
}
