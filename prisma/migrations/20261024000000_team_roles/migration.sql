-- Existing memberships were administrators. Preserve their permissions, while
-- new memberships default to ordinary members unless explicitly appointed.
ALTER TABLE "TeamAdmin" ADD COLUMN "role" VARCHAR(12) NOT NULL DEFAULT 'PRESIDENT';
ALTER TABLE "TeamAdmin" ALTER COLUMN "role" SET DEFAULT 'MEMBER';
ALTER TABLE "TeamAdmin" ADD CONSTRAINT "TeamAdmin_role_check"
  CHECK ("role" IN ('PRESIDENT', 'MEMBER'));
