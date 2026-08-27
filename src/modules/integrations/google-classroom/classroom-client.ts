import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
	buildClassroomTaskInput,
	type ClassroomCourseWork,
} from "@/modules/integrations/google-classroom/classroom-import";
import { createTaskForUser } from "@/modules/persistence/calendar-repository";
import {
	decryptIntegrationToken,
	encryptIntegrationToken,
} from "@/modules/security/token-crypto";
import { estimateTaskDuration } from "@/modules/task-estimate/estimator";

interface ClassroomCourse {
	id: string;
	name?: string;
}

interface ListCoursesResponse {
	courses?: ClassroomCourse[];
	nextPageToken?: string;
}

interface ListCourseWorkResponse {
	courseWork?: ClassroomCourseWork[];
	nextPageToken?: string;
}

interface ExternalConnectionCredentials {
	id: string;
	userId: string;
	provider: "google_classroom";
	providerAccountId: string;
	accessTokenCiphertext: string | null;
	refreshTokenCiphertext: string | null;
	expiresAt: Date | null;
	refreshTokenExpiresAt: Date | null;
	tokenType: string | null;
	scopes: string[];
	connectedAt: Date;
	revokedAt: Date | null;
	oauthClientKind: string;
	healthy: boolean;
	lastError: string | null;
	lastSyncedAt: Date | null;
}

type ConnectionUpdate = Partial<
	Pick<
		ExternalConnectionCredentials,
		| "accessTokenCiphertext"
		| "expiresAt"
		| "tokenType"
		| "scopes"
		| "healthy"
		| "lastError"
		| "lastSyncedAt"
	>
>;

interface ClassroomClientDependencies {
	findConnection: (
		userId: string,
	) => Promise<ExternalConnectionCredentials | null>;
	updateConnection: (id: string, data: ConnectionUpdate) => Promise<unknown>;
	decryptSecret: (ciphertext: string | null) => string | null;
	encryptSecret: (value: string) => string;
	fetch: typeof fetch;
	now: () => Date;
	estimateTaskDuration: typeof estimateTaskDuration;
	createTaskForUser: (
		...args: Parameters<typeof createTaskForUser>
	) => Promise<unknown>;
	createId: () => string;
	clientId: string;
	clientSecret: string;
}

export type ClassroomIntegrationErrorCode =
	| "classroom_not_connected"
	| "classroom_reconnect_required"
	| "classroom_sync_failed";

export class ClassroomIntegrationError extends Error {
	readonly code: ClassroomIntegrationErrorCode;

	constructor(
		code: ClassroomIntegrationErrorCode,
		message: string,
		options?: ErrorOptions,
	) {
		super(message, options);
		this.name = "ClassroomIntegrationError";
		this.code = code;
	}
}

const classroomBaseUrl = "https://classroom.googleapis.com/v1";

function reconnectError(cause?: unknown) {
	return new ClassroomIntegrationError(
		"classroom_reconnect_required",
		"Google Classroom access expired or was revoked. Reconnect to continue.",
		cause === undefined ? undefined : { cause },
	);
}

async function markUnhealthy(
	deps: ClassroomClientDependencies,
	connectionId: string,
	error: ClassroomIntegrationError,
) {
	await deps.updateConnection(connectionId, {
		healthy: false,
		lastError: error.message,
	});
}

async function refreshAccessToken(
	deps: ClassroomClientDependencies,
	connection: ExternalConnectionCredentials,
) {
	const refreshToken = deps.decryptSecret(connection.refreshTokenCiphertext);
	if (
		!refreshToken ||
		(connection.refreshTokenExpiresAt !== null &&
			connection.refreshTokenExpiresAt <= deps.now())
	) {
		throw reconnectError();
	}

	if (!deps.clientId || !deps.clientSecret) {
		throw new ClassroomIntegrationError(
			"classroom_sync_failed",
			"Google Classroom is temporarily unavailable.",
		);
	}

	const response = await deps.fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: deps.clientId,
			client_secret: deps.clientSecret,
			grant_type: "refresh_token",
			refresh_token: refreshToken,
		}),
	});

	if (!response.ok) {
		if (response.status === 400 || response.status === 401) {
			throw reconnectError();
		}
		throw new ClassroomIntegrationError(
			"classroom_sync_failed",
			"Google Classroom is temporarily unavailable.",
		);
	}

	const data = (await response.json()) as {
		access_token?: string;
		expires_in?: number;
		token_type?: string;
		scope?: string;
	};
	if (!data.access_token) {
		throw reconnectError();
	}

	const expiresAt = data.expires_in
		? new Date(deps.now().getTime() + data.expires_in * 1000)
		: null;
	await deps.updateConnection(connection.id, {
		accessTokenCiphertext: deps.encryptSecret(data.access_token),
		expiresAt,
		tokenType: data.token_type ?? connection.tokenType,
		scopes: data.scope
			? data.scope.split(/\s+/).filter(Boolean)
			: connection.scopes,
		healthy: true,
		lastError: null,
	});

	return data.access_token;
}

async function accessToken(
	deps: ClassroomClientDependencies,
	connection: ExternalConnectionCredentials,
) {
	const token = deps.decryptSecret(connection.accessTokenCiphertext);
	const refreshThreshold = deps.now().getTime() + 60_000;
	if (
		token &&
		(connection.expiresAt === null ||
			connection.expiresAt.getTime() > refreshThreshold)
	) {
		return token;
	}

	return refreshAccessToken(deps, connection);
}

async function googleFetch<T>(
	deps: ClassroomClientDependencies,
	url: string,
	token: string,
): Promise<T> {
	const response = await deps.fetch(url, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/json",
		},
	});
	if (response.status === 401 || response.status === 403)
		throw reconnectError();
	if (!response.ok) {
		throw new ClassroomIntegrationError(
			"classroom_sync_failed",
			"Google Classroom could not be synced. Try again later.",
		);
	}
	return (await response.json()) as T;
}

async function listActiveCourses(
	deps: ClassroomClientDependencies,
	token: string,
) {
	let courses: ClassroomCourse[] = [];
	let pageToken: string | undefined;
	do {
		const url = new URL(`${classroomBaseUrl}/courses`);
		url.searchParams.set("studentId", "me");
		url.searchParams.set("courseStates", "ACTIVE");
		if (pageToken) url.searchParams.set("pageToken", pageToken);
		const data = await googleFetch<ListCoursesResponse>(
			deps,
			url.toString(),
			token,
		);
		courses = [...courses, ...(data.courses ?? [])];
		pageToken = data.nextPageToken;
	} while (pageToken);
	return courses;
}

async function listCourseWork(
	deps: ClassroomClientDependencies,
	token: string,
	courseId: string,
) {
	let courseWork: ClassroomCourseWork[] = [];
	let pageToken: string | undefined;
	do {
		const url = new URL(`${classroomBaseUrl}/courses/${courseId}/courseWork`);
		url.searchParams.set("orderBy", "dueDate asc");
		if (pageToken) url.searchParams.set("pageToken", pageToken);
		const data = await googleFetch<ListCourseWorkResponse>(
			deps,
			url.toString(),
			token,
		);
		courseWork = [...courseWork, ...(data.courseWork ?? [])];
		pageToken = data.nextPageToken;
	} while (pageToken);
	return courseWork;
}

export function createClassroomClient(deps: ClassroomClientDependencies) {
	return {
		async sync(userId: string) {
			const connection = await deps.findConnection(userId);
			if (!connection || connection.revokedAt !== null) {
				throw new ClassroomIntegrationError(
					"classroom_not_connected",
					"Google Classroom is not connected.",
				);
			}

			try {
				const token = await accessToken(deps, connection);
				const courses = await listActiveCourses(deps, token);
				let imported = 0;
				let skipped = 0;

				for (const course of courses) {
					const courseWork = await listCourseWork(deps, token, course.id);
					for (const work of courseWork) {
						if ((work.state && work.state !== "PUBLISHED") || !work.dueDate) {
							skipped += 1;
							continue;
						}

						const estimate = await deps.estimateTaskDuration({
							title: work.title ?? "Untitled assignment",
							description: work.description ?? course.name ?? "",
							category: "Homework",
						});
						const input = buildClassroomTaskInput({
							courseId: course.id,
							courseName: course.name ?? "Google Classroom",
							courseWork: work,
							estimatedMinutes: estimate.estimatedMinutes,
							estimateModel: estimate.model,
							estimateReason: estimate.reason,
						});
						if (!input) {
							skipped += 1;
							continue;
						}

						await deps.createTaskForUser(
							userId,
							{
								id: deps.createId(),
								title: input.title,
								description: input.description,
								color: input.color,
								dueDate: input.dueDate,
								estimatedHours: input.estimatedHours,
								user: { id: userId, name: "Student", picturePath: null },
							},
							{
								provider: "google_classroom",
								externalId: input.externalId,
								externalCourseId: input.externalCourseId,
								externalUrl: input.externalUrl,
								estimateSource: input.estimateSource,
								estimateModel: input.estimateModel,
								estimateReason: input.estimateReason,
							},
						);
						imported += 1;
					}
				}

				await deps.updateConnection(connection.id, {
					healthy: true,
					lastError: null,
					lastSyncedAt: deps.now(),
				});
				return { imported, skipped, courses: courses.length };
			} catch (cause) {
				const error =
					cause instanceof ClassroomIntegrationError
						? cause
						: new ClassroomIntegrationError(
								"classroom_sync_failed",
								"Google Classroom could not be synced. Try again later.",
								{ cause },
							);
				await markUnhealthy(deps, connection.id, error);
				throw error;
			}
		},
	};
}

interface ExternalConnectionDelegate {
	findFirst(args: unknown): Promise<ExternalConnectionCredentials | null>;
	update(args: unknown): Promise<unknown>;
}

const externalConnections =
	prisma.externalConnection as unknown as ExternalConnectionDelegate;

const classroomClient = createClassroomClient({
	findConnection: (userId) =>
		externalConnections.findFirst({
			where: { userId, provider: "google_classroom", revokedAt: null },
			orderBy: { connectedAt: "desc" },
		}),
	updateConnection: (id, data) =>
		externalConnections.update({ where: { id }, data }),
	decryptSecret: (value) => (value ? decryptIntegrationToken(value) : null),
	encryptSecret: encryptIntegrationToken,
	fetch,
	now: () => new Date(),
	estimateTaskDuration,
	createTaskForUser,
	createId: randomUUID,
	clientId: process.env.GOOGLE_CLASSROOM_CLIENT_ID ?? "",
	clientSecret: process.env.GOOGLE_CLASSROOM_CLIENT_SECRET ?? "",
});

export function syncGoogleClassroom(userId: string) {
	return classroomClient.sync(userId);
}
