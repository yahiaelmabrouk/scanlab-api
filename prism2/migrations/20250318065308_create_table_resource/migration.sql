-- CreateTable
CREATE TABLE "Resources" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6),
    "title" TEXT NOT NULL,
    "description" TEXT DEFAULT '',
    "url" TEXT DEFAULT '{}',
    "path" TEXT DEFAULT '{}',
    "category" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Resources_pkey" PRIMARY KEY ("id")
);
