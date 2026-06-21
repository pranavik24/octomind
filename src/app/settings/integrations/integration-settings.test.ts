import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { callbackMessageFor } from "./classroom-messages.ts";

const projectRoot = resolve(import.meta.dirname, "../../../..");

describe("Classroom integration settings", () => {
	it("maps allowlisted callback errors to friendly messages", () => {
		assert.match(callbackMessageFor("access_denied") ?? "", /cancelled/i);
		assert.match(
			callbackMessageFor("test_user_restricted") ?? "",
			/test user/i,
		);
		assert.match(callbackMessageFor("test_user") ?? "", /test user/i);
		assert.match(callbackMessageFor("admin_policy") ?? "", /administrator/i);
		assert.match(
			callbackMessageFor("admin_restricted") ?? "",
			/administrator/i,
		);
		assert.match(callbackMessageFor("token_revoked") ?? "", /reconnect/i);
		assert.match(
			callbackMessageFor("anything-else") ?? "",
			/could not connect/i,
		);
	});

	it("renders lifecycle controls and the beta fallback message", () => {
		const source = readFileSync(
			resolve(import.meta.dirname, "classroom-integration-card.tsx"),
			"utf8",
		);
		const normalizedSource = source.replace(/\s+/g, " ");
		assert.match(normalizedSource, /\bConnect\b/);
		assert.match(normalizedSource, /\bReconnect\b/);
		assert.match(normalizedSource, /\bSync now\b/);
		assert.match(normalizedSource, /\bDisconnect\b/);
		assert.match(
			normalizedSource,
			/Google Classroom import is currently in beta\. You can still use the scheduler by manually adding tasks\./,
		);
	});

	it("replaces the calendar sync button with an integrations settings link", () => {
		const source = readFileSync(
			resolve(
				projectRoot,
				"src/modules/components/calendar/header/calendar-header.tsx",
			),
			"utf8",
		);
		assert.doesNotMatch(source, /ClassroomSyncButton/);
		assert.match(source, /href=["']\/settings\/integrations["']/);
	});
});
