UPDATE "external_connections"
SET "scopes" = ARRAY[]::TEXT[]
WHERE "scopes" IS NULL;

ALTER TABLE "external_connections"
ALTER COLUMN "scopes" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "scopes" SET NOT NULL;
