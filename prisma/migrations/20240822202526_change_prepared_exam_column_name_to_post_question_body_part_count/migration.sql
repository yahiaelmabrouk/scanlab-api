/*
  Warnings:

  - You are about to drop the column `postQuestionBodyPartId` on the `PreparedExams` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PreparedExams" DROP COLUMN "postQuestionBodyPartId",
ADD COLUMN     "postQuestionBodyPartCount" INTEGER;
