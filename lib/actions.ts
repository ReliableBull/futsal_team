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

  if (!name) {
    throw new Error("선수 이름은 필수입니다.");
  }

  await prisma.player.create({
    data: {
      name,
      nickname: getString(formData, "nickname") || null,
      profileImageUrl: getString(formData, "profileImageUrl") || null,
      position: "FP",
      number: getString(formData, "number") ? Number(getString(formData, "number")) : null,
      isActive: formData.get("isActive") === "on"
    }
  });

  revalidatePath("/");
  revalidatePath("/players");
  revalidatePath("/abcd");
  redirect("/abcd");
}

export async function updatePlayer(playerId: number, formData: FormData) {
  await requireAdmin();

  const name = getString(formData, "name");

  if (!name) {
    throw new Error("선수 이름은 필수입니다.");
  }

  await prisma.player.update({
    where: { id: playerId },
    data: {
      name,
      nickname: getString(formData, "nickname") || null,
      profileImageUrl: getString(formData, "profileImageUrl") || null,
      number: getString(formData, "number") ? Number(getString(formData, "number")) : null,
      isActive: formData.get("isActive") === "on"
    }
  });

  revalidatePath("/");
  revalidatePath("/players");
  revalidatePath(`/players/${playerId}`);
  revalidatePath("/abcd");
  redirect("/abcd");
}

export async function deletePlayer(playerId: number) {
  await requireAdmin();

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      _count: {
        select: { matchPlayers: true }
      }
    }
  });

  if (!player) {
    throw new Error("존재하지 않는 선수입니다.");
  }

  if (player._count.matchPlayers > 0) {
    throw new Error("경기 이력이 있는 선수는 삭제할 수 없습니다. 선수 목록 포함을 해제해주세요.");
  }

  await prisma.player.delete({ where: { id: playerId } });

  revalidatePath("/");
  revalidatePath("/players");
  revalidatePath("/abcd");
  redirect("/abcd");
}

export async function createMatch(formData: FormData) {
  await requireAdmin();

  await createMatchRecord(parseMatchFormData(formData));

  revalidatePath("/");
  revalidatePath("/matches");
  revalidatePath("/players");
  revalidatePath("/abcd");
  redirect("/abcd");
}

export async function updateMatch(matchId: number, formData: FormData) {
  await requireAdmin();

  await updateMatchRecord(matchId, parseMatchFormData(formData));

  revalidatePath("/");
  revalidatePath("/matches");
  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/players");
  revalidatePath("/abcd");
  redirect("/abcd");
}

export async function deleteMatch(matchId: number) {
  await requireAdmin();

  await deleteMatchRecord(matchId);

  revalidatePath("/");
  revalidatePath("/matches");
  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/players");
  revalidatePath("/abcd");
  redirect("/abcd");
}

export async function loginAdmin(formData: FormData) {
  const username = getString(formData, "username");
  const password = getString(formData, "password");

  const admin = await prisma.admin.findUnique({ where: { username } });
  if (!admin || !verifyPassword(password, admin.passwordHash)) {
    redirect("/abcd/login?error=1");
  }

  setAdminSession({ id: admin.id, username: admin.username });
  redirect("/abcd");
}

export async function logoutAdmin() {
  clearAdminSession();
  redirect("/abcd/login");
}
