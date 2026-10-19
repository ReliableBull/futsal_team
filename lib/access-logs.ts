import { isIP } from "node:net";
import { prisma } from "@/lib/prisma";

const maxFieldLength = 512;
const defaultRetentionDays = 90;
const cleanupIntervalMs = 60 * 60 * 1000;
const kstOffsetMs = 9 * 60 * 60 * 1000;

function truncate(value: string) {
  return value.length > maxFieldLength ? value.slice(0, maxFieldLength) : value;
}

/** Accepts only same-site absolute paths, e.g. "/players?sort=goals". */
export function normalizeAccessPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//") || /[\u0000-\u001f\u007f]/.test(path)) return null;
  return truncate(path);
}

export function normalizeReferrer(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim() || /[\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.username = "";
    url.password = "";
    return truncate(url.toString());
  } catch {
    return null;
  }
}

export function normalizeUserAgent(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const userAgent = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return userAgent ? truncate(userAgent) : null;
}

const browserRules: [RegExp, string][] = [
  [/KAKAOTALK/i, "카카오톡"],
  [/NAVER\(inapp|NAVER\//i, "네이버앱"],
  [/Instagram/i, "인스타그램"],
  [/FBAN|FBAV/i, "페이스북"],
  [/SamsungBrowser/i, "삼성 인터넷"],
  [/Whale\//i, "웨일"],
  [/EdgA?\/|EdgiOS/i, "Edge"],
  [/OPR\//i, "Opera"],
  [/CriOS|Chrome\//i, "Chrome"],
  [/FxiOS|Firefox\//i, "Firefox"],
  [/Safari\//i, "Safari"]
];

const osRules: [RegExp, string][] = [
  [/iPhone/i, "iPhone"],
  [/iPad/i, "iPad"],
  [/Android/i, "Android"],
  [/Windows/i, "Windows"],
  [/CrOS/i, "ChromeOS"],
  [/Mac OS X|Macintosh/i, "macOS"],
  [/Linux/i, "Linux"]
];

export function describeUserAgent(userAgent: string | null | undefined) {
  if (!userAgent) return "알 수 없음";
  if (/bot|crawl|spider|slurp|preview|scrap|headless|curl|wget|python-requests/i.test(userAgent)) return "봇/크롤러";
  const os = osRules.find(([pattern]) => pattern.test(userAgent))?.[1];
  const browser = browserRules.find(([pattern]) => pattern.test(userAgent))?.[1];
  return [os, browser].filter(Boolean).join(" · ") || "기타";
}

/** Labels addresses that never come from the public internet. */
export function describeIpScope(ip: string) {
  if (ip === "127.0.0.1" || ip === "::1") return "로컬";
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return "내부망";
    if (a === 100 && b >= 64 && b <= 127) return "Tailscale";
  }
  if (isIP(ip) === 6 && /^f[cd]/i.test(ip)) return "내부망";
  return null;
}

/** Start of the current day in Korea, which is the club's reporting day. */
export function startOfKstDay(now = new Date()) {
  const kst = new Date(now.getTime() + kstOffsetMs);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - kstOffsetMs);
}

export function formatKstDateTime(date: Date) {
  // sv-SE renders as "2026-10-20 15:04:05".
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

type RateLimiterOptions = { limit: number; windowMs: number; duplicateMs: number };

/**
 * In-memory guard so one client cannot flood the log table. Repeated hits on the
 * same path within duplicateMs (refreshes, React dev double effects) count once.
 */
export function createAccessRateLimiter({ limit, windowMs, duplicateMs }: RateLimiterOptions) {
  const windows = new Map<string, { start: number; count: number }>();
  const lastSeen = new Map<string, number>();

  function sweep(now: number) {
    windows.forEach((entry, key) => {
      if (now - entry.start >= windowMs) windows.delete(key);
    });
    lastSeen.forEach((time, key) => {
      if (now - time >= duplicateMs) lastSeen.delete(key);
    });
  }

  return function allow(ip: string, path: string, now = Date.now()) {
    if (windows.size > 5000 || lastSeen.size > 5000) sweep(now);
    const pathKey = `${ip}\n${path}`;
    const previous = lastSeen.get(pathKey);
    if (previous !== undefined && now - previous < duplicateMs) return false;

    const entry = windows.get(ip);
    if (!entry || now - entry.start >= windowMs) {
      windows.set(ip, { start: now, count: 1 });
    } else if (entry.count >= limit) {
      return false;
    } else {
      entry.count += 1;
    }
    lastSeen.set(pathKey, now);
    return true;
  };
}

export function getRetentionDays(value = process.env.ACCESS_LOG_RETENTION_DAYS) {
  const days = Number(value);
  return Number.isInteger(days) && days > 0 ? days : defaultRetentionDays;
}

const allowAccessLog = createAccessRateLimiter({ limit: 30, windowMs: 60 * 1000, duplicateMs: 3000 });
let lastCleanupAt = 0;

export async function recordAccessLog(entry: { ip: string; path: string; referrer: string | null; userAgent: string | null; isAdmin: boolean }) {
  if (!allowAccessLog(entry.ip, entry.path)) return false;
  await prisma.accessLog.create({ data: entry });

  const now = Date.now();
  if (now - lastCleanupAt >= cleanupIntervalMs) {
    lastCleanupAt = now;
    const cutoff = new Date(now - getRetentionDays() * 24 * 60 * 60 * 1000);
    await prisma.accessLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  }
  return true;
}
