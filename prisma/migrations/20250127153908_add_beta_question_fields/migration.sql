-- AlterTable
ALTER TABLE "MultipleChoiceQuestions" ADD COLUMN     "betaQuestionAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isBetaQuestion" BOOLEAN NOT NULL DEFAULT false;
