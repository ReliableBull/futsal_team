"use server";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearAdminSession, requireAdmin, setAdminSession, verifyPassword } from "@/lib/auth";
import { createMatchRecord, deleteMatchRecord, parseMatchFormData, updateMatchRecord } from "@/lib/matches";
import { parsePlayerPosition } from "@/lib/player-position";
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
      position: parsePlayerPosition(getString(formData, "position")),
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
      position: parsePlayerPosition(getString(formData, "position")),
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

function getUploadPath(matchId: number) {
  return join(process.cwd(), "public", "uploads", "matches", String(matchId));
}

function getPublicUrl(matchId: number, fileName: string) {
  return `/uploads/matches/${matchId}/${fileName}`;
}

export async function uploadMatchPoster(matchId: number, formData: FormData) {
  await requireAdmin();

  const match = await prisma.match.findUnique({ where: { id: matchId }, select: { id: true } });
  if (!match) {
    throw new Error("존재하지 않는 경기입니다.");
  }

  const file = formData.get("posterImage");
  if (!(file instanceof File)) {
    throw new Error("이미지 파일을 선택해주세요.");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 업로드할 수 있습니다.");
  }
  if (file.size <= 0) {
    throw new Error("빈 파일은 업로드할 수 없습니다.");
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("이미지 용량은 20MB 이하만 업로드할 수 있습니다.");
  }

  const uploadDir = getUploadPath(matchId);
  await mkdir(uploadDir, { recursive: true });

  const originalExt = extname(file.name).toLowerCase();
  const ext = originalExt && originalExt.length <= 10 ? originalExt : ".jpg";
  const fileName = `${Date.now()}-${randomUUID()}${ext}`;
  const destination = join(uploadDir, fileName);
  const bytes = await file.arrayBuffer();

  await writeFile(destination, Buffer.from(bytes));

  await prisma.matchPoster.create({
    data: {
      matchId,
      imageUrl: getPublicUrl(matchId, fileName)
    }
  });

  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/matches");
  revalidatePath("/");
  revalidatePath(`/abcd/matches/${matchId}/edit`);
}

export async function deleteMatchPoster(matchId: number, posterId: number) {
  await requireAdmin();

  const poster = await prisma.matchPoster.findFirst({
    where: { id: posterId, matchId },
    select: { id: true, imageUrl: true }
  });
  if (!poster) {
    throw new Error("존재하지 않는 포스터입니다.");
  }

  await prisma.matchPoster.delete({ where: { id: poster.id } });

  const relativePath = poster.imageUrl.replace(/^\//, "");
  const absolutePath = join(process.cwd(), "public", relativePath);
  await unlink(absolutePath).catch(() => undefined);

  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/matches");
  revalidatePath("/");
  revalidatePath(`/abcd/matches/${matchId}/edit`);
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
