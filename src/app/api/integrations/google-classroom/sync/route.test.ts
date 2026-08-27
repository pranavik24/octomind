import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "../../../../../modules/api/auth.ts";
import { createClassroomSyncHandlers } from "./handlers.ts";

const connection = {
	healthy: true,
	lastError: null,
	lastSyncedAt: new Date("2026-06-21T12:00:00.000Z"),
	connectedAt: new Date("2026-06-20T12:00:00.000Z"),
	revokedAt: null,
};

describe("Classroom sync API", () => {
	it("GET reports a disconnected state without exposing credentials", async () => {
		const handlers = createClassroomSyncHandlers({
			requireUserId: async () => "user-1",
			findConnectionState: async () => null,
			syncGoogleClassroom: async () => ({
				imported: 0,
				skipped: 0,
				courses: 0,
			}),
			checkRateLimit: () => true,
		});

		const response = await handlers.GET();
		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), {
			connected: false,
			connection: null,
		});
	});

	it("GET reports active connection health and timestamps", async () => {
		const handlers = createClassroomSyncHandlers({
			requireUserId: async () => "user-1",
			findConnectionState: async () => connection,
			syncGoogleClassroom: async () => ({
				imported: 0,
				skipped: 0,
				courses: 0,
			}),
			checkRateLimit: () => true,
		});

		const response = await handlers.GET();
		const body = await response.json();
		assert.equal(body.connected, true);
		assert.equal(body.connection.healthy, true);
		assert.equal(body.connection.lastSyncedAt, "2026-06-21T12:00:00.000Z");
	});

	it("POST rejects sync before any import when disconnected", async () => {
		let syncCalls = 0;
		const handlers = createClassroomSyncHandlers({
			requireUserId: async () => "user-1",
			findConnectionState: async () => null,
			syncGoogleClassroom: async () => {
				syncCalls += 1;
				return { imported: 0, skipped: 0, courses: 0 };
			},
			checkRateLimit: () => true,
		});

		const response = await handlers.POST(
			new Request("http://localhost/api/integrations/google-classroom/sync", {
				method: "POST",
			}),
		);
		assert.equal(response.status, 409);
		assert.equal(syncCalls, 0);
		assert.equal((await response.json()).error.code, "classroom_not_connected");
	});

	it("keeps authentication errors sanitized and local to the integration API", async () => {
		const handlers = createClassroomSyncHandlers({
			requireUserId: async () => {
				throw new ApiError("unauthorized", 401, "Authentication required.");
			},
			findConnectionState: async () => connection,
			syncGoogleClassroom: async () => ({
				imported: 0,
				skipped: 0,
				courses: 0,
			}),
			checkRateLimit: () => true,
		});

		const response = await handlers.GET();
		assert.equal(response.status, 401);
		assert.deepEqual(await response.json(), {
			error: { code: "unauthorized", message: "Authentication required." },
		});
	});
});
