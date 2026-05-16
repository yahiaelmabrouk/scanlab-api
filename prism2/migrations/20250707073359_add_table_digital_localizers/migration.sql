-- CreateTable
CREATE TABLE "DigitalLocalizers" (
    "id" SERIAL NOT NULL,
    "bodyPartId" INTEGER NOT NULL,
    "minStep" INTEGER NOT NULL DEFAULT 0,
    "maxStep" INTEGER NOT NULL DEFAULT 339,

    CONSTRAINT "DigitalLocalizers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DigitalLocalizers_bodyPartId_key" ON "DigitalLocalizers"("bodyPartId");

-- AddForeignKey
ALTER TABLE "DigitalLocalizers" ADD CONSTRAINT "DigitalLocalizers_bodyPartId_fkey" FOREIGN KEY ("bodyPartId") REFERENCES "BodyParts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
