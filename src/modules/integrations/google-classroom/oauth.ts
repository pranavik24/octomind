import { createHash, randomBytes } from "node:crypto";
import {
	createRemoteJWKSet,
	jwtVerify,
	type JWTVerifyGetKey,
} from "jose";

const googleJwks = createRemoteJWKSet(
	new URL("https://www.googleapis.com/oauth2/v3/certs"),
	{ timeoutDuration: 5_000, cooldownDuration: 30_000 },
);

export const GOOGLE_CLASSROOM_SCOPES = [
	"openid",
	"email",
	"https://www.googleapis.com/auth/classroom.courses.readonly",
	"https://www.googleapis.com/auth/classroom.coursework.me.readonly",
] as const;

export type GoogleOAuthRedirectCode =
	| "denied"
	| "test_user"
	| "admin_restricted"
	| "state_invalid"
	| "configuration"
	| "oauth_failed"
	| "account_mismatch"
	| "unauthorized";

export type GoogleTokenResponse = {
	accessToken: string;
	refreshToken?: string;
	expiresIn: number;
	refreshTokenExpiresIn?: number;
	tokenType: string;
	scopes: string[];
	idToken: string;
};

export class GoogleClassroomOAuthError extends Error {
	readonly redirectCode: GoogleOAuthRedirectCode;

	constructor(
		message: string,
		redirectCode: GoogleOAuthRedirectCode,
	) {
		super(message);
		this.name = "GoogleClassroomOAuthError";
		this.redirectCode = redirectCode;
	}
}

function requiredString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function positiveNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) && value > 0
		? value
		: undefined;
}

export function hashOAuthState(state: string): string {
	return createHash("sha256").update(state).digest("base64url");
}

export function createOAuthValue(bytes = 32): string {
	return randomBytes(bytes).toString("base64url");
}

export function createPkceChallenge(verifier: string): string {
	return createHash("sha256").update(verifier).digest("base64url");
}

export function callbackUrlFromNextAuthUrl(nextAuthUrl: string): string {
	return new URL(
		"/api/integrations/google-classroom/callback",
		nextAuthUrl,
	).toString();
}

export function buildGoogleClassroomAuthorizationUrl(input: {
	clientId: string;
	callbackUrl: string;
	state: string;
	nonce: string;
	codeChallenge: string;
}): string {
	const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
	url.search = new URLSearchParams({
		client_id: input.clientId,
		redirect_uri: input.callbackUrl,
		response_type: "code",
		scope: GOOGLE_CLASSROOM_SCOPES.join(" "),
		access_type: "offline",
		prompt: "consent",
		include_granted_scopes: "false",
		state: input.state,
		nonce: input.nonce,
		code_challenge: input.codeChallenge,
		code_challenge_method: "S256",
	}).toString();
	return url.toString();
}

export function parseGoogleTokenResponse(value: unknown): GoogleTokenResponse {
	if (!value || typeof value !== "object") {
		throw new GoogleClassroomOAuthError("Invalid Google token response.", "oauth_failed");
	}

	const response = value as Record<string, unknown>;
	const accessToken = requiredString(response.access_token);
	const expiresIn = positiveNumber(response.expires_in);
	const tokenType = requiredString(response.token_type);
	const scope = requiredString(response.scope);
	const idToken = requiredString(response.id_token);
	if (!accessToken || !expiresIn || !tokenType || !scope || !idToken) {
		throw new GoogleClassroomOAuthError("Invalid Google token response.", "oauth_failed");
	}

	return {
		accessToken,
		...(requiredString(response.refresh_token)
			? { refreshToken: requiredString(response.refresh_token) }
			: {}),
		expiresIn,
		...(positiveNumber(response.refresh_token_expires_in)
			? { refreshTokenExpiresIn: positiveNumber(response.refresh_token_expires_in) }
			: {}),
		tokenType,
		scopes: scope.split(/\s+/).filter(Boolean),
		idToken,
	};
}

export async function verifyGoogleIdToken(
	idToken: string,
	expected: {
		nonce: string;
		clientId: string;
		keySet?: JWTVerifyGetKey;
	},
): Promise<{ subject: string; email: string; emailVerified: true }> {
	try {
		const { payload } = await jwtVerify(
			idToken,
			expected.keySet ?? googleJwks,
			{
				algorithms: ["RS256"],
				issuer: ["https://accounts.google.com", "accounts.google.com"],
				audience: expected.clientId,
				requiredClaims: ["sub", "exp", "nonce", "email", "email_verified"],
				clockTolerance: 5,
			},
		);
		if (
			payload.nonce !== expected.nonce ||
			!requiredString(payload.sub) ||
			!requiredString(payload.email) ||
			payload.email_verified !== true
		) {
			throw new Error("Unexpected claims.");
		}
		return {
			subject: payload.sub as string,
			email: payload.email as string,
			emailVerified: true,
		};
	} catch {
		throw new GoogleClassroomOAuthError("Invalid Google ID token.", "oauth_failed");
	}
}

export function assertGoogleIdentityMatchesAppUser(
	googleIdentity: { email: string; emailVerified: boolean },
	expectedEmail: string,
): void {
	if (
		!googleIdentity.emailVerified ||
		googleIdentity.email.trim().toLowerCase() !==
			expectedEmail.trim().toLowerCase()
	) {
		throw new GoogleClassroomOAuthError(
			"Google Classroom must use the signed-in account.",
			"account_mismatch",
		);
	}
}

export function classifyGoogleOAuthError(
	error: string | null,
	description: string | null,
): GoogleOAuthRedirectCode {
	if (error === "admin_policy_enforced" || error === "org_internal") {
		return "admin_restricted";
	}
	if (error === "access_denied") {
		if (/administrator|admin policy|organization/i.test(description ?? "")) {
			return "admin_restricted";
		}
		if (/test users?|testing mode|developer/i.test(description ?? "")) {
			return "test_user";
		}
		return "denied";
	}
	return "oauth_failed";
}

export function callbackErrorCode(error: unknown): GoogleOAuthRedirectCode {
	if (error instanceof GoogleClassroomOAuthError) return error.redirectCode;
	if (error instanceof Error && /Authentication required/i.test(error.message)) {
		return "unauthorized";
	}
	return "oauth_failed";
}
