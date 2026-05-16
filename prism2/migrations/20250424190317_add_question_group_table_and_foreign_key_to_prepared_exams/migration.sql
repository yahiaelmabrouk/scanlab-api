-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('pre', 'post');

-- AlterTable
ALTER TABLE "PreparedExams" ADD COLUMN     "questionGroupId" INTEGER;

-- CreateTable
CREATE TABLE "QuestionGroup" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "questionIds" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionGroup_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PreparedExams" ADD CONSTRAINT "PreparedExams_questionGroupId_fkey" FOREIGN KEY ("questionGroupId") REFERENCES "QuestionGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
