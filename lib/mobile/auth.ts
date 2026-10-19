import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { ApiError, object, string } from "./validation";

export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const duration = 8 * 60 * 60 * 1000;
// Single-process backstop. Deploy the proxy limiter documented in docs/MOBILE.md too.
const globalState = globalThis as unknown as { mobileAttempts?: Map<string, { count: number; reset: number }> };
const attempts = globalState.mobileAttempts ??= new Map();
export function throttleLogin(username: string, now = Date.now()) {
  for (const [key, value] of Array.from(attempts)) if (value.reset <= now) attempts.delete(key);
  for (const key of ["all", `user:${username.toLowerCase()}`]) {
    const value = attempts.get(key) ?? { count: 0, reset: now + 15 * 60 * 1000 };
    if (value.count >= (key === "all" ? 100 : 10)) throw new ApiError(429, "로그인 시도가 많습니다. 15분 후 다시 시도해주세요.");
    value.count += 1; attempts.set(key, value);
  }
}
export async function login(input: unknown) {
  const b = object(input);
  const username = string(b.username, "아이디");
  if (typeof b.password !== "string" || !b.password || b.password.length > 256) throw new ApiError(400, "비밀번호를 확인해주세요.");
  throttleLogin(username);
  const admin = await prisma.admin.findUnique({ where: { username } });
  if (!admin || !verifyPassword(b.password, admin.passwordHash)) throw new ApiError(401, "아이디 또는 비밀번호가 올바르지 않습니다.");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + duration);
  await prisma.mobileSession.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  await prisma.mobileSession.create({ data: { tokenHash: tokenHash(token), adminId: admin.id, passwordVersion: tokenHash(admin.passwordHash), expiresAt } });
  return { token, expiresAt, admin: { id: admin.id, username: admin.username } };
}
export async function authenticate(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  if (!/^Bearer [A-Za-z0-9_-]{43}$/.test(value)) throw new ApiError(401, "관리자 로그인이 필요합니다.");
  const hash = tokenHash(value.slice(7));
  const session = await prisma.mobileSession.findUnique({ where: { tokenHash: hash }, include: { admin: true } });
  if (!session || session.expiresAt.getTime() <= Date.now() || session.passwordVersion !== tokenHash(session.admin.passwordHash)) throw new ApiError(401, "로그인이 만료되었습니다. 다시 로그인해주세요.");
  return { hash, admin: { id: session.admin.id, username: session.admin.username } };
}
