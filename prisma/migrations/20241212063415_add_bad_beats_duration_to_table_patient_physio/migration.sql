-- AlterTable
ALTER TABLE "PatientPhysios" ADD COLUMN     "badBeatsDuration" JSONB NOT NULL DEFAULT '{"isRange":false,"min":400,"max":400}';
