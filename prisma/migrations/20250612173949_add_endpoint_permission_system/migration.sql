-- CreateTable
CREATE TABLE "Endpoints" (
    "id" SERIAL NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "pathPattern" VARCHAR(500) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "service" VARCHAR(100),
    "version" VARCHAR(20) NOT NULL DEFAULT 'v1',
    "requiresAuth" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKeyPermissions" (
    "id" SERIAL NOT NULL,
    "apiKeyId" INTEGER NOT NULL,
    "endpointId" INTEGER NOT NULL,
    "isAllowed" BOOLEAN NOT NULL DEFAULT true,
    "maxRequestsPerHour" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ApiKeyPermissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EndpointAccessAttempts" (
    "id" SERIAL NOT NULL,
    "apiKeyId" INTEGER,
    "endpointId" INTEGER,
    "method" VARCHAR(10) NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "isAllowed" BOOLEAN NOT NULL,
    "denyReason" VARCHAR(255),
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "requestDuration" INTEGER,

    CONSTRAINT "EndpointAccessAttempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "endpoints_service" ON "Endpoints"("service");

-- CreateIndex
CREATE INDEX "endpoints_path_pattern" ON "Endpoints"("pathPattern");

-- CreateIndex
CREATE UNIQUE INDEX "Endpoints_method_pathPattern_version_key" ON "Endpoints"("method", "pathPattern", "version");

-- CreateIndex
CREATE INDEX "api_key_permissions_api_key_id" ON "ApiKeyPermissions"("apiKeyId");

-- CreateIndex
CREATE INDEX "api_key_permissions_endpoint_id" ON "ApiKeyPermissions"("endpointId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKeyPermissions_apiKeyId_endpointId_key" ON "ApiKeyPermissions"("apiKeyId", "endpointId");

-- CreateIndex
CREATE INDEX "endpoint_access_attempts_api_key_id" ON "EndpointAccessAttempts"("apiKeyId");

-- CreateIndex
CREATE INDEX "endpoint_access_attempts_endpoint_id" ON "EndpointAccessAttempts"("endpointId");

-- CreateIndex
CREATE INDEX "endpoint_access_attempts_timestamp" ON "EndpointAccessAttempts"("timestamp");

-- CreateIndex
CREATE INDEX "endpoint_access_attempts_status" ON "EndpointAccessAttempts"("statusCode", "isAllowed");

-- AddForeignKey
ALTER TABLE "ApiKeyPermissions" ADD CONSTRAINT "ApiKeyPermissions_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKeys"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ApiKeyPermissions" ADD CONSTRAINT "ApiKeyPermissions_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "Endpoints"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "EndpointAccessAttempts" ADD CONSTRAINT "EndpointAccessAttempts_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKeys"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "EndpointAccessAttempts" ADD CONSTRAINT "EndpointAccessAttempts_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "Endpoints"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
