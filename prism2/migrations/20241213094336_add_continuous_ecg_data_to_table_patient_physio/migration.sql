-- AlterTable
ALTER TABLE "PatientPhysios" ADD COLUMN     "continuousECGData" JSONB DEFAULT '{"data":[],"waveWidth":0,"distanceFromTwoWave":0,"centerRToCenterT":0,"startPToCenterR":0,"centerTToEnd":0}';
