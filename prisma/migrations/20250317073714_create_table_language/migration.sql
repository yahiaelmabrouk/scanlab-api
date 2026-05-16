-- CreateTable
CREATE TABLE "Languages" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6),
    "code" TEXT NOT NULL,
    "name" TEXT DEFAULT '',
    "content" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Languages_pkey" PRIMARY KEY ("id")
);
