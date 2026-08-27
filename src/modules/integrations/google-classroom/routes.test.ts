import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("Google Classroom route contract", () => {
	it("exposes the disconnect DELETE route and keeps the root alias", () => {
		const disconnect = readFileSync(
			new URL("../../../app/api/integrations/google-classroom/disconnect/route.ts", import.meta.url),
			"utf8",
		);
		const root = readFileSync(
			new URL("../../../app/api/integrations/google-classroom/route.ts", import.meta.url),
			"utf8",
		);

		assert.match(disconnect, /export\s*\{\s*DELETE\s*\}/);
		assert.match(root, /export const DELETE/);
	});
});
