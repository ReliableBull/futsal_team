ALTER TABLE "ClubPoll" ADD COLUMN "audience" VARCHAR(12) NOT NULL DEFAULT 'MEMBERS';
ALTER TABLE "ClubPoll" ADD CONSTRAINT "ClubPoll_audience_check" CHECK ("audience" IN ('MEMBERS', 'LEGACY'));

CREATE TABLE "ClubPollGuestBallot" (
  "pollId" TEXT NOT NULL,
  "nameKey" VARCHAR(40) NOT NULL,
  "name" VARCHAR(40) NOT NULL,
  "receiptHash" VARCHAR(64) NOT NULL,
  "optionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClubPollGuestBallot_pkey" PRIMARY KEY ("pollId", "nameKey")
);
CREATE UNIQUE INDEX "ClubPollGuestBallot_pollId_receiptHash_key" ON "ClubPollGuestBallot"("pollId", "receiptHash");
CREATE INDEX "ClubPollGuestBallot_pollId_optionId_idx" ON "ClubPollGuestBallot"("pollId", "optionId");
ALTER TABLE "ClubPollGuestBallot" ADD CONSTRAINT "ClubPollGuestBallot_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "ClubPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClubPollGuestBallot" ADD CONSTRAINT "ClubPollGuestBallot_pollId_optionId_fkey" FOREIGN KEY ("pollId", "optionId") REFERENCES "ClubPollOption"("pollId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
