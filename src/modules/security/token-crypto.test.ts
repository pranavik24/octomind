import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
	decryptIntegrationToken,
	encryptIntegrationToken,
} from "./token-crypto.ts";

const originalKey = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;

afterEach(() => {
	if (originalKey === undefined) delete process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
	else process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = originalKey;
});

describe("integration token encryption", () => {
	it("round trips tokens with authenticated encryption", () => {
		process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
		const ciphertext = encryptIntegrationToken("google-access-token");

		assert.match(ciphertext, /^enc:v1:/);
		assert.doesNotMatch(ciphertext, /google-access-token/);
		assert.equal(decryptIntegrationToken(ciphertext), "google-access-token");
	});

	it("fails closed when the encryption key is absent", () => {
		delete process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
		assert.throws(
			() => encryptIntegrationToken("must-not-be-plaintext"),
			/INTEGRATION_TOKEN_ENCRYPTION_KEY/,
		);
	});

	it("rejects malformed keys and plaintext token storage", () => {
		process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = "short";
		assert.throws(() => encryptIntegrationToken("token"), /32-byte/);

		process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64");
		assert.throws(() => decryptIntegrationToken("plaintext-token"), /ciphertext/);
	});

	it("never trusts an encryption-prefix lookalike as already encrypted", () => {
		process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 4).toString("base64");
		const lookalike = "enc:v1:not-valid-ciphertext";
		const ciphertext = encryptIntegrationToken(lookalike);

		assert.notEqual(ciphertext, lookalike);
		assert.equal(decryptIntegrationToken(ciphertext), lookalike);
	});
});
