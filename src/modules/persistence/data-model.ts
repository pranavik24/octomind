import type { TEventColor } from "@/modules/components/calendar/types";

export type DataId = string;

export type ExternalProvider = "google_classroom" | "google_calendar";

export type TaskEstimateSource =
	| "gemini"
	| "openai"
	| "ollama"
	| "local"
	| "manual";

export type PersistedTaskStatus =
	| "active"
	| "completed"
	| "blocked"
	| "archived";

export type PersistedScheduleStatus = "scheduled" | "failed" | "locked";

export interface PersistedUser {
	id: DataId;
	email: string;
	name: string | null;
	imageUrl: string | null;
	timezone: string;
	createdAt: string;
	updatedAt: string;
}

export interface PersistedAuthAccount {
	id: DataId;
	userId: DataId;
	provider: string;
	providerAccountId: string;
	type: "oauth";
	accessToken: string | null;
	refreshToken: string | null;
	expiresAt: string | null;
	scope: string | null;
	tokenType: string | null;
	idToken: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface PersistedEvent {
	id: DataId;
	userId: DataId;
	title: string;
	description: string;
	location: string | null;
	color: TEventColor;
	startAt: string;
	endAt: string;
	recurrenceRule: Record<string, unknown> | null;
	externalProvider: ExternalProvider | null;
	externalId: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface PersistedTask {
	id: DataId;
	userId: DataId;
	title: string;
	description: string;
	color: TEventColor;
	dueAt: string;
	estimatedMinutes: number;
	estimateSource: TaskEstimateSource;
	estimateModel: string | null;
	estimateReason: string | null;
	status: PersistedTaskStatus;
	externalProvider: ExternalProvider | null;
	externalId: string | null;
	externalUrl: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface PersistedTaskBlock {
	id: DataId;
	taskId: DataId;
	userId: DataId;
	startAt: string;
	endAt: string;
	position: number;
	locked: boolean;
	scheduleStatus: PersistedScheduleStatus;
	failureReason: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface PersistedExternalConnection {
	id: DataId;
	userId: DataId;
	provider: ExternalProvider;
	providerAccountId: string;
	scopes: string[];
	lastSyncedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface PersistedExternalItemMapping {
	id: DataId;
	userId: DataId;
	provider: ExternalProvider;
	externalCourseId: string | null;
	externalItemId: string;
	eventId: DataId | null;
	taskId: DataId | null;
	lastSeenAt: string;
	createdAt: string;
	updatedAt: string;
}

export interface CalendarPersistenceModel {
	user: PersistedUser;
	events: PersistedEvent[];
	tasks: Array<PersistedTask & { blocks: PersistedTaskBlock[] }>;
	externalConnections: PersistedExternalConnection[];
}
