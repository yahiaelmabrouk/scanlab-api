-- CreateTable
CREATE TABLE "QuestionMiscDocuments" (
    "id" SERIAL NOT NULL,
    "alt" VARCHAR(255),
    "pathKey" VARCHAR(255),
    "filename" VARCHAR(255),
    "type" VARCHAR(255),
    "multipleChoiceQuestionId" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "QuestionMiscDocuments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "QuestionMiscDocuments" ADD CONSTRAINT "QuestionMiscDocuments_multipleChoiceQuestionId_fkey" FOREIGN KEY ("multipleChoiceQuestionId") REFERENCES "MultipleChoiceQuestions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
