import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
	allowIntegrationRequest,
	integrationRateLimitKey,
} from "./integration-rate-limit.ts";

const originalTrustProxyHeaders = process.env.TRUST_PROXY_HEADERS;

before(() => {
	process.env.TRUST_PROXY_HEADERS = "true";
});

after(() => {
	if (originalTrustProxyHeaders === undefined) delete process.env.TRUST_PROXY_HEADERS;
	else process.env.TRUST_PROXY_HEADERS = originalTrustProxyHeaders;
});

describe("integration rate limiting", () => {
	it("keys limits by action, authenticated user, and trusted client IP", () => {
		const request = new Request("https://octomind.test/api/integrations/google-classroom/connect", {
			headers: { "x-forwarded-for": "198.51.100.1, 203.0.113.8" },
		});

		assert.equal(
			integrationRateLimitKey(request, "user-rate-limit-test", "connect"),
			"integration:connect:user-rate-limit-test:203.0.113.8",
		);
	});

	it("rejects the sixth connect request in the ten-minute window", () => {
		const request = new Request("https://octomind.test/api/integrations/google-classroom/connect", {
			headers: { "x-forwarded-for": "203.0.113.9" },
		});
		const results = Array.from({ length: 6 }, () =>
			allowIntegrationRequest(request, "user-threshold-test", "connect"),
		);

		assert.deepEqual(results, [true, true, true, true, true, false]);
	});
});
