-- CreateEnum
CREATE TYPE "OAuthClientKind" AS ENUM ('google_classroom', 'google_calendar');

-- Auth.js accounts retain identity linkage only. Integration credentials move to external_connections.
UPDATE "auth_accounts"
SET
    "refresh_token" = NULL,
    "access_token" = NULL,
    "expires_at" = NULL,
    "refresh_token_expires_in" = NULL,
    "token_type" = NULL,
    "scope" = NULL,
    "id_token" = NULL,
    "session_state" = NULL;

-- AlterTable
ALTER TABLE "external_connections"
ADD COLUMN "accessTokenCiphertext" TEXT,
ADD COLUMN "refreshTokenCiphertext" TEXT,
ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "refreshTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN "tokenType" TEXT,
ADD COLUMN "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "revokedAt" TIMESTAMP(3),
ADD COLUMN "oauthClientKind" "OAuthClientKind";

-- Existing rows predate separate integration OAuth and contain no integration tokens.
UPDATE "external_connections"
SET "oauthClientKind" = "provider"::text::"OAuthClientKind";

ALTER TABLE "external_connections"
ALTER COLUMN "oauthClientKind" SET NOT NULL,
ALTER COLUMN "oauthClientKind" SET DEFAULT 'google_classroom';

-- CreateTable
CREATE TABLE "integration_oauth_states" (
    "id" UUID NOT NULL,
    "stateHash" TEXT NOT NULL,
    "pkceVerifierCiphertext" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "ExternalProvider" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_oauth_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integration_oauth_states_stateHash_key" ON "integration_oauth_states"("stateHash");
CREATE INDEX "integration_oauth_states_userId_provider_idx" ON "integration_oauth_states"("userId", "provider");
CREATE INDEX "integration_oauth_states_expiresAt_idx" ON "integration_oauth_states"("expiresAt");

-- AddForeignKey
ALTER TABLE "integration_oauth_states"
ADD CONSTRAINT "integration_oauth_states_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
