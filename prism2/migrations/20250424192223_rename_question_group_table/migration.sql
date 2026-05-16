/*
  Warnings:

  - You are about to drop the `QuestionGroup` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "PreparedExams" DROP CONSTRAINT "PreparedExams_questionGroupId_fkey";

-- DropTable
DROP TABLE "QuestionGroup";

-- CreateTable
CREATE TABLE "QuestionGroups" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "questionIds" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionGroups_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PreparedExams" ADD CONSTRAINT "PreparedExams_questionGroupId_fkey" FOREIGN KEY ("questionGroupId") REFERENCES "QuestionGroups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
