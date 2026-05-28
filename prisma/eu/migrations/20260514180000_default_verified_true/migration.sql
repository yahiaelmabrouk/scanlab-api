-- Default verified to true on UserPhones; backfill existing rows.
-- (EU has no Users table — emailVerified half of the primary migration is N/A here.)
ALTER TABLE "UserPhones" ALTER COLUMN "verified" SET DEFAULT true;
UPDATE "UserPhones" SET "verified" = true WHERE "verified" = false;
