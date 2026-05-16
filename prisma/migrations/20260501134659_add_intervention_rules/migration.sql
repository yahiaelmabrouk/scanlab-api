-- CreateTable
CREATE TABLE "InterventionRules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "domain" VARCHAR(16) NOT NULL,
    "skillId" VARCHAR(255),
    "categoryId" INTEGER,
    "level" VARCHAR(16),
    "fromScore" SMALLINT NOT NULL,
    "toScore" SMALLINT NOT NULL,
    "interventions" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "createdBy" INTEGER NOT NULL,

    CONSTRAINT "InterventionRules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "intervention_rules_domain_check"
        CHECK ("domain" IN ('clinical','didactic')),
    CONSTRAINT "intervention_rules_level_check"
        CHECK ("level" IS NULL OR "level" IN ('overall','level1','level2','level3','level4','level5')),
    CONSTRAINT "intervention_rules_score_range_check"
        CHECK ("fromScore" BETWEEN 0 AND 100 AND "toScore" BETWEEN 0 AND 100 AND "fromScore" <= "toScore"),
    CONSTRAINT "intervention_rules_domain_fields_check"
        CHECK (
            ("domain" = 'clinical' AND "skillId" IS NOT NULL AND "categoryId" IS NULL AND "level" IS NULL)
            OR
            ("domain" = 'didactic' AND "categoryId" IS NOT NULL AND "level" IS NOT NULL AND "skillId" IS NULL)
        ),
    CONSTRAINT "intervention_rules_interventions_check"
        CHECK (jsonb_typeof("interventions") = 'array' AND jsonb_array_length("interventions") >= 1)
);

-- CreateIndex
CREATE INDEX "InterventionRules_domain_skillId_idx" ON "InterventionRules"("domain", "skillId");

-- CreateIndex
CREATE INDEX "InterventionRules_domain_categoryId_level_idx" ON "InterventionRules"("domain", "categoryId", "level");

-- AddForeignKey
ALTER TABLE "InterventionRules"
    ADD CONSTRAINT "InterventionRules_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionRules"
    ADD CONSTRAINT "InterventionRules_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "Users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
