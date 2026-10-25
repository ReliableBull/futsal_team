import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/auth";
import { listClubPolls } from "../lib/club-polls";
import { defaultStartDate } from "../lib/date-range";

assert.equal(process.env.ALLOW_TEAMS_TEST_DB, "1");
assert.match(new URL(process.env.DATABASE_URL || "http://invalid").pathname, /^\/arena_teams_test_[a-z0-9_]+$/);
const origin = process.env.TEAMS_LEGACY_TEST_URL || "http://127.0.0.1:3111";
const platform = process.env.TEAMS_TEST_URL || "http://127.0.0.1:3110";
for (const host of [origin, platform]) assert.ok(["localhost", "127.0.0.1"].includes(new URL(host).hostname));
const db = new PrismaClient();
const suffix = randomUUID().slice(0, 8), password = `legacy-poll-${suffix}!`;
const accounts: number[] = [], polls: string[] = [], players: number[] = [], fixtureTeams: number[] = [], matches: number[] = [];
let checks = 0;
function cookie(account: { id: number; username: string }) {
  const value = `${account.id}.${account.username}.${Date.now() + 3600000}`;
  return `arena_admin_session=${value}.${createHmac("sha256", process.env.AUTH_SECRET || "arena-futsal-record-local-secret").update(value).digest("hex")}`;
}
async function request(path: string, options: RequestInit = {}, status = 200, host = origin) {
  const response = await fetch(host + path, { ...options, redirect: "manual" });
  assert.equal(response.status, status, `${options.method || "GET"} ${host}${path}: ${response.status}`);
  checks++; return response;
}
function post(body: unknown, auth = "", host = origin) {
  return { method: "POST", headers: { "Content-Type": "application/json", Origin: host, Cookie: auth }, body: JSON.stringify(body) };
}
function assertPrivatePoll(poll: { canManage: boolean; canViewResults: boolean; options: object[]; turnout?: object }) {
  assert.equal(poll.canManage, false); assert.equal(poll.canViewResults, false);
  for (const key of ["totalVotes", "participants", "invalidBallots"]) assert.ok(!(key in poll), key);
  for (const option of poll.options) assert.ok(!("votes" in option));
  for (const key of ["receiptHash", "nameKey", "_count"]) assert.ok(!JSON.stringify(poll).includes(key));
  assert.ok(poll.turnout);
  assert.deepEqual(Object.keys(poll.turnout).sort(), ["activeMemberCount", "percentage", "votedCount"]);
}
const decode = (value: string) => value.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&");
async function main() {
  try {
    const team = await db.team.findUniqueOrThrow({ where: { slug: "arena-fc" } });
    assert.equal(await db.player.count({ where: { teamId: team.id } }), 0, "Use an empty legacy fixture roster");
    const otherTeam = await db.team.create({ data: { slug: `turnout-${suffix}`, name: "다른 팀 활성 회원" } }); fixtureTeams.push(otherTeam.id);
    for (let i = 0; i < 5; i++) {
      const player = await db.player.create({ data: { teamId: i === 4 ? otherTeam.id : team.id, name: `명단 테스트 ${suffix} ${i}`, position: "미드필더", isActive: i !== 3 } });
      players.push(player.id);
    }
    const activePlayers = players.slice(0, 3);
    const owner = await db.admin.create({ data: { username: `legacy_owner_${suffix}`, passwordHash: hashPassword(password), teams: { create: { teamId: team.id, role: "PRESIDENT" } } } }); accounts.push(owner.id);
    const member = await db.admin.create({ data: { username: `legacy_member_${suffix}`, passwordHash: hashPassword(password), teams: { create: { teamId: team.id, role: "MEMBER" } } } }); accounts.push(member.id);
    const ownerCookie = cookie(owner), memberCookie = cookie(member);
    const input = { title: `레거시 모임 일정 ${suffix}`, description: "이름으로 참여하는 예시", options: ["토요일", "일요일"], audience: "MEMBERS" };
    await request("/api/polls", post(input), 401);
    await request("/api/polls", post(input, memberCookie), 403);
    const created = await (await request("/api/polls", post(input, ownerCookie), 201)).json(); polls.push(created.id);
    assert.equal((await db.clubPoll.findUniqueOrThrow({ where: { id: created.id } })).audience, "LEGACY");
    const endpoint = `/api/polls/${created.id}`, path = `/polls/${created.id}`;
    const publicEndpoint = `/api/vote/${created.id}`, sharePath = `/vote/${created.id}`;
    const initial = await (await request(endpoint)).json();
    assert.equal(initial.namedVoting, true); assertPrivatePoll(initial);
    assert.deepEqual(initial.turnout, { votedCount: 0, activeMemberCount: 3, percentage: 0 });
    const optionId = initial.options[0].id;
    assert.equal((await (await request(endpoint, { headers: { Cookie: ownerCookie } })).json()).canManage, true);
    const oldLink = await request(path, {}, 307);
    assert.equal(oldLink.headers.get("location"), sharePath);
    const html = await (await request(sharePath)).text();
    for (const text of [input.title, "참여자 이름", "입력한 이름과 선택은 관리자만 확인"]) assert.ok(html.includes(text), text);
    for (const text of ["투표 참여 현황", "투표 완료", "활성 회원", "투표율"]) assert.ok(html.includes(text), text);
    for (const text of ["선수목록", "경기결과", "조합 분석", "명예의 전당", "현재 결과", "최종 결과", "이름별 투표 내역", "totalVotes", "participants", "투표 마감하기", 'href="/polls"']) assert.ok(!html.includes(text), text);
    const ownerHtml = await (await request(path, { headers: { Cookie: ownerCookie } })).text();
    for (const text of ["투표 마감하기", "이름별 투표 내역", "3초마다 자동 갱신", "투표 링크 복사", `href="${sharePath}"`, 'href="/polls"']) assert.ok(ownerHtml.includes(text), text);
    const preview = await (await request(sharePath, { headers: { Cookie: ownerCookie } })).text();
    for (const text of ["이름별 투표 내역", "totalVotes", "participants", "선수목록"]) assert.ok(!preview.includes(text), text);
    for (const auth of ["", memberCookie, ownerCookie]) assertPrivatePoll(await (await request(publicEndpoint, { headers: { Cookie: auth } })).json());
    await request(sharePath, {}, 404, platform);
    await request(publicEndpoint, {}, 404, platform);
    const adminHtml = await (await request("/abcd", { headers: { Cookie: ownerCookie } })).text();
    for (const link of ['href="/polls"', 'href="/polls/new"']) assert.ok(adminHtml.includes(link));
    for (const auth of ["", memberCookie, ownerCookie]) {
      const home = await (await request("/", { headers: { Cookie: auth } })).text();
      assert.ok(!home.includes('href="/polls"'), "Legacy main navigation must not contain a polls tab");
    }
    const platformHome = await (await request("/t/arena-fc", { headers: { Cookie: ownerCookie } }, 200, platform)).text();
    assert.ok(platformHome.includes('href="/t/arena-fc/polls"'), "Platform polls tab must remain available");
    for (const auth of ["", memberCookie]) {
      for (const managementPath of ["/polls", "/polls/new"]) {
        const denied = await request(managementPath, { headers: { Cookie: auth } }, 307);
        assert.equal(denied.headers.get("location"), `/abcd/login?next=${encodeURIComponent(managementPath)}`);
        assert.ok(!(await denied.text()).includes(input.title));
      }
    }
    await assert.rejects(() => listClubPolls(db, team.id, null, { audience: "LEGACY" }), { status: 401 });
    await assert.rejects(() => listClubPolls(db, team.id, member.id, { audience: "LEGACY" }), { status: 403 });
    assert.ok((await (await request("/polls", { headers: { Cookie: ownerCookie } })).text()).includes(input.title));
    const redirect = await request("/polls/new", {}, 307);
    assert.equal(redirect.headers.get("location"), "/abcd/login?next=%2Fpolls%2Fnew");
    await request("/polls/new", { headers: { Cookie: ownerCookie } });

    // The administrator login returns to the creation form, using a whitelisted path.
    const loginPath = "/abcd/login?next=%2Fpolls%2Fnew";
    const loginHtml = await (await request(loginPath)).text();
    const loginForm = Array.from(loginHtml.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)).map(m => m[0]).find(form => form.includes('name="username"'));
    assert.ok(loginForm);
    const formData = new FormData();
    for (const [field] of Array.from(loginForm.matchAll(/<input\b[^>]*type="hidden"[^>]*>/g))) {
      const name = field.match(/\bname="([^"]*)"/)?.[1];
      if (name) formData.set(decode(name), decode(field.match(/\bvalue="([^"]*)"/)?.[1] || ""));
    }
    formData.set("username", owner.username); formData.set("password", password);
    assert.equal((await request(loginPath, { method: "POST", headers: { Origin: origin }, body: formData }, 303)).headers.get("location"), "/polls/new");

    // Both modes share a database, but private member polls must never become public.
    const memberPoll = await (await request("/t/arena-fc/api/polls", post({ ...input, title: `비공개 회원 투표 ${suffix}`, audience: "LEGACY" }, ownerCookie, platform), 201, platform)).json(); polls.push(memberPoll.id);
    assert.equal((await db.clubPoll.findUniqueOrThrow({ where: { id: memberPoll.id } })).audience, "MEMBERS");
    const memberOption = await db.clubPollOption.findFirstOrThrow({ where: { pollId: memberPoll.id } });
    await request(`/api/polls/${memberPoll.id}`, {}, 404);
    await request(`/polls/${memberPoll.id}`, {}, 404);
    await request(`/vote/${memberPoll.id}`, {}, 404);
    await request(`/api/vote/${memberPoll.id}`, {}, 404);
    await request(`/api/vote/${memberPoll.id}`, post({ name: "홍길동", optionId: memberOption.id }), 404);
    await request(`/api/polls/${memberPoll.id}/votes`, post({ name: "홍길동", optionId: memberOption.id }), 404);
    await request(`/api/polls/${memberPoll.id}/close`, post({}, ownerCookie), 404);
    await request(`/api/polls/${memberPoll.id}/invalidate`, post({ ballotId: "missing" }, ownerCookie), 404);
    assert.ok(!(await (await request("/polls", { headers: { Cookie: ownerCookie } })).text()).includes(`비공개 회원 투표 ${suffix}`));
    for (const action of ["", "/votes", "/close", "/invalidate"]) await request(`/t/arena-fc/api/polls/${created.id}${action}`, action ? post({ optionId }, ownerCookie, platform) : { headers: { Cookie: ownerCookie } }, 404, platform);
    assert.ok(!(await (await request("/t/arena-fc/polls", { headers: { Cookie: ownerCookie } }, 200, platform)).text()).includes(input.title));
    await request(`/t/arena-fc${endpoint}`, {}, 404);
    await request(`${endpoint}/votes`, post({ name: "홍길동", optionId: memberOption.id }), 400);
    for (const name of [null, "", " ", "김", "가".repeat(41), "홍\u200b길동"]) await request(`${endpoint}/votes`, post({ name, optionId }), 400);
    await request(`${endpoint}/votes`, { ...post({ name: "홍길동", optionId }), headers: { "Content-Type": "application/json", Origin: "https://evil.example" } }, 403);
    const concurrent = await Promise.all([1, 2].map(() => fetch(origin + publicEndpoint, post({ name: " 홍 길동 ", optionId }))));
    assert.deepEqual(concurrent.map(response => response.status).sort(), [201, 409]); checks += 2;
    const voted = concurrent.find(response => response.status === 201)!;
    const receiptCookie = voted.headers.get("set-cookie")!.split(";")[0];
    assert.ok(receiptCookie.startsWith("arena_poll_receipt="));
    assert.ok(voted.headers.get("set-cookie")?.includes("HttpOnly"));
    const result = await voted.json(); assert.equal(result.selectedOptionId, optionId); assertPrivatePoll(result);
    assert.deepEqual(result.turnout, { votedCount: 1, activeMemberCount: 3, percentage: 33.3 });
    const firstTally = await (await request(endpoint, { headers: { Cookie: ownerCookie } })).json();
    assert.equal(firstTally.totalVotes, 1);
    assert.deepEqual(firstTally.turnout, result.turnout);
    assert.equal(firstTally.participants[0].name, "홍 길동");
    assert.equal(firstTally.participants[0].optionLabel, input.options[0]);
    await request(`${endpoint}/votes`, post({ name: "홍길동", optionId: initial.options[1].id }), 409);
    await request(`${endpoint}/votes`, post({ name: "다른 이름", optionId }, receiptCookie), 409);
    const remembered = await (await request(publicEndpoint, { headers: { Cookie: receiptCookie } })).json();
    assertPrivatePoll(remembered);
    const doneHtml = await (await request(sharePath, { headers: { Cookie: receiptCookie } })).text();
    assert.ok(doneHtml.includes("투표가 완료되었습니다"));
    for (const text of ["투표 참여 현황", "활성 회원", "33.3%"]) assert.ok(doneHtml.includes(text), text);
    assert.ok(!doneHtml.includes('name="voterName"'));
    assert.ok(!doneHtml.includes("totalVotes"));
    await request(publicEndpoint, post({ name: "홍길동", optionId: initial.options[1].id }, receiptCookie), 409);
    assert.equal(remembered.selectedOptionId, optionId);
    assert.equal((await (await request(endpoint)).json()).selectedOptionId, null);
    const secondVote = await (await request(publicEndpoint, post({ name: "김회원", optionId: initial.options[1].id }), 201)).json();
    assertPrivatePoll(secondVote);
    assert.deepEqual(secondVote.turnout, { votedCount: 2, activeMemberCount: 3, percentage: 66.7 });
    const refreshed = await (await request(publicEndpoint, { headers: { Cookie: receiptCookie } })).json();
    assert.equal(refreshed.selectedOptionId, optionId);
    assert.deepEqual(refreshed.turnout, secondVote.turnout);
    const refreshedHtml = await (await request(sharePath, { headers: { Cookie: receiptCookie } })).text();
    assert.ok(refreshedHtml.includes("투표가 완료되었습니다")); assert.ok(refreshedHtml.includes("66.7%"));
    const totals = await (await request(endpoint, { headers: { Cookie: ownerCookie } })).json();
    assert.equal(totals.totalVotes, 2); assert.deepEqual(totals.options.map((option: { votes: number }) => option.votes), [1, 1]);
    assert.deepEqual(totals.turnout, secondVote.turnout);
    assert.deepEqual(totals.participants.map((row: { name: string; optionLabel: string }) => [row.name, row.optionLabel]).sort(), [["김회원", "일요일"], ["홍 길동", "토요일"]]);
    for (const secret of ["nameKey", "receiptHash"]) assert.ok(!JSON.stringify(totals).includes(secret));
    const adminResultHtml = await (await request(path, { headers: { Cookie: ownerCookie } })).text();
    for (const name of ["홍 길동", "김회원"]) assert.ok(adminResultHtml.includes(name));
    for (const auth of ["", memberCookie, receiptCookie]) {
      const data = await (await request(endpoint + "?admin=1", { headers: { Cookie: auth, "x-admin": "true" } })).json();
      assertPrivatePoll(data);
      for (const name of ["홍 길동", "김회원"]) assert.ok(!JSON.stringify(data).includes(name));
    }
    for (const target of [publicEndpoint, endpoint + "/votes"]) {
      for (const method of ["PATCH", "PUT", "DELETE"]) await request(target, { ...post({ optionId: initial.options[1].id }, receiptCookie), method }, 405);
    }
    assert.equal((await db.clubPollGuestBallot.findUniqueOrThrow({ where: { pollId_nameKey: { pollId: created.id, nameKey: "홍길동" } } })).optionId, optionId);
    assert.equal((await (await request(endpoint, { headers: { Cookie: ownerCookie } })).json()).totalVotes, 2);
    // Turnout follows only the current active roster of this team.
    await db.player.update({ where: { id: activePlayers[0] }, data: { isActive: false } });
    assert.deepEqual((await (await request(publicEndpoint)).json()).turnout, { votedCount: 2, activeMemberCount: 2, percentage: 100 });
    await db.player.updateMany({ where: { id: { in: activePlayers } }, data: { isActive: false } });
    assert.deepEqual((await (await request(publicEndpoint)).json()).turnout, { votedCount: 2, activeMemberCount: 0, percentage: null });
    const emptyRosterHtml = await (await request(sharePath)).text();
    assert.ok(emptyRosterHtml.includes("활성 회원이 등록되면 투표율을 계산합니다."));
    assert.ok(!emptyRosterHtml.includes('role="progressbar"'));
    await db.player.update({ where: { id: activePlayers[0] }, data: { isActive: true } });
    assert.deepEqual((await (await request(publicEndpoint)).json()).turnout, { votedCount: 2, activeMemberCount: 1, percentage: 200 });
    await db.player.updateMany({ where: { id: { in: activePlayers } }, data: { isActive: true } });
    await request(`${endpoint}/close`, post({}), 401);
    await request(`${endpoint}/close`, post({}, memberCookie), 403);
    assert.equal((await (await request(`${endpoint}/close`, post({}, ownerCookie))).json()).closed, true);
    await request(`${endpoint}/votes`, post({ name: "늦은회원", optionId }), 409);
    await request(`${endpoint}/close`, post({}, ownerCookie));
    assertPrivatePoll(await (await request(endpoint)).json());
    assertPrivatePoll(await (await request(publicEndpoint)).json());
    const closedHtml = await (await request(sharePath)).text();
    assert.ok(closedHtml.includes("접수가 마감되었습니다"));
    assert.ok(closedHtml.includes("투표 참여 현황")); assert.ok(closedHtml.includes("66.7%"));
    for (const text of ["최종 결과", "totalVotes", "participants", "홍 길동", "김회원"]) assert.ok(!closedHtml.includes(text), text);

    // Administrators can void ballots after closing. The ballot leaves the
    // tally and turnout, stays on record, and a stale ID never matches again.
    const voidPath = `${endpoint}/invalidate`;
    const voidTarget = totals.participants.find((row: { name: string }) => row.name === "김회원");
    await request(voidPath, post({ ballotId: voidTarget.id }), 401);
    await request(voidPath, post({ ballotId: voidTarget.id }, memberCookie), 403);
    await request(voidPath, { ...post({ ballotId: voidTarget.id }, ownerCookie), headers: { "Content-Type": "application/json", Origin: "https://evil.example", Cookie: ownerCookie } }, 403);
    for (const ballotId of [null, 123, "x".repeat(65)]) await request(voidPath, post({ ballotId }, ownerCookie), 400);
    await request(voidPath, post({ ballotId: "missing" }, ownerCookie), 404);
    const voided = await (await request(voidPath, post({ ballotId: voidTarget.id }, ownerCookie))).json();
    assert.equal(voided.totalVotes, 1); assert.deepEqual(voided.options.map((option: { votes: number }) => option.votes), [1, 0]);
    assert.deepEqual(voided.participants.map((row: { name: string }) => row.name), ["홍 길동"]);
    assert.deepEqual(voided.invalidBallots.map((row: { id: string; name: string; optionLabel: string }) => [row.id, row.name, row.optionLabel]), [[voidTarget.id, "김회원", "일요일"]]);
    assert.ok(Date.parse(voided.invalidBallots[0].invalidatedAt) >= Date.parse(voided.invalidBallots[0].createdAt));
    assert.deepEqual(voided.turnout, { votedCount: 1, activeMemberCount: 3, percentage: 33.3 });
    await request(voidPath, post({ ballotId: voidTarget.id }, ownerCookie), 404);
    const publicVoided = await (await request(publicEndpoint)).json(); assertPrivatePoll(publicVoided);
    assert.deepEqual(publicVoided.turnout, voided.turnout);
    const voidedAdminHtml = await (await request(path, { headers: { Cookie: ownerCookie } })).text();
    for (const text of ["무효 처리한 표", "김회원", "홍 길동님의 표 무효 처리"]) assert.ok(voidedAdminHtml.includes(text), text);
    const voidedPublicHtml = await (await request(sharePath)).text();
    for (const text of ["김회원", "무효 처리", "invalidBallots"]) assert.ok(!voidedPublicHtml.includes(text), text);

    // Voiding frees both the name and the browser receipt for a corrected vote.
    const retry = await (await request("/api/polls", post({ ...input, title: `무효 후 재투표 ${suffix}` }, ownerCookie), 201)).json(); polls.push(retry.id);
    const retryEndpoint = `/api/vote/${retry.id}`, retryAdmin = `/api/polls/${retry.id}`;
    const retryOptions = (await (await request(retryEndpoint)).json()).options;
    const firstRetry = await request(retryEndpoint, post({ name: "재투표회원", optionId: retryOptions[0].id }), 201);
    const retryCookie = firstRetry.headers.get("set-cookie")!.split(";")[0];
    const [retryBallot] = (await (await request(retryAdmin, { headers: { Cookie: ownerCookie } })).json()).participants;
    await request(`${retryAdmin}/invalidate`, post({ ballotId: retryBallot.id }, ownerCookie));
    assert.equal((await (await request(retryEndpoint, { headers: { Cookie: retryCookie } })).json()).selectedOptionId, null);
    assert.ok((await (await request(`/vote/${retry.id}`, { headers: { Cookie: retryCookie } })).text()).includes('name="voterName"'));
    const corrected = await (await request(retryEndpoint, post({ name: "재투표회원", optionId: retryOptions[1].id }, retryCookie), 201)).json();
    assert.equal(corrected.selectedOptionId, retryOptions[1].id);
    const retryTotals = await (await request(retryAdmin, { headers: { Cookie: ownerCookie } })).json();
    assert.deepEqual(retryTotals.options.map((option: { votes: number }) => option.votes), [0, 1]);
    assert.deepEqual(retryTotals.invalidBallots.map((row: { id: string }) => row.id), [retryBallot.id]);
    assert.notEqual(retryTotals.participants[0].id, retryBallot.id);
    await request(`${retryAdmin}/invalidate`, post({ ballotId: retryBallot.id }, ownerCookie), 404);
    assert.equal((await (await request(retryAdmin, { headers: { Cookie: ownerCookie } })).json()).totalVotes, 1);

    // Roster candidates: only this team's active players, with the profile
    // photo and the season record (completed matches only) captured at creation.
    const [star, teammate] = activePlayers, playerName = (id: number) => `명단 테스트 ${suffix} ${players.indexOf(id)}`;
    const season = `${defaultStartDate.slice(0, 4)} 시즌`, starRecord = `${season} · 1경기 1승 0패 · 2골 1도움 · MOM 1`;
    const matchFields = { teamId: team.id, matchDate: new Date(`${defaultStartDate}T10:00:00Z`), location: "테스트 구장", teamAName: "A", teamBName: "B", teamAScore: 3, teamBScore: 1, winnerTeam: "A" };
    const completed = await db.match.create({ data: { ...matchFields, status: "COMPLETED", matchPlayers: { create: [{ playerId: star, teamName: "A", result: "WIN", goals: 2, assists: 1, isMvp: true }, { playerId: teammate, teamName: "B", result: "LOSS" }] } } }); matches.push(completed.id);
    matches.push((await db.match.create({ data: { ...matchFields, status: "IN_PROGRESS", matchPlayers: { create: [{ playerId: star, teamName: "A", result: "WIN", goals: 9 }] } } })).id);
    const photo = `/uploads/players/${star}/poll-test.png`;
    await db.player.update({ where: { id: star }, data: { profileImageUrl: photo } });
    const newPollHtml = decode(await (await request("/polls/new", { headers: { Cookie: ownerCookie } })).text());
    for (const id of activePlayers) assert.ok(newPollHtml.includes(playerName(id)), playerName(id));
    for (const id of players.slice(3)) assert.ok(!newPollHtml.includes(playerName(id)), playerName(id));
    for (const text of ["활성 회원에서 후보 고르기", starRecord, `${season} · 출전 기록 없음`]) assert.ok(newPollHtml.includes(text), text);
    const rosterInput = { title: `시즌 MVP ${suffix}`, options: [{ playerId: star }, { playerId: teammate }, "기권"] };
    for (const options of [[{ playerId: players[3] }, "기권"], [{ playerId: players[4] }, "기권"], [{ playerId: 999999999 }, "기권"], [{ playerId: star }, { playerId: star }], [{ playerId: star }, playerName(star)]]) await request("/api/polls", post({ ...rosterInput, options }, ownerCookie), 400);
    await request("/t/arena-fc/api/polls", post(rosterInput, ownerCookie, platform), 400, platform);
    await request("/api/polls", post({ ...rosterInput, options: Array.from({ length: 50 }, (_, i) => `후보 ${i}`) }, ownerCookie), 201).then(async response => polls.push((await response.json()).id));
    await request("/api/polls", post({ ...rosterInput, options: Array.from({ length: 51 }, (_, i) => `후보 ${i}`) }, ownerCookie), 400);
    const roster = await (await request("/api/polls", post(rosterInput, ownerCookie), 201)).json(); polls.push(roster.id);
    type OptionView = { id: string; label: string; detail: string; playerId: number | null; profileImageUrl: string | null };
    const rosterPublic = await (await request(`/api/vote/${roster.id}`)).json(); assertPrivatePoll(rosterPublic);
    assert.deepEqual(rosterPublic.options.map((option: OptionView) => [option.label, option.detail, option.playerId, option.profileImageUrl]), [
      [playerName(star), starRecord, star, photo],
      [playerName(teammate), `${season} · 1경기 0승 1패 · 0골 0도움 · MOM 0`, teammate, null],
      ["기권", "", null, null]
    ]);
    const rosterHtml = decode(await (await request(`/vote/${roster.id}`)).text());
    for (const text of [starRecord, "시즌 기록은 투표를 만든", `${playerName(star)} 프로필 사진`]) assert.ok(rosterHtml.includes(text), text);
    assert.ok(decode(await (await request(`/polls/${roster.id}`, { headers: { Cookie: ownerCookie } })).text()).includes(starRecord));
    // The record stays as captured, while the photo follows the profile.
    await db.matchPlayer.updateMany({ where: { matchId: completed.id, playerId: star }, data: { goals: 5 } });
    await db.player.update({ where: { id: teammate }, data: { profileImageUrl: photo } });
    const later = await (await request(`/api/vote/${roster.id}`)).json();
    assert.equal(later.options[0].detail, starRecord); assert.equal(later.options[1].profileImageUrl, photo);
    await request(`/api/vote/${roster.id}`, post({ name: "후보투표회원", optionId: rosterPublic.options[0].id }), 201);
    const rosterTotals = await (await request(`/api/polls/${roster.id}`, { headers: { Cookie: ownerCookie } })).json();
    assert.deepEqual(rosterTotals.options.map((option: { votes: number }) => option.votes), [1, 0, 0]);
    assert.equal(rosterTotals.participants[0].optionLabel, playerName(star));
    // Removing a player keeps the candidate's name and record on the poll.
    await db.player.delete({ where: { id: teammate } });
    assert.deepEqual((await (await request(`/api/vote/${roster.id}`)).json()).options[1], { ...rosterPublic.options[1], playerId: null, profileImageUrl: null });
    const deadline = await (await request("/api/polls", post({ ...input, title: "마감 시각 검사" }, ownerCookie), 201)).json(); polls.push(deadline.id);
    await db.clubPoll.update({ where: { id: deadline.id }, data: { closesAt: new Date(Date.now() - 1000) } });
    const deadlineOption = await db.clubPollOption.findFirstOrThrow({ where: { pollId: deadline.id } });
    await request(`/api/polls/${deadline.id}/votes`, post({ name: "마감회원", optionId: deadlineOption.id }), 409);
    await db.teamAdmin.update({ where: { teamId_adminId: { teamId: team.id, adminId: owner.id } }, data: { role: "MEMBER" } });
    await request("/api/polls", post(input, ownerCookie), 403);
    await request(voidPath, post({ ballotId: "missing" }, ownerCookie), 403);
    assertPrivatePoll(await (await request(endpoint, { headers: { Cookie: ownerCookie } })).json());
    assert.equal((await request(path, { headers: { Cookie: ownerCookie } }, 307)).headers.get("location"), sharePath);
    console.log(`Legacy polls integration passed: ${checks} HTTP checks, public turnout before/after voting, active-roster and team scoping, zero denominators, private option results, immutable submissions, ballot invalidation, roster candidates and permission revocation.`);
  } finally {
    await db.clubPoll.deleteMany({ where: { id: { in: polls } } });
    await db.admin.deleteMany({ where: { id: { in: accounts } } });
    await db.match.deleteMany({ where: { id: { in: matches } } });
    await db.player.deleteMany({ where: { id: { in: players } } });
    await db.team.deleteMany({ where: { id: { in: fixtureTeams } } });
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
