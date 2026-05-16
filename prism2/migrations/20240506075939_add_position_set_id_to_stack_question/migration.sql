-- AlterTable
ALTER TABLE "StackQuestions" ADD COLUMN     "positionSetId" INTEGER;

-- AddForeignKey
ALTER TABLE "StackQuestions" ADD CONSTRAINT "StackQuestions_positionSetId_fkey" FOREIGN KEY ("positionSetId") REFERENCES "PatientPositionSets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
