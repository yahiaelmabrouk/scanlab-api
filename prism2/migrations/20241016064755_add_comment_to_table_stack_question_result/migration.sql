-- AlterTable
ALTER TABLE "StackQuestionResults" ADD COLUMN     "comment" TEXT DEFAULT '',
ADD COLUMN     "commentCreatedAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "commentedUserId" INTEGER;

-- AddForeignKey
ALTER TABLE "StackQuestionResults" ADD CONSTRAINT "StackQuestionResults_commentedUserId_fkey" FOREIGN KEY ("commentedUserId") REFERENCES "Users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
