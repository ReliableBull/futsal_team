import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/auth";
import { scopeTeamDb } from "../lib/team-db";

const url = new URL(process.env.DATABASE_URL || "postgresql://localhost/invalid");
assert.equal(process.env.ALLOW_TEAMS_TEST_DB, "1", "Set ALLOW_TEAMS_TEST_DB=1");
assert.match(url.pathname, /^\/arena_teams_test_[a-z0-9_]+$/, "Use a dedicated arena_teams_test_* database");
const origin = process.env.TEAMS_TEST_URL || "http://127.0.0.1:3110";
const legacyOrigin = process.env.TEAMS_LEGACY_TEST_URL || "http://127.0.0.1:3111";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(origin).hostname));
assert.ok(["127.0.0.1", "localhost"].includes(new URL(legacyOrigin).hostname));
const db = new PrismaClient();
const suffix = randomUUID().slice(0, 8);
const password = `Team-test-${suffix}!`;
const teams: number[] = [], admins: number[] = [];
let checks = 0;
async function request(path: string, options: RequestInit = {}, status = 200, host = origin) {
  const response = await fetch(`${host}${path}`, { ...options, redirect: "manual" });
  assert.equal(response.status, status, `${options.method || "GET"} ${host}${path}: ${response.status}`);
  checks++;
  return response;
}
function cookie(admin: { id: number; username: string }) {
  const payload = `${admin.id}.${admin.username}.${Date.now() + 3600000}`;
  const signature = createHmac("sha256", process.env.AUTH_SECRET || "arena-futsal-record-local-secret").update(payload).digest("hex");
  return `arena_admin_session=${payload}.${signature}`;
}
async function main() {
  try {
    const legacy = await db.team.findUniqueOrThrow({ where: { id: 1 } });
    assert.equal(legacy.slug, "arena-fc");
    for (const key of ["a", "b"]) {
      const admin = await db.admin.create({ data: { username: `teams_${suffix}_${key}`, passwordHash: hashPassword(password) } }); admins.push(admin.id);
      const team = await db.team.create({ data: { name: `테스트 팀 ${key}`, slug: `test-${suffix}-${key}`, admins: { create: { adminId: admin.id, role: "PRESIDENT" } } } }); teams.push(team.id);
    }
    const a = scopeTeamDb(db, teams[0]), b = scopeTeamDb(db, teams[1]);
    const [pa, qa, pb] = await Promise.all([a.player.create({ data: { name: "A 선수", position: "미드필더" } }), a.player.create({ data: { name: "A 동료", position: "미드필더" } }), b.player.create({ data: { name: "B 선수", position: "미드필더", teamId: teams[0] } })]);
    assert.equal(pb.teamId, teams[1]);
    assert.equal(await a.player.findUnique({ where: { id: pb.id } }), null);
    assert.equal(await a.player.count(), 2);
    await assert.rejects(() => a.player.update({ where: { id: pb.id }, data: { name: "侵入" } }));
    await assert.rejects(() => a.$transaction(tx => tx.player.delete({ where: { id: pb.id } })));
    assert.equal((await a.$transaction([a.player.count(), a.player.findMany()]))[0], 2);
    const match = await a.match.create({ data: { status: "IN_PROGRESS", matchDate: new Date("2026-10-23T12:00:00Z"), location: "테스트 구장", teamAName: "A팀", teamBName: "B팀", teamAScore: 0, teamBScore: 0, matchPlayers: { create: [{ playerId: pa.id, teamName: "A팀", result: "DRAW" }, { playerId: qa.id, teamName: "B팀", result: "DRAW" }] } } });
    assert.equal(await b.matchPlayer.count(), 0);
    const pathA = `/t/test-${suffix}-a`, pathB = `/t/test-${suffix}-b`;
    const adminA = await db.admin.findUniqueOrThrow({ where: { id: admins[0] } });
    const headers = { Cookie: cookie(adminA), "Content-Type": "application/json" };
    await request("/"); await request("/teams"); await request("/teams/new");
    await request(pathA); await request(`${pathA}/players`); await request(`${pathA}/matches/${match.id}`);
    await request(`${pathB}/players/${pa.id}`, {}, 404);
    await request(`${pathB}/api/matches/${match.id}`, {}, 404);
    await request(`${pathA}/api/matches/${match.id}`);
    await request(`${pathB}/api/matches/${match.id}`, { method: "DELETE", headers }, 403);
    await request(`${pathA}/api/export/analysis-text`, { headers });
    await request(`${pathB}/api/export/analysis-text`, { headers }, 403);
    const redirected = await request(`${pathB}/abcd`, { headers }, 307);
    assert.equal(redirected.headers.get("location"), `${pathB}/abcd/login`);
    await request(`${pathA}/abcd`, { headers });
    const login = await (await request(`${pathA}/api/v1/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: adminA.username, password }) })).json();
    const bearer = { Authorization: `Bearer ${login.token}`, "Content-Type": "application/json" };
    await request(`${pathB}/api/v1/auth/me`, { headers: bearer }, 403);
    await request(`${pathA}/api/v1/players/${pb.id}`, { method: "PUT", headers: bearer, body: JSON.stringify({ name: "侵入", position: "미드필더", isActive: true }) }, 404);
    const matchInput = { matchDate: "2026-10-23", status: "COMPLETED", location: "test", teamAName: "A팀", teamBName: "B팀", teamAScore: 0, teamBScore: 0, teamAPlayerIds: [pa.id], teamBPlayerIds: [pb.id], goalsByPlayerId: {}, assistsByPlayerId: {}, chairmanTeamMvpIds: [], managerTeamMvpIds: [] };
    await request(`${pathA}/api/v1/matches`, { method: "POST", headers: bearer, body: JSON.stringify(matchInput) }, 400);
    const created = await (await request(`${pathA}/api/v1/players`, { method: "POST", headers: bearer, body: JSON.stringify({ name: "새 선수", position: "미드필더", isActive: true, teamId: teams[1] }) }, 201)).json();
    assert.equal(created.player.teamId, teams[0]);
    await request(`${pathA}/api/matches/${match.id}/mom-vote`);
    await request(`${pathB}/api/matches/${match.id}/mom-vote`, {}, 404);
    await request(`${pathA}/api/matches/${match.id}/mom-vote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamAPlayerId: pa.id, teamBPlayerId: qa.id }) }, 201);
    await request(`${pathA}/api/matches/${match.id}/mom-vote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamAPlayerId: pa.id, teamBPlayerId: qa.id }) }, 409);
    // Roles belong to a team, not the account: a member of A can lead B.
    const member = await db.admin.create({ data: {
      username: `teams_${suffix}_member`, passwordHash: hashPassword(password),
      teams: { create: [{ teamId: teams[0] }, { teamId: teams[1], role: "PRESIDENT" }] }
    } });
    admins.push(member.id);
    assert.equal((await db.teamAdmin.findUniqueOrThrow({ where: { teamId_adminId: { teamId: teams[0], adminId: member.id } } })).role, "MEMBER");
    const memberHeaders = { Cookie: cookie(member), "Content-Type": "application/json" };
    const mine = await (await request("/teams?mine=1", { headers: memberHeaders })).text();
    for (const text of ["내가 속한 동호회", "내가 운영하는 동호회", "회원으로 참여하는 동호회", "일반 회원", "회장 (운영자)"]) assert.ok(mine.includes(text), text);
    assert.ok(mine.includes(`href="${pathB}"`));
    assert.ok(mine.includes(`href="${pathA}"`));
    assert.ok(!mine.includes(`href="${pathA}/abcd"`));
    const memberHome = await (await request(pathA, { headers: memberHeaders })).text();
    assert.ok(memberHome.includes("일반 회원"));
    assert.ok(!memberHome.includes(`href="${pathA}/abcd"`));
    const profile = await (await request(`/teams/test-${suffix}-a`, { headers: memberHeaders })).text();
    assert.ok(profile.includes("일반 회원"));
    assert.ok(!profile.includes("소개 · 모집 정보 수정"));
    await request(`${pathA}/abcd`, { headers: memberHeaders }, 307);
    await request(`${pathA}/abcd/team`, { headers: memberHeaders }, 307);
    await request(`${pathA}/api/export/analysis-text`, { headers: memberHeaders }, 403);
    await request(`${pathA}/api/matches/${match.id}`, { method: "PUT", headers: memberHeaders, body: "{}" }, 403);
    await request(`${pathA}/api/matches/${match.id}`, { method: "DELETE", headers: memberHeaders }, 403);
    await request(`${pathB}/abcd`, { headers: memberHeaders });
    await request(`${pathA}/api/v1/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: member.username, password }) }, 403);

    // A member cannot submit an operator's server-action form either.
    const operatorPage = await (await request(`${pathA}/abcd`, { headers })).text();
    const playerForm = Array.from(operatorPage.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)).map(m => m[0]).find(form => form.includes('name="name"') && form.includes('name="position"'));
    assert.ok(playerForm);
    const form = new FormData();
    const actionName = playerForm.match(/name="(\$ACTION_ID_[^"]+)"/)?.[1];
    assert.ok(actionName);
    form.set(actionName, ""); form.set("name", "Forbidden member write"); form.set("position", "미드필더");
    const beforeWrite = await a.player.count();
    await request(`${pathA}/abcd`, { method: "POST", headers: { Cookie: cookie(member), Origin: origin }, body: form }, 303);
    assert.equal(await a.player.count(), beforeWrite);

    // Changing the role revokes existing browser and mobile sessions immediately.
    const memberLogin = await (await request(`${pathB}/api/v1/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: member.username, password }) })).json();
    await db.teamAdmin.update({ where: { teamId_adminId: { teamId: teams[1], adminId: member.id } }, data: { role: "MEMBER" } });
    await request(`${pathB}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${memberLogin.token}` } }, 403);
    await request(`${pathB}/abcd`, { headers: memberHeaders }, 307);
    const ordinaryMine = await (await request("/teams?mine=1", { headers: memberHeaders })).text();
    assert.ok(ordinaryMine.includes("회원으로 참여하는 동호회"));
    assert.ok(!ordinaryMine.includes("내가 운영하는 동호회"));
    await request(`${pathA}/api/access-log`, { method: "POST", headers: memberHeaders, body: JSON.stringify({ path: `${pathA}/players?role-test=member` }) }, 204);
    assert.equal((await a.accessLog.findFirstOrThrow({ where: { path: `${pathA}/players?role-test=member` }, orderBy: { id: "desc" } })).isAdmin, false);
    await db.teamAdmin.delete({ where: { teamId_adminId: { teamId: teams[0], adminId: member.id } } });
    const afterLeave = await (await request("/teams?mine=1", { headers: memberHeaders })).text();
    assert.ok(!afterLeave.includes(`href="${pathA}"`));
    assert.ok((await (await request(pathA)).text()).includes("테스트 팀 a"), "Team records remain public");
    // A spoofed tenant header on an old URL must never select a different team.
    await request(`/api/matches/${match.id}`, { headers: { "x-futsal-team": `test-${suffix}-a` } }, 404);
    const oldPlayers = await (await request("/api/v1/players")).json();
    assert.ok(oldPlayers.players.every((player: { teamId: number }) => player.teamId === 1));
    const landing = await (await request("/", {}, 200, legacyOrigin)).text();
    assert.ok(!landing.includes("EVERY TEAM HAS A STORY"));
    for (const path of ["/teams", "/teams/new", "/teams/arena-fc", "/teams/examples/hangang-united", "/venues", "/venues/seongsu-rooftop", "/bookings", "/login", pathA, `${pathA}/api/v1/players`, `${pathA}/api/matches/${match.id}/mom-vote`, "/t/arena-fc", "/abcd/team"]) await request(path, {}, 404, legacyOrigin);
    for (const path of ["/teams/arena-fc", "/teams/examples/hangang-united", "/venues", "/venues/seongsu-rooftop", "/bookings"]) await request(path);
    await request("/venues/missing-venue", {}, 404);
    await request("/teams/examples/missing-club", {}, 404);
    await request("/players", {}, 200, legacyOrigin);
    await request(`${pathA}/api/access-log`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: `${pathA}/players` }) }, 204);
    assert.ok(await a.accessLog.count()); assert.equal(await b.accessLog.count(), 0);
    await request("/t/no-such-team/api/v1/players", {}, 404);
    assert.equal((await db.player.findUniqueOrThrow({ where: { id: pb.id } })).name, "B 선수");
    console.log(`Multi-team integration passed: ${checks} HTTP checks, DB isolation, team roles, server-action/API authorization, session revocation, exports, votes, spoofed headers, legacy mode.`);
  } finally {
    await db.match.deleteMany({ where: { teamId: { in: teams } } });
    await db.player.deleteMany({ where: { teamId: { in: teams } } });
    await db.team.deleteMany({ where: { id: { in: teams } } });
    await db.admin.deleteMany({ where: { id: { in: admins } } });
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
