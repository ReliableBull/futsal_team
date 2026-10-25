CREATE TABLE "ClubPoll" (
  "id" TEXT PRIMARY KEY,
  "teamId" INTEGER NOT NULL REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "creatorId" INTEGER REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "title" VARCHAR(120) NOT NULL,
  "description" VARCHAR(2000) NOT NULL DEFAULT '',
  "closesAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ClubPoll_teamId_createdAt_idx" ON "ClubPoll"("teamId", "createdAt");

CREATE TABLE "ClubPollOption" (
  "id" TEXT PRIMARY KEY,
  "pollId" TEXT NOT NULL REFERENCES "ClubPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "label" VARCHAR(120) NOT NULL,
  "position" INTEGER NOT NULL
);
CREATE UNIQUE INDEX "ClubPollOption_pollId_id_key" ON "ClubPollOption"("pollId", "id");
CREATE UNIQUE INDEX "ClubPollOption_pollId_position_key" ON "ClubPollOption"("pollId", "position");

CREATE TABLE "ClubPollBallot" (
  "pollId" TEXT NOT NULL REFERENCES "ClubPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "voterId" INTEGER NOT NULL REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "optionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("pollId", "voterId"),
  FOREIGN KEY ("pollId", "optionId") REFERENCES "ClubPollOption"("pollId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ClubPollBallot_pollId_optionId_idx" ON "ClubPollBallot"("pollId", "optionId");
CREATE INDEX "ClubPollBallot_voterId_idx" ON "ClubPollBallot"("voterId");
