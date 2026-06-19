import { z } from "zod";
import { estimateTaskDuration } from "./estimator.ts";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;

const estimateRequestSchema = z.object({
	title: z.string().trim().max(200).default(""),
	description: z.string().trim().max(2000).default(""),
	category: z.string().trim().max(80).default("Other"),
	dueDate: z.string().trim().max(80).optional(),
});

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

export function resetTaskEstimateRateLimit() {
	rateLimitBuckets.clear();
}

function getClientId(request: Request): string {
	const forwardedFor = request.headers.get("x-forwarded-for");
	if (forwardedFor) {
		return forwardedFor.split(",")[0]?.trim() || "unknown";
	}

	return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function checkRateLimit(clientId: string, now = Date.now()) {
	const currentBucket = rateLimitBuckets.get(clientId);

	if (!currentBucket || currentBucket.resetAt <= now) {
		const resetAt = now + RATE_LIMIT_WINDOW_MS;
		rateLimitBuckets.set(clientId, { count: 1, resetAt });

		return {
			allowed: true,
			remaining: RATE_LIMIT_MAX_REQUESTS - 1,
			resetAt,
			retryAfter: 0,
		};
	}

	if (currentBucket.count >= RATE_LIMIT_MAX_REQUESTS) {
		return {
			allowed: false,
			remaining: 0,
			resetAt: currentBucket.resetAt,
			retryAfter: Math.max(
				1,
				Math.ceil((currentBucket.resetAt - now) / 1000),
			),
		};
	}

	const nextBucket = {
		...currentBucket,
		count: currentBucket.count + 1,
	};
	rateLimitBuckets.set(clientId, nextBucket);

	return {
		allowed: true,
		remaining: RATE_LIMIT_MAX_REQUESTS - nextBucket.count,
		resetAt: nextBucket.resetAt,
		retryAfter: 0,
	};
}

function rateLimitHeaders(limit: ReturnType<typeof checkRateLimit>) {
	return {
		"X-RateLimit-Limit": String(RATE_LIMIT_MAX_REQUESTS),
		"X-RateLimit-Remaining": String(limit.remaining),
		"X-RateLimit-Reset": String(Math.ceil(limit.resetAt / 1000)),
		...(limit.retryAfter > 0
			? { "Retry-After": String(limit.retryAfter) }
			: {}),
	};
}

export async function POST(request: Request) {
	const clientId = getClientId(request);
	const limit = checkRateLimit(clientId);

	if (!limit.allowed) {
		return Response.json(
			{
				error: {
					code: "rate_limited",
					message: "Too many task estimate requests. Please try again soon.",
				},
			},
			{ headers: rateLimitHeaders(limit), status: 429 },
		);
	}

	const body = await request.json().catch(() => null);
	const parsedBody = estimateRequestSchema.safeParse(body);

	if (!parsedBody.success) {
		return Response.json(
			{
				error: {
					code: "validation_error",
					message: "Invalid task estimate request.",
				},
			},
			{ headers: rateLimitHeaders(limit), status: 422 },
		);
	}

	const estimate = await estimateTaskDuration(parsedBody.data);

	return Response.json(estimate, { headers: rateLimitHeaders(limit) });
}
