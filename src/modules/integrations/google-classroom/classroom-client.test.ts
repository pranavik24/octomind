import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	ClassroomIntegrationError,
	createClassroomClient,
} from "./classroom-client.ts";

const future = new Date("2026-06-21T14:00:00.000Z");
const now = new Date("2026-06-21T12:00:00.000Z");

function connection(overrides: Record<string, unknown> = {}) {
	return {
		id: "connection-1",
		userId: "user-1",
		provider: "google_classroom" as const,
		providerAccountId: "student@example.com",
		accessTokenCiphertext: "encrypted-access",
		refreshTokenCiphertext: "encrypted-refresh",
		expiresAt: future,
		refreshTokenExpiresAt: null,
		tokenType: "Bearer",
		scopes: ["classroom.courses.readonly"],
		connectedAt: now,
		revokedAt: null,
		oauthClientKind: "google_classroom",
		healthy: true,
		lastError: null,
		lastSyncedAt: null,
		...overrides,
	};
}

function dependencies(overrides: Record<string, unknown> = {}) {
	const updates: Array<Record<string, unknown>> = [];
	return {
		updates,
		deps: {
			findConnection: async () => connection(),
			updateConnection: async (_id: string, data: Record<string, unknown>) => {
				updates.push(data);
			},
			decryptSecret: (value: string | null) =>
				value === "encrypted-refresh" ? "refresh-token" : "access-token",
			encryptSecret: (value: string) => `encrypted:${value}`,
			fetch: async () => new Response(JSON.stringify({ courses: [] })),
			now: () => now,
			estimateTaskDuration: async () => ({
				estimatedHours: 1,
				estimatedMinutes: 60,
				confidence: "high" as const,
				source: "local" as const,
				model: "test",
				reason: "test",
			}),
			createTaskForUser: async () => undefined,
			createId: () => "task-1",
			clientId: "classroom-client-id",
			clientSecret: "classroom-client-secret",
			...overrides,
		},
	};
}

describe("Google Classroom integration credentials", () => {
	it("uses a valid encrypted ExternalConnection access token without refreshing", async () => {
		let tokenRequests = 0;
		const { deps } = dependencies({
			fetch: async (input: string | URL | Request) => {
				if (String(input).includes("oauth2.googleapis.com")) tokenRequests += 1;
				return new Response(JSON.stringify({ courses: [] }));
			},
		});

		const result = await createClassroomClient(deps).sync("user-1");

		assert.equal(tokenRequests, 0);
		assert.deepEqual(result, { imported: 0, skipped: 0, courses: 0 });
	});

	it("refreshes with Classroom client credentials and stores encrypted tokens on the connection", async () => {
		let refreshBody = "";
		const { deps, updates } = dependencies({
			findConnection: async () =>
				connection({ expiresAt: new Date("2026-06-21T11:00:00.000Z") }),
			fetch: async (input: string | URL | Request, init?: RequestInit) => {
				if (String(input).includes("oauth2.googleapis.com")) {
					refreshBody = String(init?.body);
					return new Response(
						JSON.stringify({
							access_token: "new-access",
							expires_in: 3600,
							token_type: "Bearer",
							scope: "scope-one scope-two",
						}),
					);
				}
				return new Response(JSON.stringify({ courses: [] }));
			},
		});

		await createClassroomClient(deps).sync("user-1");

		assert.match(refreshBody, /client_id=classroom-client-id/);
		assert.match(refreshBody, /client_secret=classroom-client-secret/);
		assert.match(refreshBody, /refresh_token=refresh-token/);
		const tokenUpdate = updates.find((update) => update.accessTokenCiphertext);
		assert.equal(tokenUpdate?.accessTokenCiphertext, "encrypted:new-access");
		assert.equal(tokenUpdate?.tokenType, "Bearer");
		assert.deepEqual(tokenUpdate?.scopes, ["scope-one", "scope-two"]);
	});

	it("preserves the previous last sync when an expired token marks the connection unhealthy", async () => {
		const previousLastSyncedAt = new Date("2026-06-20T09:00:00.000Z");
		const { deps, updates } = dependencies({
			findConnection: async () =>
				connection({
					expiresAt: new Date("2026-06-21T11:00:00.000Z"),
					refreshTokenExpiresAt: new Date("2026-06-21T11:30:00.000Z"),
					lastSyncedAt: previousLastSyncedAt,
				}),
		});

		await assert.rejects(
			() => createClassroomClient(deps).sync("user-1"),
			(error: unknown) =>
				error instanceof ClassroomIntegrationError &&
				error.code === "classroom_reconnect_required",
		);
		const failureUpdate = updates.find((update) => update.healthy === false);
		assert.match(String(failureUpdate?.lastError), /expired or was revoked/i);
		assert.equal(
			updates.some((update) => "lastSyncedAt" in update),
			false,
		);
	});

	it("refuses to import coursework when no active connection exists", async () => {
		let taskWrites = 0;
		const { deps } = dependencies({
			findConnection: async () => null,
			createTaskForUser: async () => {
				taskWrites += 1;
			},
		});

		await assert.rejects(
			() => createClassroomClient(deps).sync("user-1"),
			(error: unknown) =>
				error instanceof ClassroomIntegrationError &&
				error.code === "classroom_not_connected",
		);
		assert.equal(taskWrites, 0);
	});
});
