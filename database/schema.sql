-- Persistence model for the calendar/task scheduler.
-- Target database: PostgreSQL. Apply through a migration tool before production use.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE event_color AS ENUM (
	'School',
	'Homework',
	'Studying',
	'Extracurriculars',
	'Work',
	'Other'
);

CREATE TYPE task_status AS ENUM (
	'active',
	'completed',
	'blocked',
	'archived'
);

CREATE TYPE task_estimate_source AS ENUM (
	'gemini',
	'openai',
	'ollama',
	'local',
	'manual'
);

CREATE TYPE external_provider AS ENUM (
	'google_classroom',
	'google_calendar'
);

CREATE TYPE schedule_status AS ENUM (
	'scheduled',
	'failed',
	'locked'
);

CREATE TABLE users (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	email TEXT NOT NULL UNIQUE,
	name TEXT,
	image_url TEXT,
	timezone TEXT NOT NULL DEFAULT 'America/New_York',
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE auth_accounts (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	provider TEXT NOT NULL,
	provider_account_id TEXT NOT NULL,
	type TEXT NOT NULL DEFAULT 'oauth',
	access_token TEXT,
	refresh_token TEXT,
	expires_at TIMESTAMPTZ,
	scope TEXT,
	token_type TEXT,
	id_token TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	UNIQUE (provider, provider_account_id)
);

CREATE INDEX idx_auth_accounts_user_id ON auth_accounts(user_id);

CREATE TABLE auth_sessions (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	session_token TEXT NOT NULL UNIQUE,
	expires_at TIMESTAMPTZ NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_sessions_user_id ON auth_sessions(user_id);

CREATE TABLE verification_tokens (
	identifier TEXT NOT NULL,
	token TEXT NOT NULL,
	expires_at TIMESTAMPTZ NOT NULL,
	PRIMARY KEY (identifier, token)
);

CREATE TABLE events (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	title TEXT NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	location TEXT,
	color event_color NOT NULL DEFAULT 'Other',
	start_at TIMESTAMPTZ NOT NULL,
	end_at TIMESTAMPTZ NOT NULL,
	recurrence_rule JSONB,
	external_provider external_provider,
	external_id TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	CHECK (start_at < end_at),
	UNIQUE (user_id, external_provider, external_id)
);

CREATE INDEX idx_events_user_time ON events(user_id, start_at, end_at);

CREATE TABLE tasks (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	title TEXT NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	color event_color NOT NULL DEFAULT 'Other',
	due_at TIMESTAMPTZ NOT NULL,
	estimated_minutes INTEGER NOT NULL CHECK (
		estimated_minutes BETWEEN 30 AND 720 AND estimated_minutes % 30 = 0
	),
	estimate_source task_estimate_source NOT NULL DEFAULT 'manual',
	estimate_model TEXT,
	estimate_reason TEXT,
	status task_status NOT NULL DEFAULT 'active',
	external_provider external_provider,
	external_id TEXT,
	external_url TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	UNIQUE (user_id, external_provider, external_id)
);

CREATE INDEX idx_tasks_user_due_status ON tasks(user_id, due_at, status);

CREATE TABLE task_blocks (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	start_at TIMESTAMPTZ NOT NULL,
	end_at TIMESTAMPTZ NOT NULL,
	position INTEGER NOT NULL DEFAULT 0,
	locked BOOLEAN NOT NULL DEFAULT false,
	schedule_status schedule_status NOT NULL DEFAULT 'scheduled',
	failure_reason TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	CHECK (start_at < end_at)
);

CREATE INDEX idx_task_blocks_user_time ON task_blocks(user_id, start_at, end_at);
CREATE INDEX idx_task_blocks_task_id ON task_blocks(task_id);

CREATE TABLE external_connections (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	provider external_provider NOT NULL,
	provider_account_id TEXT NOT NULL,
	scopes TEXT[] NOT NULL DEFAULT '{}',
	last_synced_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	UNIQUE (user_id, provider, provider_account_id)
);

CREATE INDEX idx_external_connections_user_provider
	ON external_connections(user_id, provider);

CREATE TABLE external_item_mappings (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	provider external_provider NOT NULL,
	external_course_id TEXT,
	external_item_id TEXT NOT NULL,
	event_id UUID REFERENCES events(id) ON DELETE CASCADE,
	task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
	last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	CHECK (
		(event_id IS NOT NULL AND task_id IS NULL)
		OR (event_id IS NULL AND task_id IS NOT NULL)
	),
	UNIQUE (user_id, provider, external_course_id, external_item_id)
);

CREATE INDEX idx_external_item_mappings_task_id ON external_item_mappings(task_id);
CREATE INDEX idx_external_item_mappings_event_id ON external_item_mappings(event_id);
