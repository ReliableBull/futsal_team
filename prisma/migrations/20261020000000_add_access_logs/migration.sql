CREATE TABLE "AccessLog" (
    "id" SERIAL NOT NULL,
    "ip" VARCHAR(45) NOT NULL,
    "path" VARCHAR(512) NOT NULL,
    "referrer" VARCHAR(512),
    "userAgent" VARCHAR(512),
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccessLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccessLog_createdAt_idx" ON "AccessLog"("createdAt");
CREATE INDEX "AccessLog_ip_createdAt_idx" ON "AccessLog"("ip", "createdAt");
