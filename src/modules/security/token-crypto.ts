import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";
const IV_BYTES = 12;

function key(): Buffer {
	const encodedKey = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
	if (!encodedKey) {
		throw new Error("INTEGRATION_TOKEN_ENCRYPTION_KEY is required.");
	}

	const encryptionKey = Buffer.from(encodedKey, "base64");
	if (encryptionKey.length !== 32) {
		throw new Error(
			"INTEGRATION_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.",
		);
	}
	return encryptionKey;
}

export function encryptIntegrationToken(value: string): string {
	if (!value) throw new Error("Integration token must not be empty.");

	const iv = randomBytes(IV_BYTES);
	const cipher = createCipheriv("aes-256-gcm", key(), iv);
	const encrypted = Buffer.concat([
		cipher.update(value, "utf8"),
		cipher.final(),
	]);
	const tag = cipher.getAuthTag();

	return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptIntegrationToken(value: string): string {
	if (!value.startsWith(PREFIX)) {
		throw new Error("Integration token is not valid ciphertext.");
	}

	const [, , ivText, tagText, encryptedText] = value.split(":");
	if (!ivText || !tagText || !encryptedText) {
		throw new Error("Integration token ciphertext is malformed.");
	}
	const decipher = createDecipheriv(
		"aes-256-gcm",
		key(),
		Buffer.from(ivText, "base64url"),
	);
	decipher.setAuthTag(Buffer.from(tagText, "base64url"));

	return Buffer.concat([
		decipher.update(Buffer.from(encryptedText, "base64url")),
		decipher.final(),
	]).toString("utf8");
}

export function encryptSecret(value: string): string;
export function encryptSecret(value: null | undefined): null;
export function encryptSecret(value: string | null | undefined): string | null {
	return value ? encryptIntegrationToken(value) : null;
}

export function decryptSecret(value: string): string;
export function decryptSecret(value: null | undefined): null;
export function decryptSecret(value: string | null | undefined): string | null {
	return value ? decryptIntegrationToken(value) : null;
}
