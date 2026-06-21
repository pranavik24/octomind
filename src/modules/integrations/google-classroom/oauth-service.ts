import { prisma } from "@/lib/prisma";
import { ApiError } from "@/modules/api/auth";
import {
	decryptIntegrationToken,
	encryptIntegrationToken,
} from "@/modules/security/token-crypto";
import {
	buildGoogleClassroomAuthorizationUrl,
	assertGoogleIdentityMatchesAppUser,
	callbackUrlFromNextAuthUrl,
	createOAuthValue,
	createPkceChallenge,
	GoogleClassroomOAuthError,
	hashOAuthState,
	parseGoogleTokenResponse,
	type GoogleOAuthRedirectCode,
	verifyGoogleIdToken,
} from "./oauth";
import {
	clearThenRevokeIntegrationTokens,
	prepareEncryptedTokenFields,
} from "./oauth-storage";

const STATE_LIFETIME_MS = 10 * 60 * 1000;

function applicationBaseUrl(): string {
	const nextAuthUrl = process.env.NEXTAUTH_URL;
	if (!nextAuthUrl) {
		throw new GoogleClassroomOAuthError(
			"Application URL is not configured.",
			"configuration",
		);
	}
	return nextAuthUrl;
}

function configuration() {
	const clientId = process.env.GOOGLE_CLASSROOM_CLIENT_ID;
	const clientSecret = process.env.GOOGLE_CLASSROOM_CLIENT_SECRET;
	const nextAuthUrl = applicationBaseUrl();
	if (!clientId || !clientSecret) {
		throw new GoogleClassroomOAuthError(
			"Google Classroom OAuth is not configured.",
			"configuration",
		);
	}

	return {
		clientId,
		clientSecret,
		nextAuthUrl,
		callbackUrl: callbackUrlFromNextAuthUrl(nextAuthUrl),
	};
}

export function assertIntegrationSameOrigin(request: Request): void {
	const origin = request.headers.get("origin");
	const expectedOrigin = new URL(applicationBaseUrl()).origin;
	if (!origin || origin !== expectedOrigin) {
		throw new ApiError("validation_error", 400, "Invalid request origin.");
	}
}

export function integrationRedirectUrl(
	status: "connected" | "error",
	code?: GoogleOAuthRedirectCode,
): string {
	const url = new URL("/settings/integrations", applicationBaseUrl());
	url.searchParams.set("provider", "google_classroom");
	url.searchParams.set("status", status);
	if (status === "error" && code) url.searchParams.set("code", code);
	return url.toString();
}

export async function beginGoogleClassroomAuthorization(
	userId: string,
): Promise<string> {
	const config = configuration();
	const state = createOAuthValue();
	const verifier = createOAuthValue(48);
	const nonce = createOAuthValue();
	const now = new Date();

	await prisma.$transaction([
		prisma.integrationOAuthState.deleteMany({
			where: { expiresAt: { lte: now } },
		}),
		prisma.integrationOAuthState.create({
			data: {
				stateHash: hashOAuthState(state),
				pkceVerifierCiphertext: encryptIntegrationToken(verifier),
				nonce,
				userId,
				provider: "google_classroom",
				expiresAt: new Date(now.getTime() + STATE_LIFETIME_MS),
			},
		}),
	]);

	return buildGoogleClassroomAuthorizationUrl({
		clientId: config.clientId,
		callbackUrl: config.callbackUrl,
		state,
		nonce,
		codeChallenge: createPkceChallenge(verifier),
	});
}

async function consumeOAuthState(userId: string, state: string) {
	try {
		const storedState = await prisma.integrationOAuthState.delete({
			where: { stateHash: hashOAuthState(state) },
		});
		if (
			storedState.userId !== userId ||
			storedState.provider !== "google_classroom" ||
			storedState.expiresAt <= new Date()
		) {
			throw new GoogleClassroomOAuthError("Invalid OAuth state.", "state_invalid");
		}
		return storedState;
	} catch (error) {
		if (error instanceof GoogleClassroomOAuthError) throw error;
		throw new GoogleClassroomOAuthError("Invalid OAuth state.", "state_invalid");
	}
}

async function exchangeAuthorizationCode(input: {
	code: string;
	verifier: string;
}) {
	const config = configuration();
	const response = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: config.clientId,
			client_secret: config.clientSecret,
			code: input.code,
			code_verifier: input.verifier,
			grant_type: "authorization_code",
			redirect_uri: config.callbackUrl,
		}),
	});
	if (!response.ok) {
		throw new GoogleClassroomOAuthError("Google token exchange failed.", "oauth_failed");
	}

	let body: unknown;
	try {
		body = await response.json();
	} catch {
		throw new GoogleClassroomOAuthError("Invalid Google token response.", "oauth_failed");
	}
	return parseGoogleTokenResponse(body);
}

export async function completeGoogleClassroomAuthorization(input: {
	userId: string;
	expectedEmail: string;
	code: string;
	state: string;
}): Promise<void> {
	const config = configuration();
	const storedState = await consumeOAuthState(input.userId, input.state);
	const verifier = decryptIntegrationToken(storedState.pkceVerifierCiphertext);
	const token = await exchangeAuthorizationCode({ code: input.code, verifier });
	const googleIdentity = await verifyGoogleIdToken(token.idToken, {
		nonce: storedState.nonce,
		clientId: config.clientId,
	});
	assertGoogleIdentityMatchesAppUser(googleIdentity, input.expectedEmail);
	const { subject } = googleIdentity;
	const now = new Date();
	const tokenFields = prepareEncryptedTokenFields(token, now);

	await prisma.externalConnection.upsert({
		where: {
			userId_provider_providerAccountId: {
				userId: input.userId,
				provider: "google_classroom",
				providerAccountId: subject,
			},
		},
		create: {
			userId: input.userId,
			provider: "google_classroom",
			providerAccountId: subject,
			...tokenFields,
			refreshTokenCiphertext: tokenFields.refreshTokenCiphertext ?? null,
			refreshTokenExpiresAt: tokenFields.refreshTokenExpiresAt ?? null,
			connectedAt: now,
			revokedAt: null,
			oauthClientKind: "google_classroom",
			healthy: true,
			lastError: null,
		},
		update: {
			accessTokenCiphertext: tokenFields.accessTokenCiphertext,
			...(tokenFields.refreshTokenCiphertext
				? {
						refreshTokenCiphertext: tokenFields.refreshTokenCiphertext,
						refreshTokenExpiresAt:
							tokenFields.refreshTokenExpiresAt ?? null,
					}
				: {}),
			expiresAt: tokenFields.expiresAt,
			tokenType: tokenFields.tokenType,
			scopes: tokenFields.scopes,
			connectedAt: now,
			revokedAt: null,
			oauthClientKind: "google_classroom",
			healthy: true,
			lastError: null,
		},
	});
}

async function revokeGoogleToken(token: string): Promise<void> {
	await fetch("https://oauth2.googleapis.com/revoke", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({ token }),
	});
}

export async function disconnectGoogleClassroom(userId: string): Promise<void> {
	const connections = await prisma.externalConnection.findMany({
		where: { userId, provider: "google_classroom", revokedAt: null },
		select: {
			accessTokenCiphertext: true,
			refreshTokenCiphertext: true,
		},
	});
	const revokedAt = new Date();

	await clearThenRevokeIntegrationTokens({
		credentials: connections,
		clearLocalTokens: async () => {
			await prisma.externalConnection.updateMany({
				where: { userId, provider: "google_classroom" },
				data: {
					accessTokenCiphertext: null,
					refreshTokenCiphertext: null,
					expiresAt: null,
					refreshTokenExpiresAt: null,
					revokedAt,
					healthy: false,
					lastError: null,
				},
			});
		},
		decryptToken: decryptIntegrationToken,
		revokeToken: revokeGoogleToken,
	});
}
