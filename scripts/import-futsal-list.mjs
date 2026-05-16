import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";

const prisma = new PrismaClient();
const data = JSON.parse(await readFile(new URL("./futsal-list-data.json", import.meta.url), "utf8"));

const resultMap = {
  "승": "WIN",
  "패": "LOSS",
  "무": "DRAW"
};

function scoreFor(resultA, resultB) {
  if (resultA === "승" || resultB === "패") return [1, 0];
  if (resultA === "패" || resultB === "승") return [0, 1];
  return [0, 0];
}

function playerResult(teamResult, otherResult) {
  if (teamResult) return resultMap[teamResult] ?? "DRAW";
  if (otherResult === "승") return "LOSS";
  if (otherResult === "패") return "WIN";
  return "DRAW";
}

function memoFor(match) {
  const notes = [];
  if (match.title) notes.push(match.title);
  if (!match.resultA && !match.resultB) notes.push("LIST 결과 미기재");
  return notes.length > 0 ? notes.join(" / ") : null;
}

async function main() {
  await prisma.matchPlayer.deleteMany();
  await prisma.match.deleteMany();
  await prisma.player.deleteMany();

  const players = await Promise.all(
    data.players.map((name, index) =>
      prisma.player.create({
        data: {
          name,
          nickname: null,
          position: "FP",
          number: index + 1,
          isActive: true
        }
      })
    )
  );

  const byName = Object.fromEntries(players.map((player) => [player.name, player]));

  for (const match of data.matches) {
    const [teamAScore, teamBScore] = scoreFor(match.resultA, match.resultB);
    const winnerTeam = teamAScore === teamBScore ? null : teamAScore > teamBScore ? match.teamAName : match.teamBName;

    await prisma.match.create({
      data: {
        matchDate: new Date(`${match.date}T00:00:00.000Z`),
        location: "동호 실내 풋살장",
        teamAName: match.teamAName,
        teamBName: match.teamBName,
        teamAScore,
        teamBScore,
        winnerTeam,
        memo: memoFor(match),
        matchPlayers: {
          create: [
            ...match.teamAPlayers.map((name) => ({
              playerId: byName[name].id,
              teamName: match.teamAName,
              result: playerResult(match.resultA, match.resultB)
            })),
            ...match.teamBPlayers.map((name) => ({
              playerId: byName[name].id,
              teamName: match.teamBName,
              result: playerResult(match.resultB, match.resultA)
            }))
          ]
        }
      }
    });
  }

  const [playerCount, matchCount, recordCount] = await Promise.all([
    prisma.player.count(),
    prisma.match.count(),
    prisma.matchPlayer.count()
  ]);

  console.log(`Imported ${playerCount} players, ${matchCount} matches, ${recordCount} match-player records.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
