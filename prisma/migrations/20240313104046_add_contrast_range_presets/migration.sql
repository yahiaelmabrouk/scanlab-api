-- CreateTable
CREATE TABLE "ContrastRangePresets" (
    "id" SERIAL NOT NULL,
    "weighting" TEXT NOT NULL,
    "magPrep" TEXT NOT NULL,
    "sequence" TEXT NOT NULL,
    "bodyPartId" INTEGER NOT NULL,
    "ranges" JSONB NOT NULL,

    CONSTRAINT "ContrastRangePresets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contrast_range_preset_body_part" ON "ContrastRangePresets"("bodyPartId");

-- AddForeignKey
ALTER TABLE "ContrastRangePresets" ADD CONSTRAINT "ContrastRangePresets_bodyPartId_fkey" FOREIGN KEY ("bodyPartId") REFERENCES "BodyParts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
