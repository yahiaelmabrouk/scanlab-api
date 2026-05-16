/*
  Warnings:

  - The `scientificMode` column on the `UserInformations` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "UserInformations" DROP COLUMN "scientificMode",
ADD COLUMN     "scientificMode" JSONB;
