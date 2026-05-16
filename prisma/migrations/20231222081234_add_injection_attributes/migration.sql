-- CreateTable
CREATE TABLE "InjectionAttributes" (
    "id" SERIAL,
    "bodyPartId" INTEGER,
    "createdAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6),
    "contrastMinDose" INTEGER DEFAULT 0,
    "contrastMaxDose" INTEGER DEFAULT 0,
    "contrastMinFlowRate" INTEGER DEFAULT 0,
    "contrastMaxFlowRate" INTEGER DEFAULT 0,
    "salineMinDose" INTEGER DEFAULT 0,
    "salineMaxDose" INTEGER DEFAULT 0,
    "salineMinFlowRate" INTEGER DEFAULT 0,
    "salineMaxFlowRate" INTEGER DEFAULT 0,
    "minTime" INTEGER DEFAULT 0,
    "maxTime" INTEGER DEFAULT 0,

    CONSTRAINT "InjectionAttributes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "injection_attribute_body_part" ON "InjectionAttributes"("bodyPartId");

-- AddForeignKey
ALTER TABLE "InjectionAttributes" ADD CONSTRAINT "InjectionAttributes_bodyPartId_fkey" FOREIGN KEY ("bodyPartId") REFERENCES "BodyParts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
