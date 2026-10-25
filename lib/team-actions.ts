"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearAdminSession, getSignedInAdmin, hashPassword, requireAdmin, setAdminSession, verifyPassword } from "@/lib/auth";
import { throttleLogin } from "@/lib/mobile/auth";
import { prisma } from "@/lib/prisma";
import { currentTeamPath, getCurrentTeam, requirePlatformMode } from "@/lib/teams";
import { parseTeamFields, type TeamFormState } from "@/lib/team-validation";
import { loginReturnPath } from "@/lib/login-return";

export async function createTeam(_state: TeamFormState, form: FormData): Promise<TeamFormState> {
  requirePlatformMode();
  const current = await getSignedInAdmin();
  let slug: string;
  try {
    const fields = parseTeamFields(form);
    slug = fields.slug;
    let credentials: { username: string; passwordHash: string } | undefined;
    if (!current) {
      const username = String(form.get("username") ?? "").trim();
      const password = String(form.get("password") ?? "");
      if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username)) throw new Error("아이디는 영문·숫자·밑줄·하이픈으로 3~32자 입력해주세요.");
      if (password.length < 10 || password.length > 128) throw new Error("비밀번호는 10~128자로 입력해주세요.");
      throttleLogin(`register:${username}`);
      credentials = { username, passwordHash: hashPassword(password) };
    }
    const admin = await prisma.$transaction(async (tx) => {
      const owner = current ?? await tx.admin.create({ data: credentials! });
      await tx.team.create({ data: { ...fields, admins: { create: { adminId: owner.id, role: "PRESIDENT" } } } });
      return owner;
    });
    setAdminSession(admin);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "이미 사용 중인 팀 주소 또는 아이디입니다. 기존 계정은 로그인 후 팀을 만들어주세요." };
    if (error instanceof Prisma.PrismaClientKnownRequestError) return { error: "팀을 만들지 못했습니다. 잠시 후 다시 시도해주세요." };
    return { error: error instanceof Error ? error.message : "입력 내용을 확인해주세요." };
  }
  revalidatePath("/");
  revalidatePath("/teams");
  redirect(`/t/${slug}/abcd`);
}

export async function updateTeam(_state: TeamFormState, form: FormData): Promise<TeamFormState> {
  requirePlatformMode();
  await requireAdmin();
  const team = await getCurrentTeam();
  try {
    // Stable addresses preserve shared match links.
    form.set("slug", team.slug);
    const data = parseTeamFields(form);
    await prisma.team.update({ where: { id: team.id }, data });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "팀 정보를 저장하지 못했습니다." };
  }
  revalidatePath("/", "layout");
  redirect(currentTeamPath("/abcd?updated=1"));
}

export async function loginPlatform(_state: TeamFormState, form: FormData): Promise<TeamFormState> {
  requirePlatformMode();
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");
  try { throttleLogin(username); } catch { return { error: "로그인 시도가 많습니다. 잠시 후 다시 시도해주세요." }; }
  if (username.length > 32 || password.length > 256) return { error: "아이디 또는 비밀번호를 확인해주세요." };
  const admin = await prisma.admin.findUnique({ where: { username } });
  if (!admin || !verifyPassword(password, admin.passwordHash)) return { error: "아이디 또는 비밀번호를 확인해주세요." };
  setAdminSession(admin);
  redirect(loginReturnPath(form.get("next")));
}

export async function logoutPlatform() {
  clearAdminSession();
  redirect("/");
}
