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
  if (await prisma.team.count({ where: { id: { not: 1 } } })) throw new Error("Legacy seed/import is disabled when multiple teams exist. Restore into a separate database.");
  await prisma.matchGoal.deleteMany();
  await prisma.matchPlayer.deleteMany();
  await prisma.match.deleteMany();
  await prisma.player.deleteMany();
  await prisma.admin.deleteMany();

  await prisma.admin.create({
    data: {
      username: "admin",
      teams: { create: { teamId: 1, role: "PRESIDENT" } },
      passwordHash: hashPassword("dlGhwns12!")
    }
  });

  const playerSeeds = [
    "Lee Hojoon",
    "Kim Minjae",
    "Park Sangwoo",
    "Choi Junseo",
    "Jung Hyun",
    "Kang Sumin",
    "Yoon Taehyun",
    "Han Jiwon",
    "Seo Dongmin",
    "Oh Seungjae",
    "Lim Gyumin",
    "Baek Dohyun"
  ];

  const positions = ["FW", "MF", "DF", "GK"];
  const players = await Promise.all(
    playerSeeds.map((name, index) =>
      prisma.player.create({
        data: {
          name,
          nickname: name.split(" ")[0],
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
      location: "Arena Indoor Futsal",
      teamAName: "Chairman Team",
      teamBName: "Manager Team",
      teamAScore: 6,
      teamBScore: 7,
      winnerTeam: "Manager Team",
      chairmanTeamMvpId: byName["Choi Junseo"].id,
      managerTeamMvpId: byName["Yoon Taehyun"].id,
      memo: "Manager Team won after a late attacking run.",
      matchPlayers: {
        create: [
          { playerId: byName["Lee Hojoon"].id, teamName: "Chairman Team", result: result.loss, goals: 1, assists: 0 },
          { playerId: byName["Park Sangwoo"].id, teamName: "Chairman Team", result: result.loss, goals: 1, assists: 1 },
          { playerId: byName["Choi Junseo"].id, teamName: "Chairman Team", result: result.loss, goals: 2, assists: 0, isMvp: true },
          { playerId: byName["Jung Hyun"].id, teamName: "Chairman Team", result: result.loss, goals: 1, assists: 1 },
          { playerId: byName["Kang Sumin"].id, teamName: "Chairman Team", result: result.loss, goals: 1, assists: 0 },
          { playerId: byName["Kim Minjae"].id, teamName: "Manager Team", result: result.win, goals: 1, assists: 2 },
          { playerId: byName["Yoon Taehyun"].id, teamName: "Manager Team", result: result.win, goals: 4, assists: 0, isMvp: true },
          { playerId: byName["Han Jiwon"].id, teamName: "Manager Team", result: result.win, goals: 1, assists: 1 },
          { playerId: byName["Seo Dongmin"].id, teamName: "Manager Team", result: result.win, goals: 1, assists: 0 },
          { playerId: byName["Oh Seungjae"].id, teamName: "Manager Team", result: result.win, goals: 0, assists: 1 }
        ]
      },
      goals: {
        create: [
          { scorerId: byName["Lee Hojoon"].id, assisterId: byName["Park Sangwoo"].id, sequence: 1 },
          { scorerId: byName["Park Sangwoo"].id, sequence: 1 },
          { scorerId: byName["Choi Junseo"].id, assisterId: byName["Jung Hyun"].id, sequence: 1 },
          { scorerId: byName["Choi Junseo"].id, sequence: 2 },
          { scorerId: byName["Jung Hyun"].id, sequence: 1 },
          { scorerId: byName["Kang Sumin"].id, sequence: 1 },
          { scorerId: byName["Kim Minjae"].id, sequence: 1 },
          { scorerId: byName["Yoon Taehyun"].id, assisterId: byName["Kim Minjae"].id, sequence: 1 },
          { scorerId: byName["Yoon Taehyun"].id, assisterId: byName["Kim Minjae"].id, sequence: 2 },
          { scorerId: byName["Yoon Taehyun"].id, assisterId: byName["Han Jiwon"].id, sequence: 3 },
          { scorerId: byName["Yoon Taehyun"].id, assisterId: byName["Oh Seungjae"].id, sequence: 4 },
          { scorerId: byName["Han Jiwon"].id, sequence: 1 },
          { scorerId: byName["Seo Dongmin"].id, sequence: 1 }
        ]
      }
    }
  });

  await prisma.match.create({
    data: {
      matchDate: new Date("2026-05-08"),
      location: "Arena Indoor Futsal",
      teamAName: "Chairman Team",
      teamBName: "Manager Team",
      teamAScore: 5,
      teamBScore: 5,
      winnerTeam: null,
      chairmanTeamMvpId: byName["Lee Hojoon"].id,
      managerTeamMvpId: byName["Kim Minjae"].id,
      memo: "A balanced draw with chances for both sides.",
      matchPlayers: {
        create: [
          { playerId: byName["Lee Hojoon"].id, teamName: "Chairman Team", result: result.draw, goals: 1, assists: 1, isMvp: true },
          { playerId: byName["Park Sangwoo"].id, teamName: "Chairman Team", result: result.draw, goals: 1, assists: 0 },
          { playerId: byName["Choi Junseo"].id, teamName: "Chairman Team", result: result.draw, goals: 1, assists: 1 },
          { playerId: byName["Lim Gyumin"].id, teamName: "Chairman Team", result: result.draw, goals: 1, assists: 0 },
          { playerId: byName["Baek Dohyun"].id, teamName: "Chairman Team", result: result.draw, goals: 1, assists: 0 },
          { playerId: byName["Kim Minjae"].id, teamName: "Manager Team", result: result.draw, goals: 2, assists: 1, isMvp: true },
          { playerId: byName["Yoon Taehyun"].id, teamName: "Manager Team", result: result.draw, goals: 1, assists: 0 },
          { playerId: byName["Han Jiwon"].id, teamName: "Manager Team", result: result.draw, goals: 1, assists: 1 },
          { playerId: byName["Seo Dongmin"].id, teamName: "Manager Team", result: result.draw, goals: 1, assists: 0 },
          { playerId: byName["Oh Seungjae"].id, teamName: "Manager Team", result: result.draw, goals: 0, assists: 1 }
        ]
      },
      goals: {
        create: [
          { scorerId: byName["Lee Hojoon"].id, sequence: 1 },
          { scorerId: byName["Park Sangwoo"].id, assisterId: byName["Lee Hojoon"].id, sequence: 1 },
          { scorerId: byName["Choi Junseo"].id, sequence: 1 },
          { scorerId: byName["Lim Gyumin"].id, assisterId: byName["Choi Junseo"].id, sequence: 1 },
          { scorerId: byName["Baek Dohyun"].id, sequence: 1 },
          { scorerId: byName["Kim Minjae"].id, assisterId: byName["Han Jiwon"].id, sequence: 1 },
          { scorerId: byName["Kim Minjae"].id, sequence: 2 },
          { scorerId: byName["Yoon Taehyun"].id, assisterId: byName["Kim Minjae"].id, sequence: 1 },
          { scorerId: byName["Han Jiwon"].id, assisterId: byName["Oh Seungjae"].id, sequence: 1 },
          { scorerId: byName["Seo Dongmin"].id, sequence: 1 }
        ]
      }
    }
  });

  await prisma.match.create({
    data: {
      matchDate: new Date("2026-05-15"),
      location: "Arena Indoor Futsal",
      teamAName: "Chairman Team",
      teamBName: "Manager Team",
      teamAScore: 8,
      teamBScore: 6,
      winnerTeam: "Chairman Team",
      chairmanTeamMvpId: byName["Lee Hojoon"].id,
      managerTeamMvpId: byName["Han Jiwon"].id,
      memo: "Chairman Team protected an early lead through the final whistle.",
      matchPlayers: {
        create: [
          { playerId: byName["Lee Hojoon"].id, teamName: "Chairman Team", result: result.win, goals: 2, assists: 1, isMvp: true },
          { playerId: byName["Park Sangwoo"].id, teamName: "Chairman Team", result: result.win, goals: 1, assists: 1 },
          { playerId: byName["Choi Junseo"].id, teamName: "Chairman Team", result: result.win, goals: 2, assists: 0 },
          { playerId: byName["Jung Hyun"].id, teamName: "Chairman Team", result: result.win, goals: 2, assists: 1 },
          { playerId: byName["Lim Gyumin"].id, teamName: "Chairman Team", result: result.win, goals: 1, assists: 0 },
          { playerId: byName["Kim Minjae"].id, teamName: "Manager Team", result: result.loss, goals: 1, assists: 2 },
          { playerId: byName["Yoon Taehyun"].id, teamName: "Manager Team", result: result.loss, goals: 2, assists: 0 },
          { playerId: byName["Han Jiwon"].id, teamName: "Manager Team", result: result.loss, goals: 2, assists: 1, isMvp: true },
          { playerId: byName["Seo Dongmin"].id, teamName: "Manager Team", result: result.loss, goals: 1, assists: 0 },
          { playerId: byName["Baek Dohyun"].id, teamName: "Manager Team", result: result.loss, goals: 0, assists: 1 }
        ]
      },
      goals: {
        create: [
          { scorerId: byName["Lee Hojoon"].id, assisterId: byName["Park Sangwoo"].id, sequence: 1 },
          { scorerId: byName["Lee Hojoon"].id, sequence: 2 },
          { scorerId: byName["Park Sangwoo"].id, sequence: 1 },
          { scorerId: byName["Choi Junseo"].id, assisterId: byName["Lee Hojoon"].id, sequence: 1 },
          { scorerId: byName["Choi Junseo"].id, sequence: 2 },
          { scorerId: byName["Jung Hyun"].id, sequence: 1 },
          { scorerId: byName["Jung Hyun"].id, sequence: 2 },
          { scorerId: byName["Lim Gyumin"].id, assisterId: byName["Jung Hyun"].id, sequence: 1 },
          { scorerId: byName["Kim Minjae"].id, assisterId: byName["Han Jiwon"].id, sequence: 1 },
          { scorerId: byName["Yoon Taehyun"].id, assisterId: byName["Kim Minjae"].id, sequence: 1 },
          { scorerId: byName["Yoon Taehyun"].id, assisterId: byName["Kim Minjae"].id, sequence: 2 },
          { scorerId: byName["Han Jiwon"].id, assisterId: byName["Baek Dohyun"].id, sequence: 1 },
          { scorerId: byName["Han Jiwon"].id, sequence: 2 },
          { scorerId: byName["Seo Dongmin"].id, sequence: 1 }
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
