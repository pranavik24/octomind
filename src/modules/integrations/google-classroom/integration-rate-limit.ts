import { isIP } from "node:net";
import { checkRateLimit } from "@/modules/api/rate-limit";

export type IntegrationRateLimitAction = "connect" | "disconnect";

const limits: Record<
	IntegrationRateLimitAction,
	{ limit: number; windowMs: number }
> = {
	connect: { limit: 5, windowMs: 10 * 60 * 1000 },
	disconnect: { limit: 10, windowMs: 10 * 60 * 1000 },
};

function clientIp(request: Request): string {
	if (process.env.TRUST_PROXY_HEADERS !== "true") return "direct";
	const forwarded = request.headers.get("x-forwarded-for");
	const candidate = forwarded?.split(",").at(-1)?.trim();
	return candidate && isIP(candidate) ? candidate : "unknown";
}

export function integrationRateLimitKey(
	request: Request,
	userId: string,
	action: IntegrationRateLimitAction,
): string {
	return `integration:${action}:${userId}:${clientIp(request)}`;
}

export function allowIntegrationRequest(
	request: Request,
	userId: string,
	action: IntegrationRateLimitAction,
): boolean {
	return checkRateLimit({
		key: integrationRateLimitKey(request, userId, action),
		...limits[action],
	});
}
