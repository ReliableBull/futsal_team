export class PollError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function parsePollVoterName(value: unknown) {
  if (typeof value !== "string" || value.length > 100) throw new PollError(400, "이름을 2~40자로 입력해주세요.");
  const name = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (new RegExp("[\\p{C}]", "u").test(name)) throw new PollError(400, "이름에 사용할 수 없는 문자가 있습니다.");
  const nameKey = name.replace(/\s/g, "").toLocaleLowerCase("ko-KR");
  if (nameKey.length < 2 || name.length > 40 || nameKey.length > 40) throw new PollError(400, "이름을 2~40자로 입력해주세요.");
  return { name, nameKey };
}

// Legacy polls may list the whole active roster as candidates.
export const legacyPollRules = { maxOptions: 50, players: true };
export type PollOptionInput = string | { playerId: number };

function isPlayerOption(value: unknown): value is { playerId: number } {
  const playerId = value && typeof value === "object" && !Array.isArray(value) ? (value as { playerId?: unknown }).playerId : null;
  return typeof playerId === "number" && Number.isSafeInteger(playerId) && playerId > 0;
}

export function parsePollInput(input: unknown, now = new Date(), rules: { maxOptions?: number; players?: boolean } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new PollError(400, "투표 내용을 확인해주세요.");
  const body = input as Record<string, unknown>;
  const maxOptions = rules.maxOptions ?? 10;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (title.length < 2 || title.length > 120) throw new PollError(400, "투표 제목은 2~120자로 입력해주세요.");
  if (description.length > 2000) throw new PollError(400, "설명은 2,000자 이내로 입력해주세요.");
  if (!Array.isArray(body.options) || body.options.length < 2 || body.options.length > maxOptions) throw new PollError(400, `선택지는 2~${maxOptions}개 입력해주세요.`);
  const options: PollOptionInput[] = body.options.map(option => typeof option === "string" ? option.trim() : rules.players && isPlayerOption(option) ? { playerId: option.playerId } : "");
  if (options.some(option => typeof option === "string" && (!option || option.length > 120))) throw new PollError(400, "각 선택지는 1~120자로 입력해주세요.");
  const labels = options.filter((option): option is string => typeof option === "string");
  if (new Set(labels.map(label => label.toLocaleLowerCase("ko-KR"))).size !== labels.length) throw new PollError(400, "같은 선택지를 중복해서 입력할 수 없습니다.");
  const playerIds = options.flatMap(option => typeof option === "string" ? [] : [option.playerId]);
  if (new Set(playerIds).size !== playerIds.length) throw new PollError(400, "같은 회원을 중복해서 추가할 수 없습니다.");
  let closesAt: Date | null = null;
  if (body.closesAt != null && body.closesAt !== "") {
    if (typeof body.closesAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(body.closesAt)) throw new PollError(400, "마감 일시를 확인해주세요.");
    closesAt = new Date(body.closesAt);
    const calendarDate = new Date(`${body.closesAt.slice(0, 10)}T00:00:00Z`);
    if (!Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== body.closesAt.slice(0, 10)) throw new PollError(400, "올바른 마감 날짜를 입력해주세요.");
    if (!Number.isFinite(closesAt.getTime()) || closesAt <= now) throw new PollError(400, "마감은 현재 시간 이후로 설정해주세요.");
  }
  return { title, description, options, closesAt };
}

export function pollIsClosed(poll: { closedAt: Date | string | null; closesAt: Date | string | null }, now = new Date()) {
  return Boolean(poll.closedAt || (poll.closesAt && new Date(poll.closesAt).getTime() <= now.getTime()));
}

export function formatPollDate(value: Date | string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
