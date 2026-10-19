import { MatchValidationError, parseMatchJson } from "@/lib/matches";
import { playerPositions } from "@/lib/player-position";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function id(value: unknown): number {
  if (!/^[1-9]\d*$/.test(String(value))) throw new ApiError(400, "ID가 올바르지 않습니다.");
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new ApiError(400, "ID가 올바르지 않습니다.");
  return n;
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError(400, "JSON 객체가 필요합니다.");
  return value as Record<string, unknown>;
}
export function string(value: unknown, label: string, max = 100, required = true): string {
  if (typeof value !== "string" || value.trim().length > max || (required && !value.trim())) throw new ApiError(400, `${label} 값을 확인해주세요.`);
  return value.trim();
}
function integer(value: unknown, max = 999) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > max) throw new ApiError(400, `0~${max} 사이 정수를 입력해주세요.`);
  return value;
}
export function date(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ApiError(400, "날짜는 YYYY-MM-DD 형식이어야 합니다.");
  const result = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(result.getTime()) || result.toISOString().slice(0, 10) !== value) throw new ApiError(400, "존재하지 않는 날짜입니다.");
  return result;
}
export function range(params: URLSearchParams) {
  const startValue = params.get("startDate");
  const endValue = params.get("endDate");
  if (!startValue && !endValue) return undefined;
  if (!startValue || !endValue) throw new ApiError(400, "시작일과 종료일을 함께 입력해주세요.");
  const start = date(startValue), end = date(endValue);
  end.setUTCHours(23, 59, 59, 999);
  if (start > end) throw new ApiError(400, "날짜 범위를 확인해주세요.");
  return { start, end };
}
export function page(params: URLSearchParams) {
  const page = params.has("page") ? id(params.get("page")) : 1;
  const limit = params.has("limit") ? id(params.get("limit")) : 30;
  if (limit > 100 || page > 100000) throw new ApiError(400, "조회 범위를 초과했습니다.");
  return { page, limit, skip: (page - 1) * limit };
}
export function playerInput(input: unknown) {
  const b = object(input);
  const position = string(b.position, "포지션");
  if (!(playerPositions as readonly string[]).includes(position)) throw new ApiError(400, "지원하지 않는 포지션입니다.");
  const image = b.profileImageUrl == null || b.profileImageUrl === "" ? null : string(b.profileImageUrl, "이미지 주소", 2048);
  if (image && !/^\/(?!\/)[\w/%.\-]+$/.test(image) && !/^https:\/\//.test(image)) throw new ApiError(400, "이미지는 서버 상대 경로나 HTTPS 주소를 입력해주세요.");
  if (typeof b.isActive !== "boolean") throw new ApiError(400, "선수 활성 상태가 필요합니다.");
  return { name: string(b.name, "이름"), nickname: b.nickname ? string(b.nickname, "닉네임") : null, position,
    number: b.number == null ? null : integer(b.number), isActive: b.isActive, profileImageUrl: image };
}
export function matchInput(input: unknown) {
  const b = object(input);
  date(string(b.matchDate, "경기 날짜"));
  if (!["COMPLETED", "IN_PROGRESS"].includes(String(b.status))) throw new ApiError(400, "경기 상태를 확인해주세요.");
  string(b.location, "장소", 200);
  const a = string(b.teamAName, "A팀 이름"), c = string(b.teamBName, "B팀 이름");
  if (a === c) throw new ApiError(400, "두 팀 이름은 달라야 합니다.");
  integer(b.teamAScore); integer(b.teamBScore);
  if (b.memo != null) string(b.memo, "메모", 5000, false);
  for (const key of ["teamAPlayerIds", "teamBPlayerIds", "chairmanTeamMvpIds", "managerTeamMvpIds"]) {
    if (!Array.isArray(b[key]) || b[key].length > 100) throw new ApiError(400, "선수 목록을 확인해주세요.");
    (b[key] as unknown[]).forEach(value => { if (typeof value !== "number") throw new ApiError(400, "선수 ID는 숫자여야 합니다."); id(value); });
    if (new Set(b[key] as unknown[]).size !== (b[key] as unknown[]).length) throw new ApiError(400, "선수가 중복되었습니다.");
  }
  const selected = new Set([...(b.teamAPlayerIds as number[]), ...(b.teamBPlayerIds as number[])]);
  for (const key of ["goalsByPlayerId", "assistsByPlayerId"]) {
    for (const [keyId, value] of Object.entries(object(b[key] ?? {}))) {
      if (!selected.has(id(keyId))) throw new ApiError(400, "참가하지 않는 선수의 기록입니다.");
      integer(value, 100);
    }
  }
  for (const [keyId, values] of Object.entries(object(b.goalAssistPlayerIdsByScorerId ?? {}))) {
    if (!selected.has(id(keyId)) || !Array.isArray(values) || values.length !== (object(b.goalsByPlayerId ?? {})[keyId] ?? 0)) throw new ApiError(400, "골별 도움 기록을 확인해주세요.");
    values.forEach(value => { if (value !== null && value !== "UNKNOWN") id(value); });
  }
  const payload = parseMatchJson(b);
  // Unknown historical goal links must not erase already recorded assist totals.
  if (Object.values(payload.goalAssistPlayerIdsByScorerId).some(values => values.includes("UNKNOWN"))) {
    const legacy = object(b.assistsByPlayerId ?? {});
    for (const playerId of Array.from(selected)) payload.assistsByPlayerId[playerId] = Math.max(payload.assistsByPlayerId[playerId] ?? 0, Number(legacy[playerId] ?? 0));
  }
  for (const ids of [payload.teamAPlayerIds, payload.teamBPlayerIds]) {
    const score = ids === payload.teamAPlayerIds ? payload.teamAScore : payload.teamBScore;
    if (ids.reduce((sum, playerId) => sum + (payload.goalsByPlayerId[playerId] ?? 0), 0) > score) throw new MatchValidationError("선수 득점 합계가 팀 점수보다 많습니다.");
  }
  return payload;
}
