import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authenticate, login } from "@/lib/mobile/auth";
import { ApiError, id, matchInput, page, playerInput, range } from "@/lib/mobile/validation";
import { calculatePlayerStats, calculatePlayerStreakHistories, getDashboardData, getPlayersWithStats } from "@/lib/stats";
import { getHallOfFameData } from "@/lib/hall-of-fame";
import { createMatchRecord, updateMatchRecord, deleteMatchRecord, matchInclude, MatchNotFoundError, MatchValidationError } from "@/lib/matches";
import { saveImage, removeImage } from "@/lib/mobile/images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
async function body(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new ApiError(415, "JSON 형식으로 전송해주세요.");
  // Bound streamed bodies too, not only the untrusted Content-Length header.
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "요청 내용이 없습니다.");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 128 * 1024) { await reader.cancel(); throw new ApiError(413, "요청이 너무 큽니다."); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new ApiError(400, "JSON 형식이 올바르지 않습니다."); }
}
function invalidate() {
  for (const path of ["/", "/players", "/matches", "/hall-of-fame", "/abcd"]) revalidatePath(path, "layout");
}
async function handle(request: Request, { params }: { params: { path: string[] } }) {
  try {
    const path = params.path, key = path.join("/"), method = request.method;
    const search = new URL(request.url).searchParams;
    if (key === "health" && method === "GET") return json({ status: "ok", apiVersion: 1 });
    if (key === "auth/login" && method === "POST") return json(await login(await body(request)));
    if (key === "auth/me" && method === "GET") return json({ admin: (await authenticate(request)).admin });
    if (key === "auth/logout" && method === "POST") {
      const session = await authenticate(request);
      await prisma.mobileSession.deleteMany({ where: { tokenHash: session.hash } });
      return json({ ok: true });
    }
    if (key === "dashboard" && method === "GET") {
      const data = await getDashboardData();
      // Stats helper carries matchPlayers internally; omit those from ranking DTOs.
      const clean = (items: typeof data.goalRankings) => items.map(item => { const { matchPlayers: _, ...dto } = item as typeof item & { matchPlayers?: unknown }; return dto; });
      return json({ ...data, goalRankings: clean(data.goalRankings), assistRankings: clean(data.assistRankings), mvpRankings: clean(data.mvpRankings), winRateRankings: clean(data.winRateRankings), winStreakRankings: clean(data.winStreakRankings), goalStreakRankings: clean(data.goalStreakRankings), assistStreakRankings: clean(data.assistStreakRankings) });
    }
    if (key === "hall-of-fame" && method === "GET") return json({ hallOfFame: await getHallOfFameData() });
    if (key === "players" && method === "GET") {
      const r = range(search);
      if (search.get("includeInactive") === "true") {
        await authenticate(request);
        return json({ players: await prisma.player.findMany({ orderBy: { name: "asc" } }) });
      }
      const players = (await getPlayersWithStats(r)).map(item => { const { matchPlayers: _, ...dto } = item as typeof item & { matchPlayers?: unknown }; return dto; });
      return json({ players });
    }
    if (path[0] === "players" && path.length === 2 && method === "GET") {
      const r = range(search);
      const player = await prisma.player.findUnique({ where: { id: id(path[1]) }, include: { matchPlayers: {
        where: { match: { status: "COMPLETED", ...(r ? { matchDate: { gte: r.start, lte: r.end } } : {}) } }, include: { match: true }, orderBy: [{ match: { matchDate: "desc" } }, { matchId: "desc" }]
      } } });
      if (!player) throw new ApiError(404, "선수를 찾을 수 없습니다.");
      return json({ player: calculatePlayerStats(player), streaks: calculatePlayerStreakHistories(player.matchPlayers) });
    }
    if (key === "matches" && method === "GET") {
      const r = range(search), p = page(search);
      const where = r ? { matchDate: { gte: r.start, lte: r.end } } : {};
      const [matches, total] = await prisma.$transaction([
        prisma.match.findMany({ where, include: { matchPlayers: { include: { player: true } } }, orderBy: [{ matchDate: "desc" }, { id: "desc" }], skip: p.skip, take: p.limit }),
        prisma.match.count({ where })
      ]);
      return json({ matches, pagination: { page: p.page, limit: p.limit, total, hasMore: p.skip + matches.length < total } });
    }
    if (path[0] === "matches" && path.length === 2 && method === "GET") {
      const match = await prisma.match.findUnique({ where: { id: id(path[1]) }, include: matchInclude });
      if (!match) throw new ApiError(404, "경기를 찾을 수 없습니다.");
      return json({ match });
    }
    await authenticate(request);
    let result: unknown; let status = 200;
    if (key === "players" && method === "POST") { result = { player: await prisma.player.create({ data: playerInput(await body(request)) }) }; status = 201; }
    else if (path[0] === "players" && path.length === 2 && method === "PUT") result = { player: await prisma.player.update({ where: { id: id(path[1]) }, data: playerInput(await body(request)) }) };
    else if (path[0] === "players" && path.length === 2 && method === "DELETE") {
      const playerId = id(path[1]);
      const deleted = await prisma.$transaction(async tx => {
        if (await tx.matchPlayer.count({ where: { playerId } })) throw new ApiError(409, "경기 기록이 있는 선수는 비활성화해주세요.");
        return tx.player.delete({ where: { id: playerId } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if (deleted.profileImageUrl?.startsWith(`/uploads/players/${playerId}/`)) await removeImage(deleted.profileImageUrl);
      result = { ok: true };
    }
    else if (key === "matches" && method === "POST") { result = { match: await createMatchRecord(matchInput(await body(request))) }; status = 201; }
    else if (path[0] === "matches" && path.length === 2 && method === "PUT") result = { match: await updateMatchRecord(id(path[1]), matchInput(await body(request))) };
    else if (path[0] === "matches" && path.length === 2 && method === "DELETE") { await deleteMatchRecord(id(path[1])); result = { ok: true }; }
    else if (path[0] === "players" && path[2] === "photo" && path.length === 3 && method === "POST") {
      const playerId = id(path[1]);
      const player = await prisma.player.findUnique({ where: { id: playerId } });
      if (!player) throw new ApiError(404, "선수를 찾을 수 없습니다.");
      const imageUrl = await saveImage(request, "players", playerId);
      try { result = { player: await prisma.player.update({ where: { id: playerId }, data: { profileImageUrl: imageUrl } }) }; }
      catch (error) { await removeImage(imageUrl); throw error; }
      if (player.profileImageUrl?.startsWith(`/uploads/players/${playerId}/`)) await removeImage(player.profileImageUrl);
    }
    else if (path[0] === "matches" && path[2] === "posters" && path.length === 3 && method === "POST") {
      const matchId = id(path[1]);
      if (!await prisma.match.findUnique({ where: { id: matchId }, select: { id: true } })) throw new ApiError(404, "경기를 찾을 수 없습니다.");
      const imageUrl = await saveImage(request, "matches", matchId);
      try { result = { poster: await prisma.matchPoster.create({ data: { matchId, imageUrl } }) }; }
      catch (error) { await removeImage(imageUrl); throw error; }
      status = 201;
    }
    else if (path[0] === "matches" && path[2] === "posters" && path.length === 4 && method === "DELETE") {
      const poster = await prisma.matchPoster.findFirst({ where: { id: id(path[3]), matchId: id(path[1]) } });
      if (!poster) throw new ApiError(404, "포스터를 찾을 수 없습니다.");
      await prisma.matchPoster.delete({ where: { id: poster.id } }); await removeImage(poster.imageUrl); result = { ok: true };
    }
    else throw new ApiError(404, "지원하지 않는 API입니다.");
    invalidate(); return json(result, status);
  } catch (error) {
    if (error instanceof ApiError || error instanceof MatchValidationError || error instanceof MatchNotFoundError) return json({ error: error.message }, error.status);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") return json({ error: "대상을 찾을 수 없습니다." }, 404);
      if (["P2003", "P2034"].includes(error.code)) return json({ error: "연결된 기록이 있거나 다른 변경이 진행 중입니다. 새로고침해주세요." }, 409);
    }
    console.error("[mobile-api] request failed", error instanceof Error ? error.name : "unknown");
    return json({ error: "서버에서 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요." }, 500);
  }
}
export { handle as GET, handle as POST, handle as PUT, handle as DELETE };
