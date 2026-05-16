-- CreateTable
CREATE TABLE "UserInformations" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "vendorStylePreference" VARCHAR(255),
    "fieldStrengthPreference" VARCHAR(255),
    "defaultLanguageCode" TEXT DEFAULT 'en',
    "softwareVendorPreference" VARCHAR(255),
    "softwareVersionPreference" VARCHAR(255),
    "isAdmin" BOOLEAN,
    "passHash" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "legalName" VARCHAR(255) NOT NULL,
    "nickName" VARCHAR(255),
    "language" VARCHAR(255),
    "lastIP" VARCHAR(255),
    "minJWTGeneratedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "injectionMode" INTEGER NOT NULL DEFAULT 2,
    "injectCondition" INTEGER NOT NULL DEFAULT 1,
    "defaultContrastOnlyProtocol" INTEGER NOT NULL DEFAULT 2,
    "defaultContrastAndSalineProtocol" INTEGER NOT NULL DEFAULT 1,
    "sliceExpansionBehavior" INTEGER NOT NULL DEFAULT 1,
    "preferredAnswerCriteriaByStackQuestionId" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "UserInformations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserInformations_userId_key" ON "UserInformations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserInformations_email_key" ON "UserInformations"("email");
