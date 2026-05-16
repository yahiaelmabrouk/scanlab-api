/*
  Warnings:

  - You are about to drop the column `isCTLab` on the `StackQuestions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "StackQuestions" DROP COLUMN "isCTLab",
ADD COLUMN     "postContrast" BOOLEAN DEFAULT false;
