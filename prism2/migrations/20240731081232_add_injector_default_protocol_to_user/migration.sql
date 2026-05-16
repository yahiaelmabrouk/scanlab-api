-- AlterTable
ALTER TABLE "Users" ADD COLUMN     "defaultContrastAndSalineProtocol" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "defaultContrastOnlyProtocol" INTEGER NOT NULL DEFAULT 2;
