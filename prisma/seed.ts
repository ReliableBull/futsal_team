import { PrismaClient } from "@prisma/client";
import { pbkdf2Sync, randomBytes } from "node:crypto";

const prisma = new PrismaClient();

const result = {
  win: "WIN",
  loss: "LOSS",
  draw: "DRAW"
} as const;

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");

  return `pbkdf2:120000:${salt}:${hash}`;
}

async function main() {
  await prisma.matchPlayer.deleteMany();
  await prisma.match.deleteMany();
  await prisma.player.deleteMany();
  await prisma.admin.deleteMany();

  await prisma.admin.create({
    data: {
      username: "admin",
      passwordHash: hashPassword("dlGhwns12!")
    }
  });

  const playerSeeds = [
    "이호준",
    "이동훈",
    "강수길",
    "김대익",
    "김민규",
    "박상훈",
    "안민수",
    "김상목",
    "김윤태",
    "송원섭",
    "오세현",
    "정대규"
  ];

  const positions = ["FW", "MF", "DF", "GK"];
  const players = await Promise.all(
    playerSeeds.map((name, index) =>
      prisma.player.create({
        data: {
          name,
          nickname: name.slice(1),
          position: positions[index % positions.length],
          number: index + 7,
          isActive: true
        }
      })
    )
  );

  const byName = Object.fromEntries(players.map((player) => [player.name, player]));

  await prisma.match.create({
    data: {
      matchDate: new Date("2026-05-01"),
      location: "동호회 풋살장",
      teamAName: "회장팀",
      teamBName: "총무팀",
      teamAScore: 6,
      teamBScore: 7,
      winnerTeam: "총무팀",
      chairmanTeamMvpId: byName["김대익"].id,
      managerTeamMvpId: byName["안민수"].id,
      memo: "막판 역전골로 총무팀 승리.",
      matchPlayers: {
        create: [
          { playerId: byName["이호준"].id, teamName: "회장팀", result: result.loss, goals: 1, assists: 0 },
          { playerId: byName["강수길"].id, teamName: "회장팀", result: result.loss, goals: 1, assists: 1 },
          { playerId: byName["김대익"].id, teamName: "회장팀", result: result.loss, goals: 2, assists: 0, isMvp: true },
          { playerId: byName["김민규"].id, teamName: "회장팀", result: result.loss, goals: 1, assists: 1 },
          { playerId: byName["박상훈"].id, teamName: "회장팀", result: result.loss, goals: 1, assists: 0 },
          { playerId: byName["이동훈"].id, teamName: "총무팀", result: result.win, goals: 1, assists: 2 },
          { playerId: byName["안민수"].id, teamName: "총무팀", result: result.win, goals: 4, assists: 0, isMvp: true },
          { playerId: byName["김상목"].id, teamName: "총무팀", result: result.win, goals: 1, assists: 1 },
          { playerId: byName["김윤태"].id, teamName: "총무팀", result: result.win, goals: 1, assists: 0 },
          { playerId: byName["송원섭"].id, teamName: "총무팀", result: result.win, goals: 0, assists: 1 }
        ]
      }
    }
  });

  await prisma.match.create({
    data: {
      matchDate: new Date("2026-05-08"),
      location: "동호회 풋살장",
      teamAName: "회장팀",
      teamBName: "총무팀",
      teamAScore: 5,
      teamBScore: 5,
      winnerTeam: null,
      chairmanTeamMvpId: byName["이호준"].id,
      managerTeamMvpId: byName["이동훈"].id,
      memo: "팽팽한 무승부 경기.",
      matchPlayers: {
        create: [
          { playerId: byName["이호준"].id, teamName: "회장팀", result: result.draw, goals: 1, assists: 1, isMvp: true },
          { playerId: byName["강수길"].id, teamName: "회장팀", result: result.draw, goals: 1, assists: 0 },
          { playerId: byName["김대익"].id, teamName: "회장팀", result: result.draw, goals: 1, assists: 1 },
          { playerId: byName["오세현"].id, teamName: "회장팀", result: result.draw, goals: 1, assists: 0 },
          { playerId: byName["정대규"].id, teamName: "회장팀", result: result.draw, goals: 1, assists: 0 },
          { playerId: byName["이동훈"].id, teamName: "총무팀", result: result.draw, goals: 2, assists: 1, isMvp: true },
          { playerId: byName["안민수"].id, teamName: "총무팀", result: result.draw, goals: 1, assists: 0 },
          { playerId: byName["김상목"].id, teamName: "총무팀", result: result.draw, goals: 1, assists: 1 },
          { playerId: byName["김윤태"].id, teamName: "총무팀", result: result.draw, goals: 1, assists: 0 },
          { playerId: byName["송원섭"].id, teamName: "총무팀", result: result.draw, goals: 0, assists: 1 }
        ]
      }
    }
  });

  await prisma.match.create({
    data: {
      matchDate: new Date("2026-05-15"),
      location: "동호회 풋살장",
      teamAName: "회장팀",
      teamBName: "총무팀",
      teamAScore: 8,
      teamBScore: 6,
      winnerTeam: "회장팀",
      chairmanTeamMvpId: byName["이호준"].id,
      managerTeamMvpId: byName["김상목"].id,
      memo: "회장팀이 초반 리드를 끝까지 지킨 경기.",
      matchPlayers: {
        create: [
          { playerId: byName["이호준"].id, teamName: "회장팀", result: result.win, goals: 2, assists: 1, isMvp: true },
          { playerId: byName["강수길"].id, teamName: "회장팀", result: result.win, goals: 1, assists: 1 },
          { playerId: byName["김대익"].id, teamName: "회장팀", result: result.win, goals: 2, assists: 0 },
          { playerId: byName["김민규"].id, teamName: "회장팀", result: result.win, goals: 2, assists: 1 },
          { playerId: byName["오세현"].id, teamName: "회장팀", result: result.win, goals: 1, assists: 0 },
          { playerId: byName["이동훈"].id, teamName: "총무팀", result: result.loss, goals: 1, assists: 2 },
          { playerId: byName["안민수"].id, teamName: "총무팀", result: result.loss, goals: 2, assists: 0 },
          { playerId: byName["김상목"].id, teamName: "총무팀", result: result.loss, goals: 2, assists: 1, isMvp: true },
          { playerId: byName["김윤태"].id, teamName: "총무팀", result: result.loss, goals: 1, assists: 0 },
          { playerId: byName["정대규"].id, teamName: "총무팀", result: result.loss, goals: 0, assists: 1 }
        ]
      }
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
