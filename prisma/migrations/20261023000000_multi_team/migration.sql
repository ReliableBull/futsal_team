-- Additive migration: every existing record and administrator stays with ARENA FC.
CREATE TABLE "Team" (
  "id" SERIAL NOT NULL,
  "slug" VARCHAR(48) NOT NULL,
  "name" VARCHAR(60) NOT NULL,
  "description" VARCHAR(300) NOT NULL DEFAULT '',
  "region" VARCHAR(60) NOT NULL DEFAULT '',
  "color" VARCHAR(7) NOT NULL DEFAULT '#e53935',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Team_slug_key" ON "Team"("slug");
INSERT INTO "Team" ("id", "slug", "name", "description", "region", "updatedAt")
VALUES (1, 'arena-fc', 'ARENA FC', '함께 뛰는 시간, 하나가 되는 ARENA FC', '대구', CURRENT_TIMESTAMP);
SELECT setval(pg_get_serial_sequence('"Team"', 'id'), 1);

CREATE TABLE "TeamAdmin" (
  "teamId" INTEGER NOT NULL,
  "adminId" INTEGER NOT NULL,
  CONSTRAINT "TeamAdmin_pkey" PRIMARY KEY ("teamId", "adminId"),
  CONSTRAINT "TeamAdmin_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TeamAdmin_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TeamAdmin_adminId_idx" ON "TeamAdmin"("adminId");
INSERT INTO "TeamAdmin" ("teamId", "adminId") SELECT 1, "id" FROM "Admin";

ALTER TABLE "Player" ADD COLUMN "teamId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Match" ADD COLUMN "teamId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "AccessLog" ADD COLUMN "teamId" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX "Player_teamId_idx" ON "Player"("teamId");
CREATE INDEX "Match_teamId_matchDate_idx" ON "Match"("teamId", "matchDate");
CREATE INDEX "AccessLog_teamId_createdAt_idx" ON "AccessLog"("teamId", "createdAt");
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Match" ADD CONSTRAINT "Match_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
