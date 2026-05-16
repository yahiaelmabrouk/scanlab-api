/*
  Warnings:

  - You are about to drop the column `questionGroupId` on the `PreparedExams` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "PreparedExams" DROP CONSTRAINT "PreparedExams_questionGroupId_fkey";

-- AlterTable
ALTER TABLE "PreparedExams" DROP COLUMN "questionGroupId",
ADD COLUMN     "postQuestionGroupId" INTEGER,
ADD COLUMN     "preQuestionGroupId" INTEGER;

-- AddForeignKey
ALTER TABLE "PreparedExams" ADD CONSTRAINT "PreparedExams_postQuestionGroupId_fkey" FOREIGN KEY ("postQuestionGroupId") REFERENCES "QuestionGroups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreparedExams" ADD CONSTRAINT "PreparedExams_preQuestionGroupId_fkey" FOREIGN KEY ("preQuestionGroupId") REFERENCES "QuestionGroups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
