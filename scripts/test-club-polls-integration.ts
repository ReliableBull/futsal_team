import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/auth";

assert.equal(process.env.ALLOW_TEAMS_TEST_DB, "1");
assert.match(new URL(process.env.DATABASE_URL || "http://invalid").pathname, /^\/arena_teams_test_[a-z0-9_]+$/);
const origin = process.env.TEAMS_TEST_URL || "http://127.0.0.1:3110";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const db = new PrismaClient();
const suffix = randomUUID().slice(0, 8);
const password = `poll-test-${suffix}!`;
const accounts: number[] = [], teams: number[] = [];
let checks = 0;
function cookie(account: { id: number; username: string }) {
  const value = `${account.id}.${account.username}.${Date.now() + 3600000}`;
  return `arena_admin_session=${value}.${createHmac("sha256", process.env.AUTH_SECRET || "arena-futsal-record-local-secret").update(value).digest("hex")}`;
}
async function request(path: string, options: RequestInit = {}, status = 200) {
  const result = await fetch(origin + path, { redirect: "manual", ...options });
  assert.equal(result.status, status, `${options.method || "GET"} ${path}: expected ${status}, received ${result.status}`);
  checks++; return result;
}
const decode = (value: string) => value.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&");
async function main() {
  try {
    const owner = await db.admin.create({ data: { username: `poll_owner_${suffix}`, passwordHash: hashPassword(password) } }); accounts.push(owner.id);
    const member = await db.admin.create({ data: { username: `poll_member_${suffix}`, passwordHash: hashPassword(password) } }); accounts.push(member.id);
    const second = await db.admin.create({ data: { username: `poll_second_${suffix}`, passwordHash: hashPassword(password) } }); accounts.push(second.id);
    const outsider = await db.admin.create({ data: { username: `poll_other_${suffix}`, passwordHash: hashPassword(password) } }); accounts.push(outsider.id);
    const team = await db.team.create({ data: { slug: `poll-${suffix}`, name: "의사결정 테스트", admins: { create: [{ adminId: owner.id, role: "PRESIDENT" }, { adminId: member.id }, { adminId: second.id }] } } }); teams.push(team.id);
    const other = await db.team.create({ data: { slug: `other-${suffix}`, name: "다른 동호회", admins: { create: { adminId: outsider.id, role: "PRESIDENT" } } } }); teams.push(other.id);
    const base = `/t/${team.slug}`, api = `${base}/api/polls`;
    const headers = (account: typeof owner) => ({ Cookie: cookie(account), Origin: origin, "Content-Type": "application/json" });
    const post = (account: typeof owner, body: unknown) => ({ method: "POST", headers: headers(account), body: JSON.stringify(body) });
    const input = { title: "다음 모임은 언제 할까요?", description: "회원들이 결정합니다.", options: ["토요일", "일요일"], closesAt: new Date(Date.now() + 86400000).toISOString(), teamId: other.id };
    await request(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }, 401);
    await request(api, post(member, input), 403);
    await request(api, post(outsider, input), 403);
    await request(api, { ...post(owner, input), headers: { ...headers(owner), Origin: "https://evil.example" } }, 403);
    await request(api, post(owner, { ...input, options: ["찬성", "찬성"] }), 400);
    const created = await (await request(api, post(owner, input), 201)).json();
    const pollId: string = created.id;
    assert.equal((await db.clubPoll.findUniqueOrThrow({ where: { id: pollId } })).teamId, team.id);
    const endpoint = `${api}/${pollId}`, path = `${base}/polls/${pollId}`;
    const ownerPoll = await (await request(endpoint, { headers: headers(owner) })).json();
    assert.equal(ownerPoll.canManage, true);
    const memberPoll = await (await request(endpoint, { headers: headers(member) })).json();
    assert.equal(memberPoll.canManage, false);
    assert.equal(memberPoll.totalVotes, 0);
    const optionId = memberPoll.options[0].id;
    await request(endpoint, {}, 401); await request(endpoint, { headers: headers(outsider) }, 403);
    await request(`/t/${other.slug}/api/polls/${pollId}`, { headers: headers(outsider) }, 404);
    await request(`/api/polls/${pollId}`, { headers: { ...headers(owner), "x-futsal-team": team.slug } }, 403);
    const redirect = await request(path, {}, 307);
    assert.equal(redirect.headers.get("location"), `/login?next=${encodeURIComponent(path)}`);
    const outsidePage = await (await request(path, { headers: headers(outsider) })).text();
    assert.ok(!outsidePage.includes(input.title));

    // A shared link survives the real login form submission.
    const loginPath = `/login?next=${encodeURIComponent(path)}`;
    const loginHtml = await (await request(loginPath)).text();
    const loginForm = Array.from(loginHtml.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)).map(m => m[0]).find(form => form.includes('name="username"'));
    assert.ok(loginForm);
    const formData = new FormData();
    for (const [field] of Array.from(loginForm.matchAll(/<input\b[^>]*type="hidden"[^>]*>/g))) {
      const name = field.match(/\bname="([^"]*)"/)?.[1];
      if (name) formData.set(decode(name), decode(field.match(/\bvalue="([^"]*)"/)?.[1] || ""));
    }
    formData.set("username", member.username); formData.set("password", password);
    const signedIn = await request(loginPath, { method: "POST", headers: { Origin: origin }, body: formData }, 303);
    assert.equal(signedIn.headers.get("location"), path);
    assert.ok(signedIn.headers.get("set-cookie")?.includes("arena_admin_session="));
    const detailHtml = await (await request(path, { headers: headers(member) })).text();
    for (const text of [input.title, "투표 링크 복사", "공유하기", "한 가지를 선택해주세요"]) assert.ok(detailHtml.includes(text), text);
    assert.ok(!detailHtml.includes("투표 마감하기"));
    assert.ok((await (await request(path, { headers: headers(owner) })).text()).includes("투표 마감하기"));
    await request(`${base}/polls`, { headers: headers(member) });
    await request(`${base}/polls/new`, { headers: headers(owner) });

    const otherPollId = (await (await request(api, post(owner, { ...input, title: "또 다른 투표" }), 201)).json()).id;
    const otherOption = await db.clubPollOption.findFirstOrThrow({ where: { pollId: otherPollId } });
    await request(`${endpoint}/votes`, post(member, { optionId: otherOption.id }), 400);
    await request(`${endpoint}/votes`, post(member, { optionId: "missing" }), 400);
    await request(`${endpoint}/votes`, post(outsider, { optionId }), 403);
    const concurrent = await Promise.all([1, 2].map(() => fetch(origin + `${endpoint}/votes`, { ...post(member, { optionId }), redirect: "manual" })));
    assert.deepEqual(concurrent.map(response => response.status).sort(), [201, 409]); checks += 2;
    await request(`${endpoint}/votes`, post(member, { optionId: memberPoll.options[1].id }), 409);
    await request(`${endpoint}/votes`, post(second, { optionId: memberPoll.options[1].id }), 201);
    await request(`${endpoint}/votes`, post(owner, { optionId }), 201);
    const results = await (await request(endpoint, { headers: headers(member) })).json();
    assert.equal(results.totalVotes, 3); assert.equal(results.selectedOptionId, optionId);
    assert.deepEqual(results.options.map((option: { votes: number }) => option.votes), [2, 1]);
    assert.ok(!JSON.stringify(results).includes("voterId")); assert.ok(!JSON.stringify(results).includes("creatorId"));
    await request(`${endpoint}/close`, post(member, {}), 403);
    await request(`${endpoint}/close`, post(outsider, {}), 403);
    const closed = await (await request(`${endpoint}/close`, post(owner, {}))).json();
    assert.equal(closed.closed, true);
    await request(`${endpoint}/votes`, post(member, { optionId }), 409);
    await request(`${endpoint}/close`, post(owner, {}));

    const otherEndpoint = `${api}/${otherPollId}`;
    await db.clubPoll.update({ where: { id: otherPollId }, data: { closesAt: new Date(Date.now() - 1000) } });
    await request(`${otherEndpoint}/votes`, post(member, { optionId: otherOption.id }), 409);
    assert.equal((await (await request(otherEndpoint, { headers: headers(member) })).json()).closed, true);
    await db.teamAdmin.delete({ where: { teamId_adminId: { teamId: team.id, adminId: member.id } } });
    await request(endpoint, { headers: headers(member) }, 403);
    await request(`${endpoint}/votes`, post(member, { optionId }), 403);
    await db.teamAdmin.update({ where: { teamId_adminId: { teamId: team.id, adminId: owner.id } }, data: { role: "MEMBER" } });
    await request(`${otherEndpoint}/close`, post(owner, {}), 403);
    await request(api, post(owner, input), 403);
    console.log(`Club polls integration passed: ${checks} HTTP checks, role/team isolation, shared-link login return, concurrent duplicate prevention, tally privacy, manual/deadline closing and membership revocation.`);
  } finally {
    await db.team.deleteMany({ where: { id: { in: teams } } });
    await db.admin.deleteMany({ where: { id: { in: accounts } } });
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
