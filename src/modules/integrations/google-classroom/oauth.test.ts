import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	createLocalJWKSet,
	exportJWK,
	generateKeyPair,
	SignJWT,
} from "jose";
import {
	assertGoogleIdentityMatchesAppUser,
	buildGoogleClassroomAuthorizationUrl,
	classifyGoogleOAuthError,
	parseGoogleTokenResponse,
	verifyGoogleIdToken,
} from "./oauth.ts";

describe("Google Classroom OAuth", () => {
	it("uses a separate client, exact callback, PKCE, nonce, and narrow offline scopes", () => {
		const authorizationUrl = new URL(
			buildGoogleClassroomAuthorizationUrl({
				clientId: "classroom-client",
				callbackUrl: "https://octomind.test/api/integrations/google-classroom/callback",
				state: "state-value",
				nonce: "nonce-value",
				codeChallenge: "pkce-challenge",
			}),
		);

		assert.equal(authorizationUrl.searchParams.get("client_id"), "classroom-client");
		assert.equal(authorizationUrl.searchParams.get("redirect_uri"), "https://octomind.test/api/integrations/google-classroom/callback");
		assert.equal(authorizationUrl.searchParams.get("access_type"), "offline");
		assert.equal(authorizationUrl.searchParams.get("prompt"), "consent");
		assert.equal(authorizationUrl.searchParams.get("include_granted_scopes"), "false");
		assert.equal(authorizationUrl.searchParams.get("code_challenge_method"), "S256");
		assert.equal(authorizationUrl.searchParams.get("nonce"), "nonce-value");
		assert.equal(
			authorizationUrl.searchParams.get("scope"),
			"openid email https://www.googleapis.com/auth/classroom.courses.readonly https://www.googleapis.com/auth/classroom.coursework.me.readonly",
		);
	});

	it("whitelists and validates token response fields", () => {
		const token = parseGoogleTokenResponse({
			access_token: "access",
			refresh_token: "refresh",
			expires_in: 3600,
			refresh_token_expires_in: 604800,
			token_type: "Bearer",
			scope: "openid email",
			id_token: "id-token",
			unexpected: "discard",
		});

		assert.deepEqual(token, {
			accessToken: "access",
			refreshToken: "refresh",
			expiresIn: 3600,
			refreshTokenExpiresIn: 604800,
			tokenType: "Bearer",
			scopes: ["openid", "email"],
			idToken: "id-token",
		});
		assert.throws(() => parseGoogleTokenResponse({ access_token: "access" }), /token response/i);
	});

	it("verifies the signature and OpenID claims with a JWKS verifier", async () => {
		const { publicKey, privateKey } = await generateKeyPair("RS256");
		const jwk = await exportJWK(publicKey);
		jwk.kid = "google-test-key";
		jwk.alg = "RS256";
		const token = await new SignJWT({
			nonce: "nonce-value",
			email: "student@example.com",
			email_verified: true,
		})
			.setProtectedHeader({ alg: "RS256", kid: "google-test-key" })
			.setIssuer("https://accounts.google.com")
			.setAudience("classroom-client")
			.setSubject("google-user-id")
			.setExpirationTime("5m")
			.sign(privateKey);

		const claims = await verifyGoogleIdToken(token, {
			nonce: "nonce-value",
			clientId: "classroom-client",
			keySet: createLocalJWKSet({ keys: [jwk] }),
		});

		assert.deepEqual(claims, {
			subject: "google-user-id",
			email: "student@example.com",
			emailVerified: true,
		});
	});

	it("rejects an ID token signed by an untrusted key", async () => {
		const trusted = await generateKeyPair("RS256");
		const attacker = await generateKeyPair("RS256");
		const trustedJwk = await exportJWK(trusted.publicKey);
		trustedJwk.kid = "trusted";
		trustedJwk.alg = "RS256";
		const forged = await new SignJWT({
			nonce: "nonce-value",
			email: "student@example.com",
			email_verified: true,
		})
			.setProtectedHeader({ alg: "RS256", kid: "trusted" })
			.setIssuer("https://accounts.google.com")
			.setAudience("classroom-client")
			.setSubject("attacker")
			.setExpirationTime("5m")
			.sign(attacker.privateKey);

		await assert.rejects(
			() =>
				verifyGoogleIdToken(forged, {
					nonce: "nonce-value",
					clientId: "classroom-client",
					keySet: createLocalJWKSet({ keys: [trustedJwk] }),
				}),
			/ID token/i,
		);
	});

	it("rejects an integration identity that does not match the signed-in user", () => {
		assert.doesNotThrow(() =>
			assertGoogleIdentityMatchesAppUser(
				{ email: "Student@Example.com", emailVerified: true },
				"student@example.com",
			),
		);
		assert.throws(
			() =>
				assertGoogleIdentityMatchesAppUser(
					{ email: "other@example.com", emailVerified: true },
					"student@example.com",
				),
			/account/i,
		);
		assert.throws(
			() =>
				assertGoogleIdentityMatchesAppUser(
					{ email: "student@example.com", emailVerified: false },
					"student@example.com",
				),
			/account/i,
		);
	});

	it("maps provider errors to a small redirect allowlist", () => {
		assert.equal(classifyGoogleOAuthError("access_denied", "User denied access"), "denied");
		assert.equal(classifyGoogleOAuthError("access_denied", "App is limited to test users"), "test_user");
		assert.equal(classifyGoogleOAuthError("admin_policy_enforced", "blocked"), "admin_restricted");
		assert.equal(classifyGoogleOAuthError("access_denied", "Access blocked by your administrator"), "admin_restricted");
		assert.equal(classifyGoogleOAuthError("attacker-controlled", "<script>"), "oauth_failed");
	});
});
