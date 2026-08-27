import { requireUserId } from "@/modules/api/auth";
import { completeOnboardingForUser } from "@/modules/onboarding/repository";
import { createOnboardingPostHandler } from "./handlers";

export const POST = createOnboardingPostHandler({
	requireUserId,
	completeOnboarding: completeOnboardingForUser,
});
