-- DropForeignKey
ALTER TABLE "PatientPositions" DROP CONSTRAINT "PatientPositions_bodyPartId_fkey";

-- AddForeignKey
ALTER TABLE "PatientPositions" ADD CONSTRAINT "PatientPositions_bodyPartId_fkey" FOREIGN KEY ("bodyPartId") REFERENCES "BodyParts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
