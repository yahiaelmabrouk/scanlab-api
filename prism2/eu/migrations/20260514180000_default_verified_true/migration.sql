-- Default verified to true on UserPhones; backfill existing rows.
ALTER TABLE "UserPhones" ALTER COLUMN "verified" SET DEFAULT true;
UPDATE "UserPhones" SET "verified" = true WHERE "verified" = false;
