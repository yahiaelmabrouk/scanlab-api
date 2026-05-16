-- AlterTable
ALTER TABLE "PreparedExams" ADD COLUMN "patientPhysioId" INTEGER;

-- AddForeignKey
ALTER TABLE "PreparedExams" ADD CONSTRAINT "PreparedExams_patientPhysioId_fkey" FOREIGN KEY ("patientPhysioId") REFERENCES "PatientPhysios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
