-- Add email verification fields to Users table
ALTER TABLE "Users"
  ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "emailVerifyToken" VARCHAR(255),
  ADD COLUMN "emailVerifyTokenExpiresAt" TIMESTAMPTZ(6);

-- Index for fast token lookups during verification
CREATE INDEX "users_email_verify_token" ON "Users"("emailVerifyToken");
