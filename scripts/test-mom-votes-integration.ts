import { scopeTeamDb } from "../lib/team-db";
import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import { hashVoteIp } from "../lib/mom-vote-ip";
import { getMomPoll, getMomResults, MomVoteError, submitMomBallot } from "../lib/mom-votes";
import { updateMatchRecord, type MatchPayload } from "../lib/matches";

const database = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!database.pathname.startsWith("/arena_mom_test_") || process.env.ALLOW_MOM_TEST_DB !== "1") throw new Error("Use an isolated arena_mom_test_* database and ALLOW_MOM_TEST_DB=1.");
const teamDb = scopeTeamDb(prisma, 1);
const base = process.env.MOM_TEST_URL ?? "http://127.0.0.1:3107";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw new Error("Only a local test server is allowed.");

async function main() {
  const ids: number[] = [], matches: number[] = [];
  const hash = (id: number, suffix: string) => hashVoteIp(id, `192.0.2.${suffix}`);
  async function call(id: number | string, method: string, input?: unknown, headers: Record<string, string> = {}) {
    return fetch(`${base}/api/matches/${id}/mom-vote`, { method, headers: { ...(input === undefined ? {} : { "Content-Type": "application/json" }), ...headers }, body: input === undefined ? undefined : JSON.stringify(input) });
  }
  try {
    for (const name of ["테스트 가", "테스트 나", "테스트 다", "테스트 라", "미출전 선수"]) ids.push((await prisma.player.create({ data: { name, position: "미드필더" } })).id);
    const [a, b, c, d, outside] = ids;
    const payload: MatchPayload = { matchDate: "2026-10-13", status: "IN_PROGRESS", location: "테스트 구장", teamAName: "A팀", teamBName: "B팀", teamAScore: 0, teamBScore: 0, teamAPlayerIds: [a, b], teamBPlayerIds: [c, d], goalsByPlayerId: {}, assistsByPlayerId: {}, goalAssistPlayerIdsByScorerId: {}, chairmanTeamMvpIds: [], managerTeamMvpIds: [], memo: "isolated-mom-test" };
    const fixture = async (status = "IN_PROGRESS") => {
      const match = await prisma.match.create({ data: { status, matchDate: new Date(payload.matchDate), location: payload.location, teamAName: "A팀", teamBName: "B팀", teamAScore: 0, teamBScore: 0, matchPlayers: { create: ids.slice(0, 4).map((playerId, i) => ({ playerId, teamName: i < 2 ? "A팀" : "B팀", result: "DRAW" })) } } });
      matches.push(match.id); return match.id;
    };
    const id = await fixture();
    const choices = { teamAPlayerId: a, teamBPlayerId: c };
    const initial = await call(id, "GET");
    assert.equal(initial.status, 200); assert.equal((await initial.json()).hasVoted, false);
    assert.match(initial.headers.get("cache-control")!, /no-store/);
    for (const bad of [{ teamAPlayerId: outside, teamBPlayerId: c }, { teamAPlayerId: c, teamBPlayerId: a }, { teamAPlayerId: a }, { teamAPlayerId: a, teamBPlayerId: a }]) assert.equal((await call(id, "POST", bad)).status, 400);
    assert.equal((await call(id, "POST", choices, { Origin: "https://untrusted.example" })).status, 403);
    assert.equal((await call(id, "POST", choices, { "Sec-Fetch-Site": "cross-site" })).status, 403);
    assert.equal((await call(id, "POST", choices, { "Content-Type": "text/plain" })).status, 415);
    assert.equal((await call(id, "DELETE")).status, 405);
    assert.equal((await call("NaN", "GET")).status, 400);
    assert.equal((await call(2147483647, "GET")).status, 404);
    const responses = await Promise.all(Array.from({ length: 8 }, (_, i) => call(id, "POST", choices, { "X-Forwarded-For": `203.0.113.${i + 1}`, "X-Real-IP": `203.0.113.${i + 20}` })));
    assert.equal(responses.filter((r) => r.status === 201).length, 1, "concurrent/spoofed headers must result in one ballot");
    assert.equal(responses.filter((r) => r.status === 409).length, 7);
    assert.equal((await (await call(id, "GET")).json()).hasVoted, true);
    assert.equal(await prisma.momBallot.count({ where: { matchId: id } }), 1);
    assert.equal(await prisma.matchPlayer.count({ where: { matchId: id, isMvp: true } }), 0, "votes must not change official MOMs");
    const otherMatch = await fixture();
    assert.equal((await call(otherMatch, "POST", choices)).status, 201, "same IP may vote in another match");
    await submitMomBallot(id, hash(id, "22"), { teamAPlayerId: b, teamBPlayerId: d }, teamDb);
    let results = await getMomResults(id, teamDb);
    assert.equal(results.totalBallots, 2);
    assert.deepEqual(results.teams.map((team) => team.players.map((p) => p.votes)), [[1, 1], [1, 1]], "ties preserved for administrator decision");
    await updateMatchRecord(id, { ...payload, chairmanTeamMvpIds: [b], managerTeamMvpIds: [d] }, teamDb);
    assert.equal(await prisma.momBallot.count({ where: { matchId: id } }), 2, "editing recreates MatchPlayers but preserves ballots");
    assert.equal(await prisma.matchPlayer.count({ where: { matchId: id, isMvp: true } }), 2);
    await updateMatchRecord(id, { ...payload, teamAPlayerIds: [b], chairmanTeamMvpIds: [b], managerTeamMvpIds: [d] }, teamDb);
    results = await getMomResults(id, teamDb); assert.equal(results.teams[0].excludedVotes, 1);
    await assert.rejects(() => submitMomBallot(id, hash(id, "23"), choices, teamDb), (e: unknown) => e instanceof MomVoteError && e.status === 400);
    const closed = await fixture("COMPLETED");
    assert.equal((await call(closed, "POST", choices)).status, 409);
    // A submit already in flight must observe a concurrent closing transaction.
    const closing = await fixture();
    let locked!: () => void, release!: () => void;
    const lockReady = new Promise<void>((resolve) => { locked = resolve; });
    const canCommit = new Promise<void>((resolve) => { release = resolve; });
    const close = prisma.$transaction(async (tx) => {
      await tx.match.update({ where: { id: closing }, data: { status: "COMPLETED" } });
      locked(); await canCommit;
    });
    await lockReady;
    const staleSubmit = assert.rejects(() => submitMomBallot(closing, hash(closing, "24"), choices, teamDb), (e: unknown) => e instanceof MomVoteError && e.status === 409);
    release(); await Promise.all([close, staleSubmit]);
    assert.equal(await prisma.momBallot.count({ where: { matchId: closing } }), 0);
    await prisma.$disconnect();
    assert.equal((await getMomPoll(id, hash(id, "22"), teamDb)).hasVoted, true, "ballot survives a database client reconnect");
    await prisma.match.delete({ where: { id } });
    assert.equal(await prisma.momBallot.count({ where: { matchId: id } }), 0, "match deletion cascades to ballots");
    console.log("MOM integration passed: HTTP validation, header spoofing, 8 concurrent requests, per-match limits, eligible rosters, ties, admin edits, closing race, persistence and cascade.");
  } finally {
    await prisma.match.deleteMany({ where: { id: { in: matches } } });
    await prisma.player.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
