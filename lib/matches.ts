import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { matchResult, matchStatus, type MatchResultValue, type MatchStatusValue } from "@/lib/stats";

export class MatchValidationError extends Error {
  status = 400;
}

export class MatchNotFoundError extends Error {
  status = 404;
}

export type GoalAssistSelection = number | null | "UNKNOWN";

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
  goalAssistPlayerIdsByScorerId: Record<number, GoalAssistSelection[]>;
  chairmanTeamMvpIds: number[];
  managerTeamMvpIds: number[];
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

function asGoalAssistSelection(value: unknown): GoalAssistSelection {
  if (value === "UNKNOWN" || value === "unknown") return "UNKNOWN";
  return asOptionalNumber(value);
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

function normalizeGoalAssistRecord(input: unknown) {
  if (!input || typeof input !== "object") return {};

  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>)
      .filter(([key, value]) => Number.isInteger(Number(key)) && Array.isArray(value))
      .map(([key, value]) => [Number(key), (value as unknown[]).map(asGoalAssistSelection)])
  );
}

function countGoalAssists(
  selectedIds: number[],
  goalsByPlayerId: Record<number, number>,
  goalAssistPlayerIdsByScorerId: Record<number, GoalAssistSelection[]>
) {
  const assistsByPlayerId: Record<number, number> = Object.fromEntries(selectedIds.map((playerId) => [playerId, 0]));

  Object.entries(goalAssistPlayerIdsByScorerId).forEach(([scorerIdValue, assistPlayerIds]) => {
    const scorerId = Number(scorerIdValue);
    const goalCount = goalsByPlayerId[scorerId] ?? 0;

    assistPlayerIds.slice(0, goalCount).forEach((assistPlayerId) => {
      if (typeof assistPlayerId === "number" && selectedIds.includes(assistPlayerId)) {
        assistsByPlayerId[assistPlayerId] = (assistsByPlayerId[assistPlayerId] ?? 0) + 1;
      }
    });
  });

  return assistsByPlayerId;
}

export function parseMatchFormData(formData: FormData): MatchPayload {
  const selectedIds = uniqueIds([...formData.getAll("teamAPlayers"), ...formData.getAll("teamBPlayers")]);
  const goalsByPlayerId = Object.fromEntries(
    selectedIds.map((playerId) => [playerId, Math.max(0, asOptionalNumber(asString(formData.get(`goals_${playerId}`))) ?? 0)])
  );
  const goalAssistPlayerIdsByScorerId = Object.fromEntries(
    selectedIds.map((playerId) => [
      playerId,
      Array.from({ length: goalsByPlayerId[playerId] ?? 0 }, (_, index) =>
        asGoalAssistSelection(asString(formData.get(`goalAssist_${playerId}_${index}`)))
      )
    ])
  );
  const countedAssists = countGoalAssists(selectedIds, goalsByPlayerId, goalAssistPlayerIdsByScorerId);
  const hasUnknownGoalDetails = Object.values(goalAssistPlayerIdsByScorerId).some((selections) => selections.includes("UNKNOWN"));
  const assistsByPlayerId = Object.fromEntries(
    selectedIds.map((playerId) => {
      const legacyAssists = Math.max(0, asOptionalNumber(asString(formData.get(`legacyAssists_${playerId}`))) ?? 0);
      return [playerId, hasUnknownGoalDetails ? Math.max(legacyAssists, countedAssists[playerId] ?? 0) : countedAssists[playerId] ?? 0];
    })
  );

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
    goalsByPlayerId,
    assistsByPlayerId,
    goalAssistPlayerIdsByScorerId,
    chairmanTeamMvpIds: uniqueIds(formData.getAll("chairmanTeamMvpIds")),
    managerTeamMvpIds: uniqueIds(formData.getAll("managerTeamMvpIds")),
    memo: asString(formData.get("memo")) || null
  };
}

export function parseMatchJson(input: unknown): MatchPayload {
  if (!input || typeof input !== "object") {
    throw new MatchValidationError("요청 데이터가 올바르지 않습니다.");
  }

  const body = input as Record<string, unknown>;
  const teamAPlayerIds = uniqueIds(Array.isArray(body.teamAPlayerIds) ? body.teamAPlayerIds : []);
  const teamBPlayerIds = uniqueIds(Array.isArray(body.teamBPlayerIds) ? body.teamBPlayerIds : []);
  const selectedIds = [...teamAPlayerIds, ...teamBPlayerIds];
  const goalsByPlayerId = normalizeRecord(body.goalsByPlayerId);
  const goalAssistPlayerIdsByScorerId = normalizeGoalAssistRecord(body.goalAssistPlayerIdsByScorerId);
  const hasGoalAssistDetails = Object.keys(goalAssistPlayerIdsByScorerId).length > 0;

  return {
    matchDate: String(body.matchDate ?? "").trim(),
    status: body.status === matchStatus.completed ? matchStatus.completed : matchStatus.inProgress,
    location: String(body.location ?? "").trim(),
    teamAName: String(body.teamAName ?? "회장팀").trim() || "회장팀",
    teamBName: String(body.teamBName ?? "총무팀").trim() || "총무팀",
    teamAScore: asNumber(body.teamAScore, "회장팀 점수"),
    teamBScore: asNumber(body.teamBScore, "총무팀 점수"),
    teamAPlayerIds,
    teamBPlayerIds,
    goalsByPlayerId,
    assistsByPlayerId: hasGoalAssistDetails
      ? countGoalAssists(selectedIds, goalsByPlayerId, goalAssistPlayerIdsByScorerId)
      : normalizeRecord(body.assistsByPlayerId),
    goalAssistPlayerIdsByScorerId,
    chairmanTeamMvpIds: uniqueIds(
      Array.isArray(body.chairmanTeamMvpIds)
        ? body.chairmanTeamMvpIds
        : body.chairmanTeamMvpId
          ? [body.chairmanTeamMvpId]
          : []
    ),
    managerTeamMvpIds: uniqueIds(
      Array.isArray(body.managerTeamMvpIds)
        ? body.managerTeamMvpIds
        : body.managerTeamMvpId
          ? [body.managerTeamMvpId]
          : []
    ),
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

  if (payload.chairmanTeamMvpIds.some((playerId) => !payload.teamAPlayerIds.includes(playerId))) {
    throw new MatchValidationError(`${payload.teamAName} MOM을 ${payload.teamAName} 선수 중에서 선택해주세요.`);
  }
  if (payload.managerTeamMvpIds.some((playerId) => !payload.teamBPlayerIds.includes(playerId))) {
    throw new MatchValidationError(`${payload.teamBName} MOM을 ${payload.teamBName} 선수 중에서 선택해주세요.`);
  }

  const teamByPlayerId = new Map<number, string>([
    ...payload.teamAPlayerIds.map((playerId) => [playerId, payload.teamAName] as const),
    ...payload.teamBPlayerIds.map((playerId) => [playerId, payload.teamBName] as const)
  ]);

  Object.entries(payload.goalAssistPlayerIdsByScorerId).forEach(([scorerIdValue, assistPlayerIds]) => {
    const scorerId = Number(scorerIdValue);
    const scorerTeam = teamByPlayerId.get(scorerId);
    const goalCount = payload.goalsByPlayerId[scorerId] ?? 0;

    assistPlayerIds.slice(0, goalCount).forEach((assistPlayerId) => {
      if (assistPlayerId === null || assistPlayerId === "UNKNOWN") return;
      if (!teamByPlayerId.has(assistPlayerId)) {
        throw new MatchValidationError("도움 선수는 경기 참가 선수 중에서 선택해주세요.");
      }
      if (assistPlayerId === scorerId) {
        throw new MatchValidationError("득점 선수 본인을 도움 선수로 선택할 수 없습니다.");
      }
      if (teamByPlayerId.get(assistPlayerId) !== scorerTeam) {
        throw new MatchValidationError("도움 선수는 같은 팀 선수 중에서 선택해주세요.");
      }
    });
  });

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
      isMvp: payload.chairmanTeamMvpIds.includes(playerId)
    })),
    ...payload.teamBPlayerIds.map((playerId) => ({
      playerId,
      teamName: payload.teamBName,
      result: teamBResult,
      goals: payload.goalsByPlayerId[playerId] ?? 0,
      assists: payload.assistsByPlayerId[playerId] ?? 0,
      isMvp: payload.managerTeamMvpIds.includes(playerId)
    }))
  ];
  const goals = allPlayerIds.flatMap((scorerId) =>
    Array.from({ length: payload.goalsByPlayerId[scorerId] ?? 0 }, (_, goalIndex) => {
      const assistSelection = payload.goalAssistPlayerIdsByScorerId[scorerId]?.[goalIndex] ?? "UNKNOWN";

      return {
        scorerId,
        assisterId: typeof assistSelection === "number" ? assistSelection : null,
        sequence: goalIndex + 1,
        assistKnown: assistSelection !== "UNKNOWN"
      };
    })
  );

  return {
    matchDate: new Date(payload.matchDate),
    status: payload.status,
    location: payload.location,
    teamAName: payload.teamAName,
    teamBName: payload.teamBName,
    teamAScore: payload.teamAScore,
    teamBScore: payload.teamBScore,
    winnerTeam,
    chairmanTeamMvpId: payload.chairmanTeamMvpIds[0] ?? null,
    managerTeamMvpId: payload.managerTeamMvpIds[0] ?? null,
    memo: payload.memo,
    matchPlayers,
    goals
  };
}

export async function createMatchRecord(payload: MatchPayload) {
  const data = await prepareMatchData(payload);

  return prisma.match.create({
    data: {
      ...data,
      matchPlayers: {
        create: data.matchPlayers
      },
      goals: {
        create: data.goals
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
      },
      goals: {
        deleteMany: {},
        create: data.goals
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
  posters: { orderBy: { createdAt: "desc" } },
  goals: {
    include: { scorer: true, assister: true },
    orderBy: [{ scorerId: "asc" }, { sequence: "asc" }]
  },
  matchPlayers: {
    include: { player: true },
    orderBy: [{ teamName: "asc" }, { player: { name: "asc" } }]
  }
});
