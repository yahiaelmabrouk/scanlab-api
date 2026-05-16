/*
  Warnings:

  - You are about to drop the `ApiKeyPermissions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ApiKeyPermissions" DROP CONSTRAINT "ApiKeyPermissions_apiKeyId_fkey";

-- DropForeignKey
ALTER TABLE "ApiKeyPermissions" DROP CONSTRAINT "ApiKeyPermissions_endpointId_fkey";

-- DropTable
DROP TABLE "ApiKeyPermissions";

-- CreateTable
CREATE TABLE "CohortEndpointPermissions" (
    "id" SERIAL NOT NULL,
    "cohortId" INTEGER NOT NULL,
    "endpointId" INTEGER NOT NULL,
    "isAllowed" BOOLEAN NOT NULL DEFAULT true,
    "maxRequestsPerHour" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "CohortEndpointPermissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cohort_endpoint_permissions_cohort_id" ON "CohortEndpointPermissions"("cohortId");

-- CreateIndex
CREATE INDEX "cohort_endpoint_permissions_endpoint_id" ON "CohortEndpointPermissions"("endpointId");

-- CreateIndex
CREATE UNIQUE INDEX "CohortEndpointPermissions_cohortId_endpointId_key" ON "CohortEndpointPermissions"("cohortId", "endpointId");

-- AddForeignKey
ALTER TABLE "CohortEndpointPermissions" ADD CONSTRAINT "CohortEndpointPermissions_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohorts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CohortEndpointPermissions" ADD CONSTRAINT "CohortEndpointPermissions_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "Endpoints"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
