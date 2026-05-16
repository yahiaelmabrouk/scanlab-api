-- AlterTable
ALTER TABLE "BodyBoxes" ADD COLUMN     "modelId" INTEGER;

-- CreateTable
CREATE TABLE "Models" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Models_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BodyBoxes" ADD CONSTRAINT "BodyBoxes_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Models"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
