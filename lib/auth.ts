import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const sessionCookieName = "arena_admin_session";
const sessionMaxAge = 60 * 60 * 8;
const passwordIterations = 120000;
const passwordKeyLength = 64;
const passwordDigest = "sha512";
const sessionSecret = process.env.AUTH_SECRET ?? "arena-futsal-record-local-secret";
const useSecureCookies = process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://") ?? false;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, passwordIterations, passwordKeyLength, passwordDigest).toString("hex");

  return `pbkdf2:${passwordIterations}:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [scheme, iterationsValue, salt, hash] = storedHash.split(":");

  if (scheme !== "pbkdf2" || !iterationsValue || !salt || !hash) {
    return false;
  }

  const iterations = Number(iterationsValue);
  if (!Number.isInteger(iterations)) {
    return false;
  }

  const expected = Buffer.from(hash, "hex");
  const actual = pbkdf2Sync(password, salt, iterations, expected.length, passwordDigest);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function signSession(adminId: number, username: string, expiresAt: number) {
  const payload = `${adminId}.${username}.${expiresAt}`;
  const signature = createHmac("sha256", sessionSecret).update(payload).digest("hex");

  return `${payload}.${signature}`;
}

function verifySession(value?: string) {
  if (!value) return null;

  const parts = value.split(".");
  if (parts.length !== 4) return null;

  const [adminIdValue, username, expiresAtValue, signature] = parts;
  const adminId = Number(adminIdValue);
  const expiresAt = Number(expiresAtValue);

  if (!Number.isInteger(adminId) || !username || !Number.isInteger(expiresAt) || expiresAt < Date.now()) {
    return null;
  }

  const expected = signSession(adminId, username, expiresAt).split(".").at(-1);
  const expectedBuffer = Buffer.from(expected ?? "", "hex");
  const actualBuffer = Buffer.from(signature, "hex");

  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }

  return { adminId, username };
}

export async function getCurrentAdmin() {
  const session = verifySession(cookies().get(sessionCookieName)?.value);
  if (!session) return null;

  return prisma.admin.findUnique({
    where: { id: session.adminId },
    select: { id: true, username: true }
  });
}

export async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect("/abcd/login");
  }

  return admin;
}

export function setAdminSession(admin: { id: number; username: string }) {
  const expiresAt = Date.now() + sessionMaxAge * 1000;

  cookies().set(sessionCookieName, signSession(admin.id, admin.username, expiresAt), {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookies,
    path: "/",
    maxAge: sessionMaxAge
  });
}

export function clearAdminSession() {
  cookies().delete(sessionCookieName);
}
