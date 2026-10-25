import assert from "node:assert/strict";
import { teamPath } from "../lib/team-paths";
import { parseTeamFields } from "../lib/team-validation";
const base = "/t/hangang-fc";
assert.equal(teamPath(base, "/"), base);
assert.equal(teamPath(base, "/players/12?sort=goals#stats"), `${base}/players/12?sort=goals#stats`);
for (const path of ["/teams", "/teams/new", "/login", "/t/another-fc/matches", "/images/logo.png", "/uploads/players/1/a.png", "#stats", "https://example.com", "//example.com"]) assert.equal(teamPath(base, path), path);
assert.equal(teamPath("", "/matches/1"), "/matches/1");
const form = new FormData();
for (const [key, value] of Object.entries({ name: "한강 FC", slug: "hangang-fc", region: "서울", description: "함께 뛰는 팀", color: "#123abc" })) form.set(key, value);
assert.equal(parseTeamFields(form).name, "한강 FC");
for (const slug of ["../abcd", "a/b", "a.b", "a--b", "-test", "test-", "a", "x".repeat(49)]) { form.set("slug", slug); assert.throws(() => parseTeamFields(form)); }
form.set("slug", "HANGANG-FC"); assert.equal(parseTeamFields(form).slug, "hangang-fc");
form.set("color", "red;display:none"); assert.throws(() => parseTeamFields(form));
console.log("Team validation and scoped paths passed");
