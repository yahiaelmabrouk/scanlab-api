/*
  Warnings:

  - You are about to drop the column `badBeats` on the `PatientPhysios` table. All the data in the column will be lost.
  - You are about to drop the column `badBeatsDuration` on the `PatientPhysios` table. All the data in the column will be lost.
  - You are about to drop the column `cardiacCycleDeviation` on the `PatientPhysios` table. All the data in the column will be lost.
  - You are about to drop the column `cardiacCycleDuration` on the `PatientPhysios` table. All the data in the column will be lost.
  - You are about to drop the column `continuousECGData` on the `PatientPhysios` table. All the data in the column will be lost.
  - You are about to drop the column `respiratoryCybleDuration` on the `PatientPhysios` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PatientPhysios" DROP COLUMN "badBeats",
DROP COLUMN "badBeatsDuration",
DROP COLUMN "cardiacCycleDeviation",
DROP COLUMN "cardiacCycleDuration",
DROP COLUMN "continuousECGData",
DROP COLUMN "respiratoryCybleDuration",
ADD COLUMN     "respiratoryCycleDuration" INTEGER NOT NULL DEFAULT 500;

-- CreateTable
CREATE TABLE "PatientPhysioCardiacLevels" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6),
    "levelType" INTEGER NOT NULL DEFAULT 1,
    "cardiacCycleDuration" INTEGER NOT NULL DEFAULT 300,
    "cardiacCycleDeviation" INTEGER NOT NULL DEFAULT 0,
    "badBeats" INTEGER NOT NULL DEFAULT 1,
    "badBeatsDuration" JSONB DEFAULT '{"isRange":false,"min":400,"max":400}',
    "continuousECGData" JSONB DEFAULT '{"data":[],"waveWidth":0,"distanceFromTwoWave":0,"centerRToCenterT":0,"startPToCenterR":0,"centerTToEnd":0, "distanceFromSToT":0, "distanceFromPToQ":0}',
    "patientPhysioId" INTEGER,

    CONSTRAINT "PatientPhysioCardiacLevels_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PatientPhysioCardiacLevels" ADD CONSTRAINT "PatientPhysioCardiacLevels_patientPhysioId_fkey" FOREIGN KEY ("patientPhysioId") REFERENCES "PatientPhysios"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
