-- CreateTable
CREATE TABLE "WeightBasedDoses" (
    "id" SERIAL NOT NULL,
    "weightMetric" DOUBLE PRECISION NOT NULL,
    "contrastDose" DOUBLE PRECISION NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "WeightBasedDoses_pkey" PRIMARY KEY ("id")
);
