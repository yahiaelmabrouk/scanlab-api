/*
  Warnings:

  - The `skillScores` column on the `StackQuestionResults` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "StackQuestionResults" DROP COLUMN "skillScores",
ADD COLUMN     "skillScores" JSONB;
