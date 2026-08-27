import { encryptIntegrationToken } from "@/modules/security/token-crypto";
import type { GoogleTokenResponse } from "./oauth";

export type StoredIntegrationCredential = {
	accessTokenCiphertext: string | null;
	refreshTokenCiphertext: string | null;
};

export function prepareEncryptedTokenFields(
	token: GoogleTokenResponse,
	now: Date,
) {
	return {
		accessTokenCiphertext: encryptIntegrationToken(token.accessToken),
		refreshTokenCiphertext: token.refreshToken
			? encryptIntegrationToken(token.refreshToken)
			: undefined,
		expiresAt: new Date(now.getTime() + token.expiresIn * 1000),
		refreshTokenExpiresAt: token.refreshTokenExpiresIn
			? new Date(now.getTime() + token.refreshTokenExpiresIn * 1000)
			: undefined,
		tokenType: token.tokenType,
		scopes: [...token.scopes],
	};
}

export async function clearThenRevokeIntegrationTokens(input: {
	credentials: StoredIntegrationCredential[];
	clearLocalTokens: () => Promise<void>;
	decryptToken: (ciphertext: string) => string;
	revokeToken: (token: string) => Promise<void>;
}): Promise<void> {
	await input.clearLocalTokens();
	await Promise.allSettled(
		input.credentials.map(async (credential) => {
			const ciphertext =
				credential.refreshTokenCiphertext ?? credential.accessTokenCiphertext;
			if (!ciphertext) return;
			try {
				await input.revokeToken(input.decryptToken(ciphertext));
			} catch {
				// The local token clear is authoritative; provider revocation is best effort.
			}
		}),
	);
}
