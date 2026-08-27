import { apiError } from "@/modules/api/auth";
import { createGoogleClassroomDisconnectHandler } from "@/modules/integrations/google-classroom/handlers";
import { requireIntegrationUser } from "@/modules/integrations/google-classroom/integration-auth";
import { allowIntegrationRequest } from "@/modules/integrations/google-classroom/integration-rate-limit";
import {
	assertIntegrationSameOrigin,
	disconnectGoogleClassroom,
} from "@/modules/integrations/google-classroom/oauth-service";

export const DELETE = createGoogleClassroomDisconnectHandler({
	requireUser: requireIntegrationUser,
	assertSameOrigin: assertIntegrationSameOrigin,
	allowRequest: (request, userId) =>
		allowIntegrationRequest(request, userId, "disconnect"),
	disconnect: disconnectGoogleClassroom,
	apiError,
});
