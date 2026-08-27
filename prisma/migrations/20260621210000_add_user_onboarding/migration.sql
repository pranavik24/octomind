ALTER TABLE "users"
ADD COLUMN "sleepTimeMinutes" INTEGER,
ADD COLUMN "wakeTimeMinutes" INTEGER,
ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

-- Existing accounts keep their current calendar. Only accounts created after this
-- migration enter the first-login setup flow.
UPDATE "users"
SET "onboardingCompletedAt" = CURRENT_TIMESTAMP
WHERE "onboardingCompletedAt" IS NULL;
