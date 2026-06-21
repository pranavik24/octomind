import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ZodError } from "zod";
import { ApiError, apiError } from "./auth.ts";
import {
	eventCreatePayloadSchema,
	routeIdSchema,
	taskCreatePayloadSchema,
} from "./calendar-schemas.ts";

const uuid = "8d12443e-34a2-4f8a-9f35-86f2c445af61";

describe("calendar API validation", () => {
	it("accepts UUID route IDs and rejects malformed IDs", () => {
		assert.equal(routeIdSchema.parse(uuid), uuid);
		assert.equal(routeIdSchema.safeParse("not-a-uuid").success, false);
	});

	it("strips client IDs from event and task create payloads", () => {
		const event = eventCreatePayloadSchema.parse({
			id: uuid,
			startDate: "2026-06-20T13:00:00.000Z",
			endDate: "2026-06-20T14:00:00.000Z",
			title: "Class",
			color: "School",
		});
		const task = taskCreatePayloadSchema.parse({
			id: uuid,
			dueDate: "2026-06-22T03:59:00.000Z",
			title: "Essay",
			color: "Homework",
		});

		assert.equal("id" in event, false);
		assert.equal("id" in task, false);
	});
});

describe("calendar API errors", () => {
	it("maps typed errors to sanitized HTTP responses", async () => {
		for (const [error, status, code] of [
			[
				new ApiError("unauthorized", 401, "Sign in required."),
				401,
				"unauthorized",
			],
			[new ApiError("not_found", 404, "Record not found."), 404, "not_found"],
			[
				new ApiError("scheduling_conflict", 409, "Task cannot be scheduled."),
				409,
				"scheduling_conflict",
			],
		] as const) {
			const response = apiError(error);
			assert.equal(response.status, status);
			assert.deepEqual(await response.json(), {
				error: { code, message: error.publicMessage },
			});
		}
	});

	it("maps schema failures to a sanitized 400 response", async () => {
		let validationError: ZodError | undefined;
		try {
			routeIdSchema.parse("bad");
		} catch (error) {
			validationError = error as ZodError;
		}
		assert.ok(validationError);

		const response = apiError(validationError);
		assert.equal(response.status, 400);
		assert.deepEqual(await response.json(), {
			error: { code: "validation_error", message: "Invalid request." },
		});
	});

	it("never exposes unexpected exception details", async () => {
		const response = apiError(
			new Error("database host=db.internal stack trace"),
		);
		assert.equal(response.status, 500);
		assert.deepEqual(await response.json(), {
			error: { code: "internal_error", message: "Something went wrong." },
		});
	});
});
