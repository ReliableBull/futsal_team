"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearAdminSession, requireAdmin, setAdminSession, verifyPassword } from "@/lib/auth";
import { createMatchRecord, deleteMatchRecord, parseMatchFormData, updateMatchRecord } from "@/lib/matches";
import { prisma } from "@/lib/prisma";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createPlayer(formData: FormData) {
  await requireAdmin();

  const name = getString(formData, "name");
  const position = getString(formData, "position");

  if (!name || !position) {
    throw new Error("선수 이름과 포지션은 필수입니다.");
  }

  await prisma.player.create({
    data: {
      name,
      nickname: getString(formData, "nickname") || null,
      position,
      number: getString(formData, "number") ? Number(getString(formData, "number")) : null,
      isActive: formData.get("isActive") === "on"
    }
  });

  revalidatePath("/");
  revalidatePath("/players");
  revalidatePath("/admin");
  redirect("/admin");
}

export async function createMatch(formData: FormData) {
  await requireAdmin();

  await createMatchRecord(parseMatchFormData(formData));

  revalidatePath("/");
  revalidatePath("/matches");
  revalidatePath("/players");
  revalidatePath("/admin");
  redirect("/admin");
}

export async function updateMatch(matchId: number, formData: FormData) {
  await requireAdmin();

  await updateMatchRecord(matchId, parseMatchFormData(formData));

  revalidatePath("/");
  revalidatePath("/matches");
  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/players");
  revalidatePath("/admin");
  redirect("/admin");
}

export async function deleteMatch(matchId: number) {
  await requireAdmin();

  await deleteMatchRecord(matchId);

  revalidatePath("/");
  revalidatePath("/matches");
  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/players");
  revalidatePath("/admin");
  redirect("/admin");
}

export async function loginAdmin(formData: FormData) {
  const username = getString(formData, "username");
  const password = getString(formData, "password");

  const admin = await prisma.admin.findUnique({ where: { username } });
  if (!admin || !verifyPassword(password, admin.passwordHash)) {
    redirect("/admin/login?error=1");
  }

  setAdminSession({ id: admin.id, username: admin.username });
  redirect("/admin");
}

export async function logoutAdmin() {
  clearAdminSession();
  redirect("/admin/login");
}
