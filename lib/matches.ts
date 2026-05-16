import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { matchResult, matchStatus, type MatchResultValue, type MatchStatusValue } from "@/lib/stats";

export class MatchValidationError extends Error {
  status = 400;
}

export class MatchNotFoundError extends Error {
  status = 404;
}

export type MatchPayload = {
  matchDate: string;
  status: MatchStatusValue;
  location: string;
  teamAName: string;
  teamBName: string;
  teamAScore: number;
  teamBScore: number;
  teamAPlayerIds: number[];
  teamBPlayerIds: number[];
  goalsByPlayerId: Record<number, number>;
  assistsByPlayerId: Record<number, number>;
  chairmanTeamMvpId: number | null;
  managerTeamMvpId: number | null;
  memo: string | null;
};

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown, fieldName: string) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new MatchValidationError(`${fieldName} 값이 올바르지 않습니다.`);
  }

  return parsed;
}

function asOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asMatchStatus(value: FormDataEntryValue | null): MatchStatusValue {
  return value === matchStatus.completed ? matchStatus.completed : matchStatus.inProgress;
}

function uniqueIds(values: unknown[]) {
  return Array.from(new Set(values.map((value) => Number(value)).filter((value) => Number.isInteger(value))));
}

function normalizeRecord(input: unknown) {
  if (!input || typeof input !== "object") return {};
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).map(([key, value]) => [Number(key), Math.max(0, asOptionalNumber(value) ?? 0)])
  );
}

export function parseMatchFormData(formData: FormData): MatchPayload {
  const selectedIds = uniqueIds([...formData.getAll("teamAPlayers"), ...formData.getAll("teamBPlayers")]);

  return {
    matchDate: asString(formData.get("matchDate")),
    status: asMatchStatus(formData.get("status")),
    location: asString(formData.get("location")),
    teamAName: asString(formData.get("teamAName")) || "회장팀",
    teamBName: asString(formData.get("teamBName")) || "총무팀",
    teamAScore: asNumber(asString(formData.get("teamAScore")), "회장팀 점수"),
    teamBScore: asNumber(asString(formData.get("teamBScore")), "총무팀 점수"),
    teamAPlayerIds: uniqueIds(formData.getAll("teamAPlayers")),
    teamBPlayerIds: uniqueIds(formData.getAll("teamBPlayers")),
    goalsByPlayerId: Object.fromEntries(
      selectedIds.map((playerId) => [playerId, Math.max(0, asOptionalNumber(asString(formData.get(`goals_${playerId}`))) ?? 0)])
    ),
    assistsByPlayerId: Object.fromEntries(
      selectedIds.map((playerId) => [playerId, Math.max(0, asOptionalNumber(asString(formData.get(`assists_${playerId}`))) ?? 0)])
    ),
    chairmanTeamMvpId: asOptionalNumber(asString(formData.get("chairmanTeamMvpId"))),
    managerTeamMvpId: asOptionalNumber(asString(formData.get("managerTeamMvpId"))),
    memo: asString(formData.get("memo")) || null
  };
}

export function parseMatchJson(input: unknown): MatchPayload {
  if (!input || typeof input !== "object") {
    throw new MatchValidationError("요청 데이터가 올바르지 않습니다.");
  }

  const body = input as Record<string, unknown>;

  return {
    matchDate: String(body.matchDate ?? "").trim(),
    status: body.status === matchStatus.completed ? matchStatus.completed : matchStatus.inProgress,
    location: String(body.location ?? "").trim(),
    teamAName: String(body.teamAName ?? "회장팀").trim() || "회장팀",
    teamBName: String(body.teamBName ?? "총무팀").trim() || "총무팀",
    teamAScore: asNumber(body.teamAScore, "회장팀 점수"),
    teamBScore: asNumber(body.teamBScore, "총무팀 점수"),
    teamAPlayerIds: uniqueIds(Array.isArray(body.teamAPlayerIds) ? body.teamAPlayerIds : []),
    teamBPlayerIds: uniqueIds(Array.isArray(body.teamBPlayerIds) ? body.teamBPlayerIds : []),
    goalsByPlayerId: normalizeRecord(body.goalsByPlayerId),
    assistsByPlayerId: normalizeRecord(body.assistsByPlayerId),
    chairmanTeamMvpId: asOptionalNumber(body.chairmanTeamMvpId),
    managerTeamMvpId: asOptionalNumber(body.managerTeamMvpId),
    memo: typeof body.memo === "string" && body.memo.trim() ? body.memo.trim() : null
  };
}

async function prepareMatchData(payload: MatchPayload) {
  if (!payload.matchDate || Number.isNaN(new Date(payload.matchDate).getTime())) {
    throw new MatchValidationError("경기 날짜를 입력해주세요.");
  }
  if (!payload.location) {
    throw new MatchValidationError("장소를 입력해주세요.");
  }
  if (payload.teamAPlayerIds.length === 0 || payload.teamBPlayerIds.length === 0) {
    throw new MatchValidationError("회장팀과 총무팀에 각각 최소 1명 이상의 선수를 선택해주세요.");
  }

  const duplicatedPlayer = payload.teamAPlayerIds.find((id) => payload.teamBPlayerIds.includes(id));
  if (duplicatedPlayer) {
    throw new MatchValidationError("같은 선수를 회장팀과 총무팀에 동시에 등록할 수 없습니다.");
  }

  if (!payload.chairmanTeamMvpId || !payload.teamAPlayerIds.includes(payload.chairmanTeamMvpId)) {
    throw new MatchValidationError("회장팀 MVP를 회장팀 선수 중에서 선택해주세요.");
  }
  if (!payload.managerTeamMvpId || !payload.teamBPlayerIds.includes(payload.managerTeamMvpId)) {
    throw new MatchValidationError("총무팀 MVP를 총무팀 선수 중에서 선택해주세요.");
  }

  const allPlayerIds = [...payload.teamAPlayerIds, ...payload.teamBPlayerIds];
  const existingPlayers = await prisma.player.count({ where: { id: { in: allPlayerIds } } });
  if (existingPlayers !== allPlayerIds.length) {
    throw new MatchValidationError("존재하지 않는 선수가 포함되어 있습니다.");
  }

  const winnerTeam =
    payload.status === matchStatus.inProgress
      ? null
      : payload.teamAScore === payload.teamBScore
        ? null
        : payload.teamAScore > payload.teamBScore
          ? payload.teamAName
          : payload.teamBName;
  const teamAResult: MatchResultValue =
    payload.teamAScore === payload.teamBScore
      ? matchResult.draw
      : payload.teamAScore > payload.teamBScore
        ? matchResult.win
        : matchResult.loss;
  const teamBResult: MatchResultValue =
    payload.teamAScore === payload.teamBScore
      ? matchResult.draw
      : payload.teamBScore > payload.teamAScore
        ? matchResult.win
        : matchResult.loss;

  const matchPlayers = [
    ...payload.teamAPlayerIds.map((playerId) => ({
      playerId,
      teamName: payload.teamAName,
      result: teamAResult,
      goals: payload.goalsByPlayerId[playerId] ?? 0,
      assists: payload.assistsByPlayerId[playerId] ?? 0,
      isMvp: payload.chairmanTeamMvpId === playerId
    })),
    ...payload.teamBPlayerIds.map((playerId) => ({
      playerId,
      teamName: payload.teamBName,
      result: teamBResult,
      goals: payload.goalsByPlayerId[playerId] ?? 0,
      assists: payload.assistsByPlayerId[playerId] ?? 0,
      isMvp: payload.managerTeamMvpId === playerId
    }))
  ];

  return {
    matchDate: new Date(payload.matchDate),
    status: payload.status,
    location: payload.location,
    teamAName: payload.teamAName,
    teamBName: payload.teamBName,
    teamAScore: payload.teamAScore,
    teamBScore: payload.teamBScore,
    winnerTeam,
    chairmanTeamMvpId: payload.chairmanTeamMvpId,
    managerTeamMvpId: payload.managerTeamMvpId,
    memo: payload.memo,
    matchPlayers
  };
}

export async function createMatchRecord(payload: MatchPayload) {
  const data = await prepareMatchData(payload);

  return prisma.match.create({
    data: {
      ...data,
      matchPlayers: {
        create: data.matchPlayers
      }
    },
    include: matchInclude
  });
}

export async function updateMatchRecord(matchId: number, payload: MatchPayload) {
  const existingMatch = await prisma.match.findUnique({ where: { id: matchId }, select: { id: true } });
  if (!existingMatch) {
    throw new MatchNotFoundError("존재하지 않는 경기입니다.");
  }

  const data = await prepareMatchData(payload);

  return prisma.match.update({
    where: { id: matchId },
    data: {
      ...data,
      matchPlayers: {
        deleteMany: {},
        create: data.matchPlayers
      }
    },
    include: matchInclude
  });
}

export async function deleteMatchRecord(matchId: number) {
  const existingMatch = await prisma.match.findUnique({ where: { id: matchId }, select: { id: true } });
  if (!existingMatch) {
    throw new MatchNotFoundError("존재하지 않는 경기입니다.");
  }

  await prisma.match.delete({ where: { id: matchId } });
}

export const matchInclude = Prisma.validator<Prisma.MatchInclude>()({
  chairmanTeamMvp: true,
  managerTeamMvp: true,
  matchPlayers: {
    include: { player: true },
    orderBy: [{ teamName: "asc" }, { player: { name: "asc" } }]
  }
});
