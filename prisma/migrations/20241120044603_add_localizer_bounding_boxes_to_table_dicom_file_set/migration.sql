-- AlterTable
ALTER TABLE "DicomFileSets" ADD COLUMN     "localizerBoundingBoxes" JSONB DEFAULT '[]';
