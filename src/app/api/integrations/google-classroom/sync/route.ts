import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/modules/api/auth";
import { checkRateLimit } from "@/modules/api/rate-limit";
import { syncGoogleClassroom } from "@/modules/integrations/google-classroom/classroom-client";
import {
	type ClassroomConnectionState,
	createClassroomSyncHandlers,
} from "./handlers";

interface ExternalConnectionDelegate {
	findFirst(args: unknown): Promise<ClassroomConnectionState | null>;
}

const externalConnections =
	prisma.externalConnection as unknown as ExternalConnectionDelegate;

const handlers = createClassroomSyncHandlers({
	requireUserId,
	findConnectionState: (userId) =>
		externalConnections.findFirst({
			where: { userId, provider: "google_classroom" },
			orderBy: { connectedAt: "desc" },
			select: {
				healthy: true,
				lastError: true,
				lastSyncedAt: true,
				connectedAt: true,
				revokedAt: true,
			},
		}),
	syncGoogleClassroom,
	checkRateLimit,
});

export const GET = handlers.GET;
export const POST = handlers.POST;
