-- CreateTable
CREATE TABLE "CohortAverageCache" (
    "id" SERIAL NOT NULL,
    "cohortId" INTEGER NOT NULL,
    "angleAverage" DOUBLE PRECISION,
    "wastedSlicesAverage" DOUBLE PRECISION,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortAverageCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CohortAverageCache_cohortId_key" ON "CohortAverageCache"("cohortId");
