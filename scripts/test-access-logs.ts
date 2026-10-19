import assert from "node:assert/strict";
import {
  createAccessRateLimiter,
  describeIpScope,
  describeUserAgent,
  formatKstDateTime,
  getRetentionDays,
  normalizeAccessPath,
  normalizeReferrer,
  normalizeUserAgent,
  startOfKstDay
} from "../lib/access-logs";

assert.equal(normalizeAccessPath("/players?sort=goals"), "/players?sort=goals");
for (const value of [undefined, 1, "", "players", "//evil.example", "/a\nb", "https://example.com/"]) assert.equal(normalizeAccessPath(value), null);
assert.equal(normalizeAccessPath(`/${"a".repeat(600)}`)?.length, 512, "long paths are truncated, not dropped");

assert.equal(normalizeReferrer("https://www.google.com/search?q=arena"), "https://www.google.com/search?q=arena");
assert.equal(normalizeReferrer("https://user:pass@example.com/x"), "https://example.com/x", "credentials are stripped");
for (const value of ["", "javascript:alert(1)", "not a url", 42, null]) assert.equal(normalizeReferrer(value), null);
assert.equal(normalizeUserAgent("  Mozilla\u0000/5.0  "), "Mozilla/5.0");
assert.equal(normalizeUserAgent(undefined), null);

const iphoneKakao = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.0";
const androidSamsung = "Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36";
const windowsEdge = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0";
const macSafari = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
assert.equal(describeUserAgent(iphoneKakao), "iPhone · 카카오톡");
assert.equal(describeUserAgent(androidSamsung), "Android · 삼성 인터넷");
assert.equal(describeUserAgent(windowsEdge), "Windows · Edge");
assert.equal(describeUserAgent(macSafari), "macOS · Safari");
assert.equal(describeUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)"), "봇/크롤러");
assert.equal(describeUserAgent(null), "알 수 없음");

assert.equal(describeIpScope("127.0.0.1"), "로컬");
assert.equal(describeIpScope("192.168.0.28"), "내부망");
assert.equal(describeIpScope("172.20.1.1"), "내부망");
assert.equal(describeIpScope("100.101.102.103"), "Tailscale");
assert.equal(describeIpScope("203.0.113.10"), null);

// 2026-10-20 00:30 KST is still 2026-10-19 in UTC.
assert.equal(startOfKstDay(new Date("2026-10-19T15:30:00Z")).toISOString(), "2026-10-19T15:00:00.000Z");
assert.equal(startOfKstDay(new Date("2026-10-20T14:59:59Z")).toISOString(), "2026-10-19T15:00:00.000Z");
assert.equal(formatKstDateTime(new Date("2026-10-19T15:04:05Z")), "2026-10-20 00:04:05");

assert.equal(getRetentionDays(undefined), 90);
assert.equal(getRetentionDays("30"), 30);
for (const value of ["0", "-1", "1.5", "abc"]) assert.equal(getRetentionDays(value), 90);

const allow = createAccessRateLimiter({ limit: 3, windowMs: 60_000, duplicateMs: 3000 });
assert.equal(allow("192.0.2.1", "/", 0), true);
assert.equal(allow("192.0.2.1", "/", 1000), false, "same page within duplicate window counts once");
assert.equal(allow("192.0.2.1", "/", 4000), true);
assert.equal(allow("192.0.2.1", "/players", 5000), true);
assert.equal(allow("192.0.2.1", "/matches", 6000), false, "per-IP limit reached");
assert.equal(allow("192.0.2.2", "/matches", 6000), true, "other IPs are unaffected");
assert.equal(allow("192.0.2.1", "/matches", 61_000), true, "limit resets after the window");

console.log("Access log unit tests passed: input validation, UA/IP labels, KST day boundaries, rate limiting.");
