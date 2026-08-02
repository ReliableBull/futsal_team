-- Store each goal separately so scorer-assister relationships can be queried.
CREATE TABLE "MatchGoal" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "scorerId" INTEGER NOT NULL,
    "assisterId" INTEGER,
    "sequence" INTEGER NOT NULL,
    "assistKnown" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchGoal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MatchGoal_matchId_scorerId_sequence_key"
ON "MatchGoal"("matchId", "scorerId", "sequence");

CREATE INDEX "MatchGoal_assisterId_idx" ON "MatchGoal"("assisterId");

ALTER TABLE "MatchGoal"
ADD CONSTRAINT "MatchGoal_matchId_fkey"
FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatchGoal"
ADD CONSTRAINT "MatchGoal_scorerId_fkey"
FOREIGN KEY ("scorerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MatchGoal"
ADD CONSTRAINT "MatchGoal_assisterId_fkey"
FOREIGN KEY ("assisterId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing aggregate records cannot reveal the original assister. Preserve each
-- goal and mark its assist relationship as unknown instead of inventing data.
INSERT INTO "MatchGoal" (
    "matchId",
    "scorerId",
    "assisterId",
    "sequence",
    "assistKnown",
    "createdAt",
    "updatedAt"
)
SELECT
    mp."matchId",
    mp."playerId",
    NULL,
    goal_number,
    false,
    mp."createdAt",
    CURRENT_TIMESTAMP
FROM "MatchPlayer" mp
CROSS JOIN LATERAL generate_series(1, mp."goals") AS goal_number
WHERE mp."goals" > 0;
