ALTER TABLE "InterventionRules"
  DROP CONSTRAINT "intervention_rules_score_range_check",
  DROP CONSTRAINT "intervention_rules_domain_check",
  DROP CONSTRAINT "intervention_rules_domain_fields_check";

ALTER TABLE "InterventionRules"
  ADD COLUMN "fromValue"   numeric(10,3),
  ADD COLUMN "toValue"     numeric(10,3),
  ADD COLUMN "metric"      VARCHAR(32),
  ADD COLUMN "aggregation" VARCHAR(32);

UPDATE "InterventionRules"
   SET "fromValue" = "fromScore"::numeric(10,3),
       "toValue"   = "toScore"::numeric(10,3);

ALTER TABLE "InterventionRules"
  ALTER COLUMN "fromValue" SET NOT NULL,
  ALTER COLUMN "toValue"   SET NOT NULL,
  DROP COLUMN  "fromScore",
  DROP COLUMN  "toScore";

ALTER TABLE "InterventionRules"
  ADD CONSTRAINT "intervention_rules_domain_check"
    CHECK ("domain" IN ('clinical','didactic','consistency')),
  ADD CONSTRAINT "intervention_rules_metric_check"
    CHECK ("metric" IS NULL OR "metric" IN ('angulation','wastedSlices','wastedCoverage')),
  ADD CONSTRAINT "intervention_rules_aggregation_check"
    CHECK ("aggregation" IS NULL OR "aggregation" IN ('absoluteTotal','total','absoluteMean')),
  ADD CONSTRAINT "intervention_rules_value_range_check"
    CHECK ("fromValue" <= "toValue");

CREATE INDEX "InterventionRules_domain_metric_idx"
  ON "InterventionRules" ("domain", "metric");
