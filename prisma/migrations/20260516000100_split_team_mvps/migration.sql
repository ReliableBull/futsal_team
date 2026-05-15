-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Match" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "matchDate" DATETIME NOT NULL,
    "location" TEXT NOT NULL,
    "teamAName" TEXT NOT NULL,
    "teamBName" TEXT NOT NULL,
    "teamAScore" INTEGER NOT NULL,
    "teamBScore" INTEGER NOT NULL,
    "winnerTeam" TEXT,
    "chairmanTeamMvpId" INTEGER,
    "managerTeamMvpId" INTEGER,
    "memo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Match_chairmanTeamMvpId_fkey" FOREIGN KEY ("chairmanTeamMvpId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Match_managerTeamMvpId_fkey" FOREIGN KEY ("managerTeamMvpId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Match" (
    "createdAt",
    "id",
    "location",
    "matchDate",
    "memo",
    "teamAName",
    "teamAScore",
    "teamBName",
    "teamBScore",
    "updatedAt",
    "winnerTeam",
    "chairmanTeamMvpId",
    "managerTeamMvpId"
)
SELECT
    "createdAt",
    "id",
    "location",
    "matchDate",
    "memo",
    "teamAName",
    "teamAScore",
    "teamBName",
    "teamBScore",
    "updatedAt",
    "winnerTeam",
    CASE
        WHEN EXISTS (
            SELECT 1 FROM "MatchPlayer"
            WHERE "MatchPlayer"."matchId" = "Match"."id"
              AND "MatchPlayer"."playerId" = "Match"."mvpPlayerId"
              AND "MatchPlayer"."teamName" = "Match"."teamAName"
        )
        THEN "mvpPlayerId"
        ELSE NULL
    END,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM "MatchPlayer"
            WHERE "MatchPlayer"."matchId" = "Match"."id"
              AND "MatchPlayer"."playerId" = "Match"."mvpPlayerId"
              AND "MatchPlayer"."teamName" = "Match"."teamBName"
        )
        THEN "mvpPlayerId"
        ELSE NULL
    END
FROM "Match";
DROP TABLE "Match";
ALTER TABLE "new_Match" RENAME TO "Match";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
