/*
  Warnings:

  - You are about to drop the column `category` on the `Resources` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Resources" DROP COLUMN "category",
ADD COLUMN     "categoryId" INTEGER;

-- CreateTable
CREATE TABLE "ResourceCategories" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6),
    "name" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ResourceCategories_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Resources" ADD CONSTRAINT "Resources_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ResourceCategories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
