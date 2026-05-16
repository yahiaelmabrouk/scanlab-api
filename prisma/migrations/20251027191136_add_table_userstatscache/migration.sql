-- CreateTable
CREATE TABLE "UserStatsCaches" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "cacheType" TEXT NOT NULL,
    "includeChallengeMode" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB NOT NULL,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsed" TIMESTAMP(3),

    CONSTRAINT "UserStatsCaches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserStatsCaches_lastUsed_idx" ON "UserStatsCaches"("lastUsed");

-- CreateIndex
CREATE UNIQUE INDEX "UserStatsCaches_userId_cacheType_includeChallengeMode_key" ON "UserStatsCaches"("userId", "cacheType", "includeChallengeMode");
