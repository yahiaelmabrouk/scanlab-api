/*
  Warnings:

  - You are about to drop the `AnimatedVolumes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VolumeFrames` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey (if exists)
ALTER TABLE IF EXISTS "AnimatedVolumes" DROP CONSTRAINT IF EXISTS "AnimatedVolumes_bodyPartId_fkey";

-- DropForeignKey (if exists)
ALTER TABLE IF EXISTS "VolumeFrames" DROP CONSTRAINT IF EXISTS "VolumeFrames_animatedVolumeId_fkey";

-- AlterTable
ALTER TABLE "UserInformations" ADD COLUMN     "scientificMode" BOOLEAN;

-- AlterTable
ALTER TABLE "Users" ADD COLUMN     "scientificMode" BOOLEAN;

-- DropTable (if exists)
DROP TABLE IF EXISTS "AnimatedVolumes";

-- DropTable (if exists)
DROP TABLE IF EXISTS "VolumeFrames";

-- DropEnum (if exists)
DROP TYPE IF EXISTS "TissueType";
