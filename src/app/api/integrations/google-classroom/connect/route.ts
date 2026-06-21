import { apiError } from "@/modules/api/auth";
import { createGoogleClassroomConnectHandler } from "@/modules/integrations/google-classroom/handlers";
import { requireIntegrationUser } from "@/modules/integrations/google-classroom/integration-auth";
import { allowIntegrationRequest } from "@/modules/integrations/google-classroom/integration-rate-limit";
import {
	assertIntegrationSameOrigin,
	beginGoogleClassroomAuthorization,
} from "@/modules/integrations/google-classroom/oauth-service";

export const POST = createGoogleClassroomConnectHandler({
	requireUser: requireIntegrationUser,
	assertSameOrigin: assertIntegrationSameOrigin,
	allowRequest: (request, userId) =>
		allowIntegrationRequest(request, userId, "connect"),
	beginAuthorization: beginGoogleClassroomAuthorization,
	apiError,
});
