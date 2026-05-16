-- AlterTable
ALTER TABLE "PatientPositions" ADD COLUMN     "positionSetId" INTEGER;

-- CreateTable
CREATE TABLE "PatientPositionSets" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "bodyPartId" INTEGER,

    CONSTRAINT "PatientPositionSets_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PatientPositions" ADD CONSTRAINT "PatientPositions_positionSetId_fkey" FOREIGN KEY ("positionSetId") REFERENCES "PatientPositionSets"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PatientPositionSets" ADD CONSTRAINT "PatientPositionSets_bodyPartId_fkey" FOREIGN KEY ("bodyPartId") REFERENCES "BodyParts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
