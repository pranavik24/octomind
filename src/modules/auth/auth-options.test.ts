import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(new URL("./auth-options.ts", import.meta.url), "utf8");

describe("basic Google authentication", () => {
	it("requests only OpenID identity scopes", () => {
		assert.match(source, /const basicGoogleScopes = \[\s*"openid",\s*"email",\s*"profile",?\s*\]/);
		assert.doesNotMatch(source, /classroom\.courses\.readonly/);
		assert.doesNotMatch(source, /classroom\.coursework\.me\.readonly/);
	});

	it("does not force offline access or consent", () => {
		assert.doesNotMatch(source, /access_type/);
		assert.doesNotMatch(source, /prompt:\s*"consent"/);
	});

	it("keeps the authenticated user ID available for JWT sessions", () => {
		assert.match(source, /session\(\{ session, user, token \}\)/);
		assert.match(source, /const userId = user\?\.id \?\? token\.sub/);
	});
});
