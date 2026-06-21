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
	if (!origin || origin !== new URL(request.url).origin) {
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
