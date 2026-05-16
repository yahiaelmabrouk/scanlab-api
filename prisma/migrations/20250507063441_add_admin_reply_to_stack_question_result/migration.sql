-- AlterTable
ALTER TABLE "QuestionSetResults" ADD COLUMN     "isViewedAdminReply" BOOLEAN DEFAULT true;

-- AlterTable
ALTER TABLE "StackQuestionResults" ADD COLUMN     "adminRepliedUserId" INTEGER,
ADD COLUMN     "adminReply" TEXT DEFAULT '',
ADD COLUMN     "adminReplyCreatedAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "adminReplySeenAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isViewedAdminReply" BOOLEAN DEFAULT true;
