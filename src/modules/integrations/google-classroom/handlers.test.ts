import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	createGoogleClassroomCallbackHandler,
	createGoogleClassroomConnectHandler,
	createGoogleClassroomDisconnectHandler,
} from "./handlers.ts";

const userId = "066dd68c-7327-490b-a2e8-5d319cdd2b06";
const user = { id: userId, email: "student@example.com" };
const errorResponse = () => Response.json({ error: "unauthorized" }, { status: 401 });

describe("Google Classroom integration route handlers", () => {
	it("requires authentication before beginning a connection", async () => {
		let began = false;
		const handler = createGoogleClassroomConnectHandler({
			requireUser: async () => { throw new Error("unauthorized"); },
			assertSameOrigin: () => undefined,
			beginAuthorization: async () => { began = true; return "https://accounts.google.com"; },
			allowRequest: () => true,
			apiError: errorResponse,
		});

		const response = await handler(new Request("https://octomind.test/api/integrations/google-classroom/connect", { method: "POST" }));
		assert.equal(response.status, 401);
		assert.equal(began, false);
	});

	it("returns the authorization URL for an authenticated same-origin request", async () => {
		const handler = createGoogleClassroomConnectHandler({
			requireUser: async () => user,
			assertSameOrigin: () => undefined,
			beginAuthorization: async (actualUserId) => {
				assert.equal(actualUserId, userId);
				return "https://accounts.google.com/o/oauth2/v2/auth";
			},
			allowRequest: () => true,
			apiError: errorResponse,
		});

		const response = await handler(new Request("https://octomind.test/api/integrations/google-classroom/connect", { method: "POST" }));
		assert.deepEqual(await response.json(), { authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth" });
	});

	it("returns 429 when an authenticated connect request exceeds its user/IP limit", async () => {
		let began = false;
		const handler = createGoogleClassroomConnectHandler({
			requireUser: async () => user,
			assertSameOrigin: () => undefined,
			allowRequest: () => false,
			beginAuthorization: async () => { began = true; return "unused"; },
			apiError: errorResponse,
		});

		const response = await handler(new Request("https://octomind.test/api/integrations/google-classroom/connect", { method: "POST" }));
		assert.equal(response.status, 429);
		assert.equal(began, false);
	});

	it("redirects denial and never reflects provider-controlled error text", async () => {
		let completed = false;
		const handler = createGoogleClassroomCallbackHandler({
			requireUser: async () => user,
			completeAuthorization: async () => { completed = true; },
			redirectUrl: (status, code) => `https://octomind.test/settings/integrations?provider=google_classroom&status=${status}${code ? `&code=${code}` : ""}`,
		});

		const response = await handler(new Request("https://octomind.test/api/integrations/google-classroom/callback?error=access_denied&error_description=%3Cscript%3E"));
		assert.equal(response.status, 302);
		assert.match(response.headers.get("location") ?? "", /status=error&code=denied$/);
		assert.doesNotMatch(response.headers.get("location") ?? "", /script/);
		assert.equal(completed, false);
	});

	it("requires authentication even when Google returns a denial", async () => {
		const handler = createGoogleClassroomCallbackHandler({
			requireUser: async () => { throw new Error("Authentication required."); },
			completeAuthorization: async () => undefined,
			redirectUrl: (status, code) => `https://octomind.test/settings/integrations?provider=google_classroom&status=${status}&code=${code}`,
		});

		const response = await handler(new Request("https://octomind.test/api/integrations/google-classroom/callback?error=access_denied"));
		assert.match(response.headers.get("location") ?? "", /status=error&code=unauthorized$/);
	});

	it("completes a valid callback for the authenticated user", async () => {
		const state = "s".repeat(43);
		let callbackInput:
			| { userId: string; expectedEmail: string; code: string; state: string }
			| undefined;
		const handler = createGoogleClassroomCallbackHandler({
			requireUser: async () => user,
			completeAuthorization: async (input) => { callbackInput = input; },
			redirectUrl: (status, code) => `https://octomind.test/settings/integrations?provider=google_classroom&status=${status}${code ? `&code=${code}` : ""}`,
		});

		const response = await handler(new Request(`https://octomind.test/api/integrations/google-classroom/callback?code=oauth-code&state=${state}`));
		assert.equal(response.headers.get("location"), "https://octomind.test/settings/integrations?provider=google_classroom&status=connected");
		assert.deepEqual(callbackInput, { userId, expectedEmail: user.email, code: "oauth-code", state });
	});

	it("disconnects the integration without touching the Auth.js session", async () => {
		let disconnectedUserId: string | undefined;
		const handler = createGoogleClassroomDisconnectHandler({
			requireUser: async () => user,
			assertSameOrigin: () => undefined,
			allowRequest: () => true,
			disconnect: async (actualUserId) => { disconnectedUserId = actualUserId; },
			apiError: errorResponse,
		});

		const response = await handler(new Request("https://octomind.test/api/integrations/google-classroom", { method: "DELETE" }));
		assert.deepEqual(await response.json(), { ok: true });
		assert.equal(disconnectedUserId, userId);
	});

	it("returns 429 without disconnecting when the user/IP limit is exceeded", async () => {
		let disconnected = false;
		const handler = createGoogleClassroomDisconnectHandler({
			requireUser: async () => user,
			assertSameOrigin: () => undefined,
			allowRequest: () => false,
			disconnect: async () => { disconnected = true; },
			apiError: errorResponse,
		});

		const response = await handler(new Request("https://octomind.test/api/integrations/google-classroom/disconnect", { method: "DELETE" }));
		assert.equal(response.status, 429);
		assert.equal(disconnected, false);
	});
});
