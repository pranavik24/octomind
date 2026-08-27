import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	POST,
	resetTaskEstimateRateLimit,
} from "../../../modules/task-estimate/route-handler.ts";

const request = (body: unknown, ip = "203.0.113.10") =>
	new Request("http://localhost:3000/api/task-estimate", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-forwarded-for": ip,
		},
		body: JSON.stringify(body),
	});

describe("POST /api/task-estimate", () => {
	it("rejects oversized task estimate inputs", async () => {
		resetTaskEstimateRateLimit();

		const response = await POST(
			request({
				title: "x".repeat(201),
				description: "short",
				category: "Other",
			}),
		);

		assert.equal(response.status, 422);
		const data = await response.json();
		assert.equal(data.error.code, "validation_error");
	});

	it("rate limits expensive estimate requests by client", async () => {
		resetTaskEstimateRateLimit();
		const originalProvider = process.env.TASK_ESTIMATE_PROVIDER;
		process.env.TASK_ESTIMATE_PROVIDER = "local";

		try {
			const responses: Response[] = [];
			for (let index = 0; index < 11; index++) {
				responses.push(
					await POST(
						request(
							{
								title: `Task ${index}`,
								description: "Estimate me.",
								category: "Other",
							},
							"198.51.100.7",
						),
					),
				);
			}

			assert.equal(responses.at(-1)?.status, 429);
			assert.equal(responses.at(-1)?.headers.get("Retry-After"), "60");
		} finally {
			if (originalProvider === undefined) {
				delete process.env.TASK_ESTIMATE_PROVIDER;
			} else {
				process.env.TASK_ESTIMATE_PROVIDER = originalProvider;
			}
		}
	});
});
