-- AlterTable
ALTER TABLE "QuestionSetResults" ADD COLUMN     "isViewedUserReply" BOOLEAN DEFAULT true;

-- AlterTable
ALTER TABLE "StackQuestionResults" ADD COLUMN     "isViewedUserReply" BOOLEAN DEFAULT true,
ADD COLUMN     "repliedUserId" INTEGER,
ADD COLUMN     "reply" TEXT DEFAULT '',
ADD COLUMN     "replyCreatedAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "replySeenAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP;
