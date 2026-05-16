-- Default emailVerified to true on Users; backfill existing rows.
ALTER TABLE "Users" ALTER COLUMN "emailVerified" SET DEFAULT true;
UPDATE "Users" SET "emailVerified" = true WHERE "emailVerified" = false;

-- Default verified to true on UserPhones; backfill existing rows.
ALTER TABLE "UserPhones" ALTER COLUMN "verified" SET DEFAULT true;
UPDATE "UserPhones" SET "verified" = true WHERE "verified" = false;
