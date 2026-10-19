CREATE TABLE "MomBallot" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "voterHash" VARCHAR(64) NOT NULL,
    "teamAPlayerId" INTEGER,
    "teamBPlayerId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MomBallot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MomBallot_matchId_voterHash_key" ON "MomBallot"("matchId", "voterHash");
ALTER TABLE "MomBallot" ADD CONSTRAINT "MomBallot_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MomBallot" ADD CONSTRAINT "MomBallot_teamAPlayerId_fkey" FOREIGN KEY ("teamAPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MomBallot" ADD CONSTRAINT "MomBallot_teamBPlayerId_fkey" FOREIGN KEY ("teamBPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
