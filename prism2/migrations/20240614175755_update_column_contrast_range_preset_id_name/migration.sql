/*
  Warnings:

  - You are about to drop the column `contrastRangePrest` on the `StackQuestions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "StackQuestions" DROP COLUMN "contrastRangePrest",
ADD COLUMN     "contrastRangePresetId" INTEGER;
