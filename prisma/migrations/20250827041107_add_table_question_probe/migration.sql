-- CreateTable
CREATE TABLE "QuestionProbes" (
    "id" SERIAL NOT NULL,
    "questionSetId" INTEGER NOT NULL,
    "scanDirection" INTEGER NOT NULL DEFAULT 1,
    "visibleProbes" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "QuestionProbes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "QuestionProbes" ADD CONSTRAINT "QuestionProbes_questionSetId_fkey" FOREIGN KEY ("questionSetId") REFERENCES "QuestionSets"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
