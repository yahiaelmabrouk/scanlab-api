-- CreateTable
CREATE TABLE "ApiKeys" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "keyPrefix" VARCHAR(10) NOT NULL,
    "keyHash" VARCHAR(255) NOT NULL,
    "cohortId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMPTZ(6),
    "lastUsedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ApiKeys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiKeys_keyPrefix_key" ON "ApiKeys"("keyPrefix");

-- CreateIndex
CREATE INDEX "api_keys_cohort_id" ON "ApiKeys"("cohortId");

-- CreateIndex
CREATE INDEX "api_keys_key_prefix" ON "ApiKeys"("keyPrefix");

-- AddForeignKey
ALTER TABLE "ApiKeys" ADD CONSTRAINT "ApiKeys_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohorts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
