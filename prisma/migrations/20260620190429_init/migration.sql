-- CreateEnum
CREATE TYPE "EventColor" AS ENUM ('School', 'Homework', 'Studying', 'Extracurriculars', 'Work', 'Other');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('active', 'completed', 'blocked', 'archived');

-- CreateEnum
CREATE TYPE "TaskEstimateSource" AS ENUM ('gemini', 'openai', 'ollama', 'local', 'manual');

-- CreateEnum
CREATE TYPE "ExternalProvider" AS ENUM ('google_classroom', 'google_calendar');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('scheduled', 'failed', 'locked');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_accounts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "location" TEXT,
    "color" "EventColor" NOT NULL DEFAULT 'Other',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "recurrenceRule" JSONB,
    "externalProvider" "ExternalProvider",
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "color" "EventColor" NOT NULL DEFAULT 'Other',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "estimateSource" "TaskEstimateSource" NOT NULL DEFAULT 'manual',
    "estimateModel" TEXT,
    "estimateReason" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'active',
    "externalProvider" "ExternalProvider",
    "externalId" TEXT,
    "externalUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_blocks" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "scheduleStatus" "ScheduleStatus" NOT NULL DEFAULT 'scheduled',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_connections" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "ExternalProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "scopes" TEXT[],
    "healthy" BOOLEAN NOT NULL DEFAULT true,
    "lastError" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_item_mappings" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "ExternalProvider" NOT NULL,
    "externalCourseId" TEXT,
    "externalItemId" TEXT NOT NULL,
    "eventId" UUID,
    "taskId" UUID,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_item_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "auth_accounts_userId_idx" ON "auth_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_accounts_provider_providerAccountId_key" ON "auth_accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_sessionToken_key" ON "auth_sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "auth_sessions_userId_idx" ON "auth_sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "events_userId_startAt_endAt_idx" ON "events"("userId", "startAt", "endAt");

-- CreateIndex
CREATE UNIQUE INDEX "events_userId_externalProvider_externalId_key" ON "events"("userId", "externalProvider", "externalId");

-- CreateIndex
CREATE INDEX "tasks_userId_dueAt_status_idx" ON "tasks"("userId", "dueAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_userId_externalProvider_externalId_key" ON "tasks"("userId", "externalProvider", "externalId");

-- CreateIndex
CREATE INDEX "task_blocks_userId_startAt_endAt_idx" ON "task_blocks"("userId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "task_blocks_taskId_idx" ON "task_blocks"("taskId");

-- CreateIndex
CREATE INDEX "external_connections_userId_provider_idx" ON "external_connections"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "external_connections_userId_provider_providerAccountId_key" ON "external_connections"("userId", "provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "external_item_mappings_taskId_idx" ON "external_item_mappings"("taskId");

-- CreateIndex
CREATE INDEX "external_item_mappings_eventId_idx" ON "external_item_mappings"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "external_item_mappings_userId_provider_externalCourseId_ext_key" ON "external_item_mappings"("userId", "provider", "externalCourseId", "externalItemId");

-- AddForeignKey
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_blocks" ADD CONSTRAINT "task_blocks_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_blocks" ADD CONSTRAINT "task_blocks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_connections" ADD CONSTRAINT "external_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_item_mappings" ADD CONSTRAINT "external_item_mappings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_item_mappings" ADD CONSTRAINT "external_item_mappings_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_item_mappings" ADD CONSTRAINT "external_item_mappings_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
