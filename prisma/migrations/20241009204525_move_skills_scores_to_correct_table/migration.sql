/*
  Warnings:

  - You are about to drop the column `skillScores` on the `QuestionSetResults` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "QuestionSetResults" DROP COLUMN "skillScores";

-- AlterTable
ALTER TABLE "StackQuestionResults" ADD COLUMN     "skillScores" DECIMAL(5,2);
