-- CreateTable
CREATE TABLE "PatientPhysios" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6),
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL DEFAULT 20,
    "cardiacCycleDuration" INTEGER NOT NULL DEFAULT 300,
    "cardiacCycleDeviation" INTEGER NOT NULL DEFAULT 0,
    "badBeats" INTEGER NOT NULL DEFAULT 1,
    "respiratoryCybleDuration" INTEGER NOT NULL DEFAULT 500,
    "breathHoldDuration" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PatientPhysios_pkey" PRIMARY KEY ("id")
);
