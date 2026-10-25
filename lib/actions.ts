"use server";

import { adminLoginReturnPath } from "./login-return";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { revalidatePath } from "next/cache";
import { redirectToTeam as redirect, currentTeamPath, getCurrentTeam } from "@/lib/teams";
import { canManageTeam, clearAdminSession, requireAdmin, setAdminSession, verifyPassword } from "@/lib/auth";
import { createMatchRecord, deleteMatchRecord, parseMatchFormData, updateMatchRecord } from "@/lib/matches";
import { parsePlayerPosition } from "@/lib/player-position";
import { getTeamPrisma } from "@/lib/teams";
import { prisma as accountDb } from "@/lib/prisma";

function revalidateTeamPath(path: string) {
  revalidatePath(currentTeamPath(path));
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function getPlayerProfileImageDataUrl(formData: FormData) {
  const file = formData.get("profileImage");
  if (!(file instanceof File) || file.size <= 0) {
    return null;
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("프로필 사진은 이미지 파일만 업로드할 수 있습니다.");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("프로필 사진 용량은 2MB 이하만 업로드할 수 있습니다.");
  }

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");

  return `data:${file.type};base64,${base64}`;
}

async function deleteLocalUpload(publicUrl: string | null | undefined) {
  if (!publicUrl?.startsWith("/uploads/")) return;

  const relativePath = publicUrl.replace(/^\//, "");
  const absolutePath = join(process.cwd(), "public", relativePath);
  await unlink(absolutePath).catch(() => undefined);
}

export async function createPlayer(formData: FormData) {
  const prisma = await getTeamPrisma();
  await requireAdmin();

  const name = getString(formData, "name");

  if (!name) {
    throw new Error("선수 이름은 필수입니다.");
  }

  const uploadedImageUrl = await getPlayerProfileImageDataUrl(formData);

  await prisma.player.create({
    data: {
      name,
      nickname: getString(formData, "nickname") || null,
      profileImageUrl: uploadedImageUrl ?? (getString(formData, "profileImageUrl") || null),
      position: parsePlayerPosition(getString(formData, "position")),
      number: getString(formData, "number") ? Number(getString(formData, "number")) : null,
      isActive: formData.get("isActive") === "on"
    }
  });

  revalidateTeamPath("/");
  revalidateTeamPath("/players");
  revalidateTeamPath("/abcd");
  redirect("/abcd");
}

export async function updatePlayer(playerId: number, formData: FormData) {
  const prisma = await getTeamPrisma();
  await requireAdmin();

  const name = getString(formData, "name");

  if (!name) {
    throw new Error("선수 이름은 필수입니다.");
  }

  const currentPlayer = await prisma.player.findUnique({
    where: { id: playerId },
    select: { profileImageUrl: true }
  });
  const uploadedImageUrl = await getPlayerProfileImageDataUrl(formData);
  const profileImageUrl = uploadedImageUrl ?? (getString(formData, "profileImageUrl") || null);

  await prisma.player.update({
    where: { id: playerId },
    data: {
      name,
      nickname: getString(formData, "nickname") || null,
      profileImageUrl,
      position: parsePlayerPosition(getString(formData, "position")),
      number: getString(formData, "number") ? Number(getString(formData, "number")) : null,
      isActive: formData.get("isActive") === "on"
    }
  });
  if (uploadedImageUrl && currentPlayer?.profileImageUrl !== uploadedImageUrl) {
    await deleteLocalUpload(currentPlayer?.profileImageUrl);
  }

  revalidateTeamPath("/");
  revalidateTeamPath("/players");
  revalidateTeamPath(`/players/${playerId}`);
  revalidateTeamPath("/abcd");
  redirect("/abcd");
}

export async function deletePlayer(playerId: number) {
  const prisma = await getTeamPrisma();
  await requireAdmin();

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      profileImageUrl: true,
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
  await deleteLocalUpload(player.profileImageUrl);

  revalidateTeamPath("/");
  revalidateTeamPath("/players");
  revalidateTeamPath("/abcd");
  redirect("/abcd");
}

export async function createMatch(formData: FormData) {
  await requireAdmin();

  await createMatchRecord(parseMatchFormData(formData));

  revalidateTeamPath("/");
  revalidateTeamPath("/matches");
  revalidateTeamPath("/players");
  revalidateTeamPath("/abcd");
  redirect("/abcd");
}

export async function updateMatch(matchId: number, formData: FormData) {
  await requireAdmin();

  await updateMatchRecord(matchId, parseMatchFormData(formData));

  revalidateTeamPath("/");
  revalidateTeamPath("/matches");
  revalidateTeamPath(`/matches/${matchId}`);
  revalidateTeamPath("/players");
  revalidateTeamPath("/abcd");
  redirect("/abcd");
}

export async function deleteMatch(matchId: number) {
  await requireAdmin();

  await deleteMatchRecord(matchId);

  revalidateTeamPath("/");
  revalidateTeamPath("/matches");
  revalidateTeamPath(`/matches/${matchId}`);
  revalidateTeamPath("/players");
  revalidateTeamPath("/abcd");
  redirect("/abcd");
}

function getUploadPath(matchId: number) {
  return join(process.cwd(), "public", "uploads", "matches", String(matchId));
}

function getPublicUrl(matchId: number, fileName: string) {
  return `/uploads/matches/${matchId}/${fileName}`;
}

export async function uploadMatchPoster(matchId: number, formData: FormData) {
  const prisma = await getTeamPrisma();
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

  revalidateTeamPath(`/matches/${matchId}`);
  revalidateTeamPath("/matches");
  revalidateTeamPath("/");
  revalidateTeamPath(`/abcd/matches/${matchId}/edit`);
}

export async function deleteMatchPoster(matchId: number, posterId: number) {
  const prisma = await getTeamPrisma();
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

  revalidateTeamPath(`/matches/${matchId}`);
  revalidateTeamPath("/matches");
  revalidateTeamPath("/");
  revalidateTeamPath(`/abcd/matches/${matchId}/edit`);
}

export async function loginAdmin(formData: FormData) {
  const next = adminLoginReturnPath(formData.get("next"));
  const username = getString(formData, "username");
  const password = String(formData.get("password") ?? "");

  const admin = await accountDb.admin.findUnique({ where: { username } });
  if (!admin || !verifyPassword(password, admin.passwordHash) || !await canManageTeam(admin.id, (await getCurrentTeam()).id)) {
    redirect(`/abcd/login?error=1&next=${encodeURIComponent(next)}`);
  }

  setAdminSession({ id: admin.id, username: admin.username });
  redirect(next);
}

export async function logoutAdmin() {
  clearAdminSession();
  redirect("/abcd/login");
}
