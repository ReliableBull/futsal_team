-- CreateTable
CREATE TABLE "MatchPoster" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchPoster_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MatchPoster" ADD CONSTRAINT "MatchPoster_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
