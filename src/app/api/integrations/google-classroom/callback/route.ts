import { createGoogleClassroomCallbackHandler } from "@/modules/integrations/google-classroom/handlers";
import { requireIntegrationUser } from "@/modules/integrations/google-classroom/integration-auth";
import {
	completeGoogleClassroomAuthorization,
	integrationRedirectUrl,
} from "@/modules/integrations/google-classroom/oauth-service";

export const GET = createGoogleClassroomCallbackHandler({
	requireUser: requireIntegrationUser,
	completeAuthorization: completeGoogleClassroomAuthorization,
	redirectUrl: integrationRedirectUrl,
});
