-- AlterTable
ALTER TABLE "DicomFileSets" ADD COLUMN     "scanBoundingBoxes" JSONB DEFAULT '[]';
