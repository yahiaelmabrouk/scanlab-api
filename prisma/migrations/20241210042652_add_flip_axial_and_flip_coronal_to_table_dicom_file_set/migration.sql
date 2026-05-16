-- AlterTable
ALTER TABLE "DicomFileSets" ADD COLUMN     "flipAxial" BOOLEAN DEFAULT true,
ADD COLUMN     "flipCoronal" BOOLEAN DEFAULT false;
