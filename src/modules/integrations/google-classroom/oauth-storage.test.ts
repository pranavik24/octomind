import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
	clearThenRevokeIntegrationTokens,
	prepareEncryptedTokenFields,
} from "./oauth-storage.ts";
import { decryptIntegrationToken } from "../../security/token-crypto.ts";

const originalKey = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;

afterEach(() => {
	if (originalKey === undefined) delete process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
	else process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = originalKey;
});

describe("Google Classroom credential persistence", () => {
	it("encrypts only allowlisted token fields before persistence", () => {
		process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
		const fields = prepareEncryptedTokenFields(
			{
				accessToken: "access-token",
				refreshToken: "refresh-token",
				expiresIn: 3600,
				refreshTokenExpiresIn: 7200,
				tokenType: "Bearer",
				scopes: ["openid", "email"],
				idToken: "must-not-be-persisted",
			},
			new Date("2026-06-21T12:00:00.000Z"),
		);

		assert.deepEqual(Object.keys(fields).sort(), [
			"accessTokenCiphertext",
			"expiresAt",
			"refreshTokenCiphertext",
			"refreshTokenExpiresAt",
			"scopes",
			"tokenType",
		]);
		assert.equal(decryptIntegrationToken(fields.accessTokenCiphertext), "access-token");
		assert.equal(decryptIntegrationToken(fields.refreshTokenCiphertext ?? ""), "refresh-token");
	});

	it("clears local tokens before best-effort provider revocation", async () => {
		const operations: string[] = [];
		await clearThenRevokeIntegrationTokens({
			credentials: [
				{ accessTokenCiphertext: "access-ciphertext", refreshTokenCiphertext: "refresh-ciphertext" },
			],
			clearLocalTokens: async () => { operations.push("clear"); },
			decryptToken: (ciphertext) => { operations.push(`decrypt:${ciphertext}`); return "refresh-token"; },
			revokeToken: async () => { operations.push("revoke"); throw new Error("Google unavailable"); },
		});

		assert.deepEqual(operations, ["clear", "decrypt:refresh-ciphertext", "revoke"]);
	});
});
