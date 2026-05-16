/*
  Warnings:

  - You are about to drop the column `questionSetId` on the `QuestionProbes` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "QuestionProbes" DROP CONSTRAINT "QuestionProbes_questionSetId_fkey";

-- AlterTable
ALTER TABLE "QuestionProbes" DROP COLUMN "questionSetId",
ADD COLUMN     "bodyPartId" INTEGER NOT NULL DEFAULT 1;

-- AddForeignKey
ALTER TABLE "QuestionProbes" ADD CONSTRAINT "QuestionProbes_bodyPartId_fkey" FOREIGN KEY ("bodyPartId") REFERENCES "BodyParts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
