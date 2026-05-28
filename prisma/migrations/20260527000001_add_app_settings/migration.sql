-- CreateTable: global key/value application settings (primary DB only).
CREATE TABLE IF NOT EXISTS "AppSettings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("key")
);
