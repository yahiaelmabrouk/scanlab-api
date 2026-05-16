/*
  Warnings:

  - Made the column `bodyPartId` on table `InjectionAttributes` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdAt` on table `InjectionAttributes` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `InjectionAttributes` required. This step will fail if there are existing NULL values in that column.
  - Made the column `contrastMinDose` on table `InjectionAttributes` required. This step will fail if there are existing NULL values in that column.
  - Made the column `contrastMaxDose` on table `InjectionAttributes` required. This step will fail if there are existing NULL values in that column.
  - Made the column `contrastMinFlowRate` on table `InjectionAttributes` required. This step will fail if there are existing NULL values in that column.
  - Made the column `contrastMaxFlowRate` on table `InjectionAttributes` required. This step will fail if there are existing NULL values in that column.
  - Made the column `salineMinDose` on table `InjectionAttributes` required. This step will fail if there are existing NULL values in that column.
  - Made the column `salineMaxDose` on table `InjectionAttributes` required. This step will fail if there are existing NULL values in that column.
  - Made the column `salineMinFlowRate` on table `InjectionAttributes` required. This step will fail if there are existing NULL values in that column.
  - Made the column `salineMaxFlowRate` on table `InjectionAttributes` required. This step will fail if there are existing NULL values in that column.
  - Made the column `minTime` on table `InjectionAttributes` required. This step will fail if there are existing NULL values in that column.
  - Made the column `maxTime` on table `InjectionAttributes` required. This step will fail if there are existing NULL values in that column.

*/

-- AlterTable
ALTER TABLE "QuestionSets" ADD COLUMN     "isUltraLab" BOOLEAN NOT NULL DEFAULT false;
