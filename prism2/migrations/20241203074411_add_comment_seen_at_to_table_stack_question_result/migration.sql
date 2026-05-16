-- AlterTable
ALTER TABLE "StackQuestionResults" ADD COLUMN     "commentSeenAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isViewedAdminComment" BOOLEAN DEFAULT true;
