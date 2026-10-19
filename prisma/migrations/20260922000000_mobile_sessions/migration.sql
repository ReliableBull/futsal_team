CREATE TABLE "MobileSession" (
    "tokenHash" TEXT NOT NULL,
    "adminId" INTEGER NOT NULL,
    "passwordVersion" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MobileSession_pkey" PRIMARY KEY ("tokenHash")
);
CREATE INDEX "MobileSession_expiresAt_idx" ON "MobileSession"("expiresAt");
CREATE INDEX "MobileSession_adminId_idx" ON "MobileSession"("adminId");
ALTER TABLE "MobileSession" ADD CONSTRAINT "MobileSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
