-- Additive: older builds keep creating text-only options.
ALTER TABLE "ClubPollOption" ADD COLUMN "playerId" INTEGER;
ALTER TABLE "ClubPollOption" ADD COLUMN "detail" VARCHAR(200) NOT NULL DEFAULT '';
CREATE INDEX "ClubPollOption_playerId_idx" ON "ClubPollOption"("playerId");
ALTER TABLE "ClubPollOption" ADD CONSTRAINT "ClubPollOption_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
