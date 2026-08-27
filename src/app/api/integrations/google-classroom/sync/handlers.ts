import { apiError } from "../../../../../modules/api/auth.ts";
import {
	ClassroomIntegrationError,
	type ClassroomIntegrationErrorCode,
} from "../../../../../modules/integrations/google-classroom/classroom-client.ts";

export interface ClassroomConnectionState {
	healthy: boolean;
	lastError: string | null;
	lastSyncedAt: Date | null;
	connectedAt: Date;
	revokedAt: Date | null;
}

interface ClassroomSyncDependencies {
	requireUserId: () => Promise<string>;
	findConnectionState: (
		userId: string,
	) => Promise<ClassroomConnectionState | null>;
	syncGoogleClassroom: (userId: string) => Promise<{
		imported: number;
		skipped: number;
		courses: number;
	}>;
	checkRateLimit: (input: {
		key: string;
		limit: number;
		windowMs: number;
	}) => boolean;
}

const integrationStatuses: Record<ClassroomIntegrationErrorCode, number> = {
	classroom_not_connected: 409,
	classroom_reconnect_required: 401,
	classroom_sync_failed: 502,
};

function integrationError(error: unknown) {
	if (error instanceof ClassroomIntegrationError) {
		return Response.json(
			{ error: { code: error.code, message: error.message } },
			{ status: integrationStatuses[error.code] },
		);
	}
	return apiError(error);
}

export function createClassroomSyncHandlers(deps: ClassroomSyncDependencies) {
	return {
		async GET() {
			try {
				const userId = await deps.requireUserId();
				const connection = await deps.findConnectionState(userId);
				const connected = connection !== null && connection.revokedAt === null;
				return Response.json({
					connected,
					connection: connected ? connection : null,
				});
			} catch (error) {
				return integrationError(error);
			}
		},

		async POST(request: Request) {
			try {
				const userId = await deps.requireUserId();
				const connection = await deps.findConnectionState(userId);
				if (!connection || connection.revokedAt !== null) {
					throw new ClassroomIntegrationError(
						"classroom_not_connected",
						"Google Classroom is not connected.",
					);
				}

				const ip = request.headers.get("x-forwarded-for") ?? "local";
				if (
					!deps.checkRateLimit({
						key: `classroom:${userId}:${ip}`,
						limit: 5,
						windowMs: 10 * 60 * 1000,
					})
				) {
					return Response.json(
						{
							error: {
								code: "rate_limited",
								message: "Too many Classroom sync requests. Try again soon.",
							},
						},
						{ status: 429 },
					);
				}

				return Response.json(await deps.syncGoogleClassroom(userId));
			} catch (error) {
				return integrationError(error);
			}
		},
	};
}
