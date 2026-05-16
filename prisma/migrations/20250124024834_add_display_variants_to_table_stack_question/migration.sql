-- AlterTable
ALTER TABLE "StackQuestions" ADD COLUMN     "displayVariantSelectionId" TEXT,
ADD COLUMN     "displayVariants" JSONB DEFAULT '[]';
