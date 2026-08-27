import {
	callbackErrorCode,
	classifyGoogleOAuthError,
	GoogleClassroomOAuthError,
	type GoogleOAuthRedirectCode,
} from "./oauth.ts";
import type { IntegrationUser } from "./integration-auth.ts";

type RateLimitDependency = (
	request: Request,
	userId: string,
) => boolean;

function rateLimitedResponse(): Response {
	return Response.json(
		{
			error: {
				code: "rate_limited",
				message: "Too many integration requests. Try again soon.",
			},
		},
		{ status: 429 },
	);
}

type ConnectDependencies = {
	requireUser: () => Promise<IntegrationUser>;
	assertSameOrigin: (request: Request) => void;
	allowRequest: RateLimitDependency;
	beginAuthorization: (userId: string) => Promise<string>;
	apiError: (error: unknown) => Response;
};

type CallbackDependencies = {
	requireUser: () => Promise<IntegrationUser>;
	completeAuthorization: (input: {
		userId: string;
		expectedEmail: string;
		code: string;
		state: string;
	}) => Promise<void>;
	redirectUrl: (
		status: "connected" | "error",
		code?: GoogleOAuthRedirectCode,
	) => string;
};

type DisconnectDependencies = {
	requireUser: () => Promise<IntegrationUser>;
	assertSameOrigin: (request: Request) => void;
	allowRequest: RateLimitDependency;
	disconnect: (userId: string) => Promise<void>;
	apiError: (error: unknown) => Response;
};

export function createGoogleClassroomConnectHandler(
	dependencies: ConnectDependencies,
) {
	return async (request: Request) => {
		try {
			const user = await dependencies.requireUser();
			dependencies.assertSameOrigin(request);
			if (!dependencies.allowRequest(request, user.id)) {
				return rateLimitedResponse();
			}
			const authorizationUrl = await dependencies.beginAuthorization(user.id);
			return Response.json({ authorizationUrl });
		} catch (error) {
			return dependencies.apiError(error);
		}
	};
}

export function createGoogleClassroomCallbackHandler(
	dependencies: CallbackDependencies,
) {
	return async (request: Request) => {
		try {
			const user = await dependencies.requireUser();
			const requestUrl = new URL(request.url);
			const providerError = requestUrl.searchParams.get("error");
			if (providerError) {
				const errorCode = classifyGoogleOAuthError(
					providerError,
					requestUrl.searchParams.get("error_description"),
				);
				return Response.redirect(dependencies.redirectUrl("error", errorCode));
			}

			const code = requestUrl.searchParams.get("code");
			const state = requestUrl.searchParams.get("state");
			if (
				!code ||
				code.length > 4096 ||
				!state ||
				!/^[-_A-Za-z0-9]{32,128}$/.test(state)
			) {
				throw new GoogleClassroomOAuthError(
					"Invalid OAuth callback parameters.",
					"state_invalid",
				);
			}
			await dependencies.completeAuthorization({
				userId: user.id,
				expectedEmail: user.email,
				code,
				state,
			});
			return Response.redirect(dependencies.redirectUrl("connected"));
		} catch (error) {
			return Response.redirect(
				dependencies.redirectUrl("error", callbackErrorCode(error)),
			);
		}
	};
}

export function createGoogleClassroomDisconnectHandler(
	dependencies: DisconnectDependencies,
) {
	return async (request: Request) => {
		try {
			const user = await dependencies.requireUser();
			dependencies.assertSameOrigin(request);
			if (!dependencies.allowRequest(request, user.id)) {
				return rateLimitedResponse();
			}
			await dependencies.disconnect(user.id);
			return Response.json({ ok: true });
		} catch (error) {
			return dependencies.apiError(error);
		}
	};
}
