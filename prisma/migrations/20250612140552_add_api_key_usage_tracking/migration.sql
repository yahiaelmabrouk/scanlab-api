-- CreateTable
CREATE TABLE "ApiKeyUsage" (
    "id" SERIAL NOT NULL,
    "apiKeyId" INTEGER NOT NULL,
    "endpoint" VARCHAR(500) NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,

    CONSTRAINT "ApiKeyUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "api_key_usage_api_key_id" ON "ApiKeyUsage"("apiKeyId");

-- CreateIndex
CREATE INDEX "api_key_usage_timestamp" ON "ApiKeyUsage"("timestamp");

-- AddForeignKey
ALTER TABLE "ApiKeyUsage" ADD CONSTRAINT "ApiKeyUsage_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKeys"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
