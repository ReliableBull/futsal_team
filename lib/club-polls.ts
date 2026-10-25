import { Prisma, type PrismaClient } from "@prisma/client";
import { PollError, legacyPollRules, parsePollInput, parsePollVoterName, pollIsClosed } from "./poll-validation";
import { getPollCandidates } from "./poll-candidates";

// Audience is selected by the server's app mode, never by request input.
export type PollAccess = { audience: "MEMBERS" | "LEGACY"; receiptHash?: string | null };
const membersOnly: PollAccess = { audience: "MEMBERS" };

async function member(db: Prisma.TransactionClient, teamId: number, accountId: number | null, ownerOnly = false) {
  if (!accountId) throw new PollError(401, "로그인 후 투표에 참여해주세요.");
  const membership = await db.teamAdmin.findUnique({ where: { teamId_adminId: { teamId, adminId: accountId } } });
  if (!membership || !["PRESIDENT", "MEMBER"].includes(membership.role)) throw new PollError(403, "이 동호회 회원만 투표를 확인하고 참여할 수 있습니다.");
  if (ownerOnly && membership.role !== "PRESIDENT") throw new PollError(403, "회장(운영자)만 투표를 만들거나 마감할 수 있습니다.");
  return membership;
}

export async function createClubPoll(db: PrismaClient, teamId: number, accountId: number | null, input: unknown, access = membersOnly) {
  return db.$transaction(async tx => {
    await member(tx, teamId, accountId, true);
    const { options, ...fields } = parsePollInput(input, new Date(), access.audience === "LEGACY" ? legacyPollRules : undefined);
    const ids = options.flatMap(option => typeof option === "string" ? [] : [option.playerId]);
    const candidates = new Map((ids.length ? await getPollCandidates(tx, teamId, ids) : []).map(candidate => [candidate.id, candidate]));
    if (candidates.size !== ids.length) throw new PollError(400, "현재 활성 회원만 후보로 추가할 수 있습니다.");
    const rows = options.map((option, position) => {
      const candidate = typeof option === "string" ? null : candidates.get(option.playerId)!;
      return candidate ? { label: candidate.name.slice(0, 120), playerId: candidate.id, detail: candidate.detail, position } : { label: option as string, playerId: null, detail: "", position };
    });
    if (new Set(rows.map(row => row.label.toLocaleLowerCase("ko-KR"))).size !== rows.length) throw new PollError(400, "이름이 같은 선택지가 있습니다. 직접 입력한 선택지나 후보를 확인해주세요.");
    return tx.clubPoll.create({ data: { ...fields, teamId, audience: access.audience, creatorId: accountId, options: { create: rows } }, select: { id: true } });
  });
}

export async function listClubPolls(db: PrismaClient, teamId: number, accountId: number | null, access = membersOnly) {
  await member(db, teamId, accountId, access.audience === "LEGACY");
  const polls = await db.clubPoll.findMany({ where: { teamId, audience: access.audience }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100,
    select: { id: true, title: true, closesAt: true, closedAt: true, createdAt: true, _count: { select: { ballots: true, guestBallots: true } },
      ballots: { where: { voterId: accountId ?? -1 }, select: { optionId: true } },
      guestBallots: { where: { receiptHash: access.receiptHash ?? "" }, select: { optionId: true } } }
  });
  return polls.map(({ guestBallots, ...poll }) => ({ ...poll,
    _count: { ballots: access.audience === "LEGACY" ? poll._count.guestBallots : poll._count.ballots },
    ballots: access.audience === "LEGACY" ? guestBallots : poll.ballots }));
}

export type ClubPollView = {
  id: string; title: string; description: string; createdAt: string;
  closesAt: string | null; closedAt: string | null; closed: boolean;
  canManage: boolean; canViewResults: boolean; namedVoting: boolean;
  selectedOptionId: string | null;
  options: { id: string; label: string; detail: string; playerId: number | null; profileImageUrl: string | null; votes?: number }[];
  totalVotes?: number;
  turnout?: { votedCount: number; activeMemberCount: number; percentage: number | null };
  participants?: { id: string; name: string; optionId: string; optionLabel: string; createdAt: string }[];
  invalidBallots?: { id: string; name: string; optionId: string; optionLabel: string; createdAt: string; invalidatedAt: string }[];
};

function turnout(votedCount: number, activeMemberCount: number) {
  return { votedCount, activeMemberCount, percentage: activeMemberCount > 0 ? Math.round(votedCount * 1000 / activeMemberCount) / 10 : null };
}

export async function getClubPoll(db: PrismaClient, teamId: number, accountId: number | null, id: string, access = membersOnly): Promise<ClubPollView> {
  const membership = access.audience === "MEMBERS" ? await member(db, teamId, accountId) : accountId ? await db.teamAdmin.findUnique({ where: { teamId_adminId: { teamId, adminId: accountId } } }) : null;
  const poll = await db.clubPoll.findFirst({ where: { id, teamId, audience: access.audience }, include: {
    options: { orderBy: { position: "asc" }, select: { id: true, label: true, detail: true, playerId: true, player: { select: { profileImageUrl: true } } } },
    ballots: { where: { voterId: accountId ?? -1 }, select: { optionId: true } },
    guestBallots: { where: { receiptHash: access.receiptHash ?? "" }, select: { optionId: true } }
  } });
  if (!poll) throw new PollError(404, "투표를 찾을 수 없습니다.");
  const legacy = access.audience === "LEGACY";
  const canManage = membership?.role === "PRESIDENT";
  // Candidate photos follow the current profile; the record stays as captured.
  const options = poll.options.map(({ player, ...option }) => ({ ...option, profileImageUrl: player?.profileImageUrl ?? null }));
  const view: ClubPollView = {
    id: poll.id, title: poll.title, description: poll.description, createdAt: poll.createdAt.toISOString(),
    closesAt: poll.closesAt?.toISOString() ?? null, closedAt: poll.closedAt?.toISOString() ?? null,
    closed: pollIsClosed(poll), canManage, canViewResults: !legacy || canManage, namedVoting: legacy,
    selectedOptionId: (legacy ? poll.guestBallots : poll.ballots)[0]?.optionId ?? null,
    options
  };
  // Only participation totals are public. Option tallies and named ballots
  // stay private, including after submission and after closing.
  const activeMemberCount = legacy ? await db.player.count({ where: { teamId, isActive: true } }) : 0;
  if (!view.canViewResults) {
    view.turnout = turnout(await db.clubPollGuestBallot.count({ where: { pollId: id } }), activeMemberCount);
    return view;
  }
  const counts = new Map<string, number>();
  if (legacy) {
    const label = (optionId: string) => poll.options.find(option => option.id === optionId)!.label;
    const ballots = await db.clubPollGuestBallot.findMany({ where: { pollId: id }, orderBy: [{ createdAt: "desc" }, { name: "asc" }], select: { id: true, name: true, optionId: true, createdAt: true } });
    view.participants = ballots.map(ballot => ({ ...ballot, createdAt: ballot.createdAt.toISOString(), optionLabel: label(ballot.optionId) }));
    // Derive the tally from the same snapshot as the participant list.
    for (const ballot of ballots) counts.set(ballot.optionId, (counts.get(ballot.optionId) ?? 0) + 1);
    const invalid = await db.clubPollInvalidBallot.findMany({ where: { pollId: id }, orderBy: [{ invalidatedAt: "desc" }, { id: "asc" }], select: { id: true, name: true, optionId: true, createdAt: true, invalidatedAt: true } });
    view.invalidBallots = invalid.map(ballot => ({ ...ballot, createdAt: ballot.createdAt.toISOString(), invalidatedAt: ballot.invalidatedAt.toISOString(), optionLabel: label(ballot.optionId) }));
  } else {
    const groups = await db.clubPollBallot.groupBy({ by: ["optionId"], where: { pollId: id }, _count: { _all: true } });
    for (const group of groups) counts.set(group.optionId, group._count._all);
  }
  view.options = options.map(option => ({ ...option, votes: counts.get(option.id) ?? 0 }));
  view.totalVotes = view.options.reduce((total, option) => total + (option.votes ?? 0), 0);
  if (legacy) view.turnout = turnout(view.totalVotes, activeMemberCount);
  return view;
}

async function lockPoll(tx: Prisma.TransactionClient, teamId: number, id: string, audience: PollAccess["audience"]) {
  // Closing and voting lock the same row, so a late vote cannot pass a close.
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "ClubPoll" WHERE "id" = ${id} AND "teamId" = ${teamId} AND "audience" = ${audience} FOR UPDATE`;
  if (!rows.length) throw new PollError(404, "투표를 찾을 수 없습니다.");
  return tx.clubPoll.findUniqueOrThrow({ where: { id } });
}

export async function castClubVote(db: PrismaClient, teamId: number, accountId: number | null, id: string, optionId: unknown, access = membersOnly, voterName?: unknown) {
  try {
    await db.$transaction(async tx => {
      if (access.audience === "MEMBERS") await member(tx, teamId, accountId);
      const poll = await lockPoll(tx, teamId, id, access.audience);
      if (pollIsClosed(poll)) throw new PollError(409, "마감된 투표입니다.");
      if (typeof optionId !== "string" || optionId.length > 64 || !await tx.clubPollOption.findUnique({ where: { pollId_id: { pollId: id, id: optionId } } })) throw new PollError(400, "이 투표의 선택지를 골라주세요.");
      if (access.audience === "LEGACY") {
        const identity = parsePollVoterName(voterName);
        if (!access.receiptHash || !/^[a-f0-9]{64}$/.test(access.receiptHash)) throw new PollError(400, "투표 페이지를 새로고침해주세요.");
        await tx.clubPollGuestBallot.create({ data: { pollId: id, optionId, ...identity, receiptHash: access.receiptHash } });
      } else {
        await tx.clubPollBallot.create({ data: { pollId: id, voterId: accountId!, optionId } });
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new PollError(409, access.audience === "LEGACY"
      ? "이미 참여한 이름 또는 브라우저입니다. 동명이인은 운영자에게 구분할 이름을 확인해주세요."
      : "이미 참여한 투표입니다. 한 사람당 한 번만 투표할 수 있습니다.");
    throw error;
  }
}

export async function closeClubPoll(db: PrismaClient, teamId: number, accountId: number | null, id: string, access = membersOnly) {
  await db.$transaction(async tx => {
    await member(tx, teamId, accountId, true);
    const poll = await lockPoll(tx, teamId, id, access.audience);
    if (!poll.closedAt) await tx.clubPoll.update({ where: { id }, data: { closedAt: new Date() } });
  });
}

export async function invalidateGuestBallot(db: PrismaClient, teamId: number, accountId: number | null, id: string, ballotId: unknown, access = membersOnly) {
  // Member ballots belong to accounts; only named legacy ballots can be voided.
  if (access.audience !== "LEGACY") throw new PollError(404, "투표를 찾을 수 없습니다.");
  await db.$transaction(async tx => {
    await member(tx, teamId, accountId, true);
    await lockPoll(tx, teamId, id, access.audience);
    if (typeof ballotId !== "string" || ballotId.length > 64) throw new PollError(400, "무효 처리할 표를 선택해주세요.");
    const ballot = await tx.clubPollGuestBallot.findFirst({ where: { id: ballotId, pollId: id }, select: { id: true, name: true, optionId: true, createdAt: true } });
    // A stale ID never matches a later ballot that reuses the same name.
    if (!ballot) throw new PollError(404, "이미 무효 처리되었거나 찾을 수 없는 표입니다.");
    // Moving the ballot frees its name and browser receipt for a corrected vote.
    await tx.clubPollInvalidBallot.create({ data: { ...ballot, pollId: id } });
    await tx.clubPollGuestBallot.delete({ where: { id: ballot.id } });
  });
}
