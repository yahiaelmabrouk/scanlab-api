-- DropForeignKey
ALTER TABLE "QuestionMiscDocuments" DROP CONSTRAINT "QuestionMiscDocuments_multipleChoiceQuestionId_fkey";

-- AddForeignKey
ALTER TABLE "QuestionMiscDocuments" ADD CONSTRAINT "QuestionMiscDocuments_multipleChoiceQuestionId_fkey" FOREIGN KEY ("multipleChoiceQuestionId") REFERENCES "MultipleChoiceQuestions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
