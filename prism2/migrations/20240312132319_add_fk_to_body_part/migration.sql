-- AddForeignKey
ALTER TABLE "BodyParts" ADD CONSTRAINT "BodyParts_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "BodyParts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
