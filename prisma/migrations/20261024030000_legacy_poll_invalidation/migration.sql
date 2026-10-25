-- Additive: the database generates ballot IDs, so a running older build can
-- keep accepting votes before it is restarted.
ALTER TABLE "ClubPollGuestBallot" ADD COLUMN "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text;
CREATE UNIQUE INDEX "ClubPollGuestBallot_id_key" ON "ClubPollGuestBallot"("id");

CREATE TABLE "ClubPollInvalidBallot" (
  "id" TEXT NOT NULL,
  "pollId" TEXT NOT NULL,
  "name" VARCHAR(40) NOT NULL,
  "optionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "invalidatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClubPollInvalidBallot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ClubPollInvalidBallot_pollId_invalidatedAt_idx" ON "ClubPollInvalidBallot"("pollId", "invalidatedAt");
ALTER TABLE "ClubPollInvalidBallot" ADD CONSTRAINT "ClubPollInvalidBallot_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "ClubPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClubPollInvalidBallot" ADD CONSTRAINT "ClubPollInvalidBallot_pollId_optionId_fkey" FOREIGN KEY ("pollId", "optionId") REFERENCES "ClubPollOption"("pollId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
