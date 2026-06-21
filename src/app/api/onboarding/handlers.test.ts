import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createOnboardingPostHandler } from "./handlers.ts";

const validBody = {
	timezone: "America/New_York",
	sleepTime: "23:00",
	wakeTime: "07:00",
	schoolDays: [1, 2, 3, 4, 5],
	schoolStartTime: "08:00",
	schoolEndTime: "15:00",
};

describe("POST /api/onboarding", () => {
	it("requires authentication before writing a schedule", async () => {
		let wrote = false;
		const handler = createOnboardingPostHandler({
			requireUserId: async () => {
				throw new Error("Authentication required.");
			},
			completeOnboarding: async () => {
				wrote = true;
				return { created: true };
			},
		});

		const response = await handler(
			new Request("http://localhost/api/onboarding", {
				method: "POST",
				headers: { origin: "http://localhost" },
				body: JSON.stringify(validBody),
			}),
		);
		assert.equal(response.status, 500);
		assert.equal(wrote, false);
	});

	it("validates school hours before repository access", async () => {
		let wrote = false;
		const handler = createOnboardingPostHandler({
			requireUserId: async () => "00000000-0000-4000-8000-000000000001",
			completeOnboarding: async () => {
				wrote = true;
				return { created: true };
			},
		});

		const response = await handler(
			new Request("http://localhost/api/onboarding", {
				method: "POST",
				headers: { origin: "http://localhost" },
				body: JSON.stringify({
					...validBody,
					schoolStartTime: "15:00",
					schoolEndTime: "08:00",
				}),
			}),
		);
		assert.equal(response.status, 400);
		assert.equal(wrote, false);
	});

	it("returns the repository's idempotent completion result", async () => {
		const handler = createOnboardingPostHandler({
			requireUserId: async () => "00000000-0000-4000-8000-000000000001",
			completeOnboarding: async (_userId, input) => {
				assert.deepEqual(input.schoolDays, [1, 2, 3, 4, 5]);
				return { created: false };
			},
		});
		const response = await handler(
			new Request("http://localhost/api/onboarding", {
				method: "POST",
				headers: { origin: "http://localhost" },
				body: JSON.stringify(validBody),
			}),
		);
		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), { created: false });
	});
});
