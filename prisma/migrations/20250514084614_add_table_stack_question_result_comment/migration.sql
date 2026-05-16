-- CreateTable
CREATE TABLE "StackQuestionResultComments" (
    "id" SERIAL NOT NULL,
    "comment" TEXT DEFAULT '',
    "seen" BOOLEAN DEFAULT true,
    "seenAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastedUpdatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "commentedUserId" INTEGER,
    "viewedUserId" INTEGER,
    "stackQuestionResultId" INTEGER NOT NULL,

    CONSTRAINT "StackQuestionResultComments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "StackQuestionResultComments" ADD CONSTRAINT "StackQuestionResultComments_viewedUserId_fkey" FOREIGN KEY ("viewedUserId") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StackQuestionResultComments" ADD CONSTRAINT "StackQuestionResultComments_commentedUserId_fkey" FOREIGN KEY ("commentedUserId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StackQuestionResultComments" ADD CONSTRAINT "StackQuestionResultComments_stackQuestionResultId_fkey" FOREIGN KEY ("stackQuestionResultId") REFERENCES "StackQuestionResults"("id") ON DELETE CASCADE ON UPDATE CASCADE;
