import { ApiError, apiError } from "@/modules/api/auth";
import type { OnboardingPayload } from "@/modules/onboarding/schema";
import { onboardingPayloadSchema } from "@/modules/onboarding/schema";

interface OnboardingDependencies {
	requireUserId: () => Promise<string>;
	completeOnboarding: (
		userId: string,
		input: OnboardingPayload,
	) => Promise<{ created: boolean }>;
}

function assertSameOrigin(request: Request) {
	const origin = request.headers.get("origin");
	const requestUrl = new URL(request.url);
	const host = request.headers.get("host");
	const hostOrigin = host ? `${requestUrl.protocol}//${host}` : null;
	let configuredOrigin: string | null = null;
	try {
		configuredOrigin = process.env.NEXTAUTH_URL
			? new URL(process.env.NEXTAUTH_URL).origin
			: null;
	} catch {
		configuredOrigin = null;
	}
	if (
		!origin ||
		(origin !== requestUrl.origin &&
			origin !== hostOrigin &&
			origin !== configuredOrigin)
	) {
		throw new ApiError("validation_error", 400, "Invalid request origin.");
	}
}

export function createOnboardingPostHandler(
	dependencies: OnboardingDependencies,
) {
	return async function post(request: Request) {
		try {
			const userId = await dependencies.requireUserId();
			assertSameOrigin(request);
			const input = onboardingPayloadSchema.parse(await request.json());
			return Response.json(
				await dependencies.completeOnboarding(userId, input),
			);
		} catch (error) {
			return apiError(error);
		}
	};
}
