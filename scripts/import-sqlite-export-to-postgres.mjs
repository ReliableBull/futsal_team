import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";

const prisma = new PrismaClient();
const exportPath = process.argv[2] ?? "/private/tmp/futsal-sqlite-export.json";
const dateKeys = ["createdAt", "updatedAt", "matchDate"];

function reviveDates(record) {
  for (const key of dateKeys) {
    if (record[key]) {
      record[key] = new Date(record[key]);
    }
  }

  return record;
}

async function resetSequence(table) {
  const [{ max }] = await prisma.$queryRawUnsafe(`SELECT COALESCE(MAX(id), 1) AS max FROM "${table}"`);
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), ${Number(max)}, true)`);
}

async function main() {
  const data = JSON.parse(await readFile(exportPath, "utf8"));

  await prisma.matchPlayer.deleteMany();
  await prisma.match.deleteMany();
  await prisma.player.deleteMany();
  await prisma.admin.deleteMany();

  for (const admin of data.admins) {
    await prisma.admin.create({ data: reviveDates({ ...admin }) });
  }

  for (const player of data.players) {
    await prisma.player.create({ data: reviveDates({ ...player }) });
  }

  for (const match of data.matches) {
    const { matchPlayers, ...matchData } = match;

    await prisma.match.create({
      data: {
        ...reviveDates(matchData),
        matchPlayers: {
          create: matchPlayers.map(({ matchId, ...record }) => reviveDates({ ...record }))
        }
      }
    });
  }

  for (const table of ["Admin", "Player", "Match", "MatchPlayer"]) {
    await resetSequence(table);
  }

  const counts = {
    admins: await prisma.admin.count(),
    players: await prisma.player.count(),
    matches: await prisma.match.count(),
    matchPlayers: await prisma.matchPlayer.count()
  };

  console.log(`Imported ${counts.admins} admins, ${counts.players} players, ${counts.matches} matches, ${counts.matchPlayers} match-player records.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
