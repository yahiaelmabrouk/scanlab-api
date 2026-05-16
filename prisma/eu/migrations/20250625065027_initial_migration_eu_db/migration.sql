-- CreateTable
CREATE TABLE "MultipleChoiceQuestionResults" (
    "id" SERIAL NOT NULL,
    "answer" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "userId" INTEGER NOT NULL,
    "multipleChoiceQuestionId" INTEGER NOT NULL,
    "testRunId" INTEGER,
    "score" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "MultipleChoiceQuestionResults_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "StackQuestionResults" (
    "id" SERIAL NOT NULL,
    "score" DECIMAL(5,2),
    "attemptedAnswerIdentifier" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "answer" JSON,
    "comment" TEXT DEFAULT '',
    "commentCreatedAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "commentedUserId" INTEGER,
    "commentSeenAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "isViewedAdminComment" BOOLEAN DEFAULT true,
    "reply" TEXT DEFAULT '',
    "replyCreatedAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "replySeenAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "isViewedUserReply" BOOLEAN DEFAULT true,
    "adminReply" TEXT DEFAULT '',
    "adminReplyCreatedAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "adminRepliedUserId" INTEGER,
    "adminReplySeenAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "isViewedAdminReply" BOOLEAN DEFAULT true,
    "questionSetResultId" INTEGER,
    "stackQuestionId" INTEGER,
    "skillScores" JSONB,
    "groupScoreVariables" JSONB,
    "sliceQuantScores" JSONB,
    "sliceViews" JSONB,
    "answerViews" JSONB,
    "skipped" BOOLEAN,
    "freebie" BOOLEAN,

    CONSTRAINT "StackQuestionResults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionSetResults" (
    "id" SERIAL NOT NULL,
    "score" DECIMAL(5,2),
    "sliceQuantScore" DECIMAL(5,2),
    "overallSkillScores" JSON,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "isViewedAdminComment" BOOLEAN DEFAULT true,
    "isViewedUserReply" BOOLEAN DEFAULT true,
    "isViewedAdminReply" BOOLEAN DEFAULT true,
    "userId" INTEGER NOT NULL,
    "questionSetId" INTEGER,
    "testRunId" INTEGER,
    "isChallengeMode" BOOLEAN,

    CONSTRAINT "QuestionSetResults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestRuns" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "questions" JSON,
    "answers" JSON,
    "secondsActive" INTEGER,
    "timeStarted" TIMESTAMPTZ(6),
    "timeEnded" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "score" DECIMAL(5,2),
    "patientPrepScore" DECIMAL(5,2),
    "patientPrepScores" JSON,
    "questionSetScore" DECIMAL(5,2),
    "isSandbox" BOOLEAN NOT NULL DEFAULT false,
    "preparedExamId" INTEGER,
    "bodyPartId" INTEGER,
    "softwareVendor" VARCHAR(255),
    "softwareVersion" VARCHAR(255),

    CONSTRAINT "TestRuns_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MultipleChoiceQuestionResults" ADD CONSTRAINT "MultipleChoiceQuestionResults_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRuns"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "StackQuestionResultComments" ADD CONSTRAINT "StackQuestionResultComments_stackQuestionResultId_fkey" FOREIGN KEY ("stackQuestionResultId") REFERENCES "StackQuestionResults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StackQuestionResults" ADD CONSTRAINT "StackQuestionResults_questionSetResultId_fkey" FOREIGN KEY ("questionSetResultId") REFERENCES "QuestionSetResults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSetResults" ADD CONSTRAINT "QuestionSetResults_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRuns"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
