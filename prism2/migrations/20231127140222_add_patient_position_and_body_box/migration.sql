-- CreateTable
CREATE TABLE "BodyBoxes" (
    "id" SERIAL NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "z" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "length" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "bodyPartId" INTEGER NOT NULL,
    "patientPositionId" INTEGER NOT NULL,

    CONSTRAINT "BodyBoxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientPositions" (
    "id" SERIAL NOT NULL,
    "value" JSON NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "bodyPartId" INTEGER NOT NULL,

    CONSTRAINT "PatientPositions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patient_position_body_part_id" ON "PatientPositions"("bodyPartId");

-- AddForeignKey
ALTER TABLE "BodyBoxes" ADD CONSTRAINT "BodyBoxes_patientPositionId_fkey" FOREIGN KEY ("patientPositionId") REFERENCES "PatientPositions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PatientPositions" ADD CONSTRAINT "PatientPositions_bodyPartId_fkey" FOREIGN KEY ("bodyPartId") REFERENCES "BodyParts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
