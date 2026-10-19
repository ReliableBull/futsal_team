import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { calculatePlayerChemistry, parseChemistryFilters, type ChemistryMatch, type ChemistryPlayer } from "../lib/player-chemistry";
import { buildMatchShareData, matchShareTitle } from "../lib/match-share-card";
import { buildPlayerCardData } from "../lib/player-card";
import { getPlayerCardPhotos } from "../lib/player-card-photos";
import portraits from "../public/images/player-portraits/20261005/manifest.json";
import cartoons from "../public/images/player-cartoons/20261005/manifest.json";

const players: ChemistryPlayer[] = [
  { id: 1, name: "기준 선수", nickname: null, isActive: true },
  { id: 2, name: "같은 이름", nickname: null, isActive: true },
  { id: 3, name: "같은 이름", nickname: null, isActive: false },
  { id: 4, name: "상대 선수", nickname: null, isActive: true }
];
function match(id: number, date: string, a: number[], b: number[], scoreA: number, scoreB: number, status = "COMPLETED"): ChemistryMatch {
  return {
    id, status, matchDate: new Date(`${date}T12:00:00.000Z`), teamAName: "A", teamBName: "B", teamAScore: scoreA, teamBScore: scoreB,
    matchPlayers: [...a.map((playerId) => ({ playerId, teamName: "A" })), ...b.map((playerId) => ({ playerId, teamName: "B" }))]
      .map((record) => ({ ...record, goals: 0, assists: 0, player: players.find((player) => player.id === record.playerId)! })),
    goals: []
  };
}

const win = match(1, "2025-12-31", [1, 2], [3, 4], 3, 1);
win.matchPlayers[0].goals = 3;
win.goals = [
  { scorerId: 1, assisterId: 2, assistKnown: true },
  { scorerId: 1, assisterId: null, assistKnown: true },
  { scorerId: 1, assisterId: null, assistKnown: false }
];
const draw = match(2, "2026-01-01", [3, 4], [1, 2], 1, 1);
draw.matchPlayers.find((player) => player.playerId === 1)!.assists = 1;
draw.goals = [{ scorerId: 2, assisterId: 1, assistKnown: true }];
const loss = match(3, "2026-01-31", [2, 4], [1, 3], 2, 0);
const legacy = match(4, "2026-02-01", [1, 3], [2, 4], 4, 0);
legacy.matchPlayers[0].goals = 2;
legacy.matchPlayers[0].assists = 2;
const ongoing = match(5, "2026-02-02", [1, 2], [3, 4], 99, 0, "IN_PROGRESS");
const absent = match(6, "2026-02-03", [2], [3, 4], 2, 1);
const matches = [legacy, draw, ongoing, loss, win, absent];
const filters = parseChemistryFilters({ minMatches: "1", startDate: "", endDate: "" });
const data = calculatePlayerChemistry(1, matches, filters);

assert.equal(data.totalMatches, 4, "exclude ongoing matches and games the selected player missed");
assert.equal(data.firstDate, "2025-12-31");
assert.equal(data.lastDate, "2026-02-01");
assert.equal(data.teammateCount, 2, "identify players by ID, including inactive historical players");
assert.deepEqual(data.teammates.map((record) => [record.player.id, record.matches, record.wins, record.draws, record.losses, record.winRate]), [
  [2, 2, 1, 1, 0, 50], [3, 2, 1, 0, 1, 50]
]);
assert.deepEqual(data.opponents.find((record) => record.player.id === 4), {
  player: players[3], matches: 4, wins: 2, draws: 1, losses: 1, winRate: 50, goalsFor: 8, goalsAgainst: 4
}, "head-to-head results must be from the selected player's side, including team B");
assert.deepEqual(data.connections, [{ player: players[1], received: 1, supplied: 1, total: 2 }]);
assert.equal(data.unknownGoalLinks, 3, "unknown and absent historical links count; a known unassisted goal does not");
assert.equal(data.unknownAssistLinks, 2, "legacy assist totals never invent a partner");

const minimum = calculatePlayerChemistry(1, matches, { ...filters, minMatches: 3 });
assert.equal(minimum.teammates.length, 0);
assert.deepEqual(minimum.opponents.map((record) => record.player.id), [4]);
assert.deepEqual(minimum.connections, data.connections, "minimum appearances only filters match records");
const january = calculatePlayerChemistry(1, matches, { ...filters, startDate: "2026-01-01", endDate: "2026-01-31" });
assert.equal(january.totalMatches, 2, "date endpoints are inclusive and use the stored UTC match date");
assert.equal(january.opponents.find((record) => record.player.id === 4)!.winRate, 0);
assert.equal(calculatePlayerChemistry(1, matches, { ...filters, startDate: "2026-02-01" }).totalMatches, 1);
assert.equal(calculatePlayerChemistry(1, matches, { ...filters, endDate: "2025-12-31" }).totalMatches, 1);
assert.equal(calculatePlayerChemistry(999, matches, filters).totalMatches, 0);
assert.deepEqual(calculatePlayerChemistry(1, [], filters).connections, []);
const reversed = calculatePlayerChemistry(4, matches, filters);
assert.equal(reversed.opponents.find((record) => record.player.id === 1)!.wins, 1);
assert.equal(reversed.opponents.find((record) => record.player.id === 1)!.losses, 2);
const malformed = match(7, "2026-03-01", [1, 2], [3, 4], 2, 0);
malformed.matchPlayers[0].goals = 2;
malformed.goals = [{ scorerId: 1, assisterId: 1, assistKnown: true }, { scorerId: 1, assisterId: 3, assistKnown: true }];
assert.equal(calculatePlayerChemistry(1, [malformed], filters).connections.length, 0, "self-assists and opposing-team assists never create a connection");
assert.equal(calculatePlayerChemistry(1, [malformed], filters).unknownGoalLinks, 2);
for (const invalid of [{ startDate: "2026-02-30" }, { startDate: "2026-02-01", endDate: "2026-01-01" }, { playerId: "1.5" }, { playerId: ["1", "2"] }, { minMatches: "0" }, { endDate: "invalid" }]) {
  assert.throws(() => parseChemistryFilters(invalid));
}
assert.equal(parseChemistryFilters({}).minMatches, 3);
assert.equal(parseChemistryFilters({ startDate: "2024-02-29" }).startDate, "2024-02-29");
const beforeKoreanMidnight = new Date("2026-10-04T14:59:59.999Z");
const afterKoreanMidnight = new Date("2026-10-04T15:00:00.000Z");
assert.deepEqual(parseChemistryFilters({}, beforeKoreanMidnight), { playerId: undefined, startDate: "2026-01-01", endDate: "2026-10-04", minMatches: 3 });
assert.equal(parseChemistryFilters({ playerId: "2" }, afterKoreanMidnight).endDate, "2026-10-05", "player-detail links get today's date in Korea, regardless of server timezone");
assert.equal(parseChemistryFilters({}, new Date("2026-12-31T15:00:00Z")).startDate, "2026-01-01", "the requested initial start stays January 1, 2026 across years");
assert.equal(parseChemistryFilters({}, new Date("2026-12-31T15:00:00Z")).endDate, "2027-01-01");
assert.equal(parseChemistryFilters({ startDate: "", endDate: "" }, afterKoreanMidnight).endDate, "", "explicit all-time filters do not regain default dates");
assert.equal(parseChemistryFilters({ startDate: "2025-01-01" }, afterKoreanMidnight).endDate, "", "custom open-ended filters remain open-ended");
assert.equal(calculatePlayerChemistry(1, matches, parseChemistryFilters({ minMatches: "1" }, beforeKoreanMidnight)).totalMatches, 3, "initial results actually exclude matches before 2026");

const share = buildMatchShareData({
  ...win, location: "풋살장",
  matchPlayers: win.matchPlayers.map((player) => ({ ...player, isMvp: player.playerId === 1 || player.playerId === 2 }))
});
assert.equal(share.date, "2025-12-31");
assert.equal(share.teams[0].players.filter((player) => player.isMvp).length, 2, "multiple MOM winners must survive export");
assert.equal(share.teams[1].players.length, 2);
assert.equal(share.completed, true);
assert.match(matchShareTitle({ ...share, completed: false }), /경기 진행 중/);
assert.equal(share.teams[0].score, 3, "keep official team scores instead of recalculating from player totals");
const playerCardSource = {
  id: 42, name: "카드 선수", nickname: null, number: 0, position: "미드필더", profileImageUrl: "data:image/png;base64,fixture",
  totalMatches: 3, wins: 1, draws: 1, losses: 1, winRate: 33.3, goals: 2, assists: 4, mvpCount: 2
};
const playerCard = buildPlayerCardData(playerCardSource, [new Date("2026-09-30T23:59:00.000Z"), new Date("2025-12-31T00:00:00.000Z")]);
assert.equal(playerCard.photoUrl, playerCardSource.profileImageUrl, "uploaded data-URL photos retain the registered image");
assert.equal(playerCard.number, 0, "zero is a valid squad number, not a missing number");
assert.equal(playerCard.periodLabel, "2025-12-31 ~ 2026-09-30", "all-time coverage preserves UTC match dates across seasons");
assert.equal(playerCard.attackPoints, 6);
assert.equal(buildPlayerCardData({ ...playerCardSource, profileImageUrl: "/uploads/players/42/photo.jpg" }, []).photoUrl, "/uploads/players/42/photo.jpg");
const emptyCard = buildPlayerCardData({ ...playerCardSource, number: null, profileImageUrl: null, totalMatches: 0, wins: 0, draws: 0, losses: 0, winRate: 0, goals: 0, assists: 0, mvpCount: 0 }, []);
assert.equal(emptyCard.photoUrl, "/images/players/42.jpg");
assert.equal(emptyCard.number, null);
assert.equal(emptyCard.periodLabel, "아직 완료된 출전 경기가 없습니다");
assert.equal(emptyCard.attackPoints, 0);
const posePhotos = getPlayerCardPhotos(23, playerCardSource.profileImageUrl);
assert.deepEqual(posePhotos.map((photo) => photo.id), ["profile", "arms-crossed", "cheering", "cartoon-arms-crossed", "cartoon-cheering"]);
assert.equal(posePhotos[0].url, playerCardSource.profileImageUrl, "pose choices must preserve the current uploaded profile");
assert.equal(getPlayerCardPhotos(15, "profile.jpg")[1].url, "/images/player-portraits/20261005/15/arms-crossed-v2.png", "use the corrected logo image, not a guessed filename");
assert.equal(getPlayerCardPhotos(18, "profile.jpg")[1].url, "/images/player-portraits/20261005/18/arms-crossed-v2.png");
assert.equal(getPlayerCardPhotos(37, "profile.jpg").length, 5, "the zero-number player still has both poses in each style");
assert.equal(getPlayerCardPhotos(44, "profile.jpg").length, 5, "an unnumbered player still has both poses in each style");
for (const id of [...portraits.missingReference.map((player) => player.id), 999]) {
  assert.deepEqual(getPlayerCardPhotos(id, "profile.jpg").map((photo) => photo.id), ["profile"], "missing or new players must not receive someone else's pose");
}
for (const player of portraits.players) {
  const options = getPlayerCardPhotos(player.id, "profile.jpg").filter((photo) => photo.id === "arms-crossed" || photo.id === "cheering");
  for (const photo of options) {
    assert.ok(photo.url.startsWith(`/images/player-portraits/20261005/${player.id}/`), "a card must use its own player's portrait");
    assert.ok(existsSync(path.join(process.cwd(), "public", photo.url)), `portrait file missing: ${photo.url}`);
    assert.equal(photo.fit, "contain", "keep full-body poses inside the card's photo area");
  }
}
assert.deepEqual(cartoons.players.map((player) => player.id), portraits.players.map((player) => player.id), "both style collections must cover the same prepared players");
for (const player of cartoons.players) {
  const options = getPlayerCardPhotos(player.id, "profile.jpg").filter((photo) => photo.id.startsWith("cartoon-"));
  assert.equal(options.length, 2);
  for (const photo of options) {
    assert.ok(photo.url.startsWith(`/images/player-cartoons/20261005/${player.id}/`), "cartoons must belong to the selected player");
    assert.ok(existsSync(path.join(process.cwd(), "public", photo.url)), `cartoon file missing: ${photo.url}`);
    assert.equal(photo.fit, "contain");
  }
}
console.log("Web features: chemistry, date filters, legacy links, match cards and player cards passed");
