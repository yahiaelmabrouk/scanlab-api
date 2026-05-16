/*
  Warnings:

  - You are about to drop the column `contrastRangePrest` on the `StackQuestionResults` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "StackQuestionResults" DROP COLUMN "contrastRangePrest";

-- AlterTable
ALTER TABLE "StackQuestions" ADD COLUMN     "contrastRangePrest" INTEGER;
