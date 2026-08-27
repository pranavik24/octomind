import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prepareAccountForPersistence } from "./secure-prisma-adapter.ts";

describe("secure Prisma adapter", () => {
	it("persists identity linkage fields without OAuth tokens or provider extras", () => {
		const prepared = prepareAccountForPersistence({
			userId: "066dd68c-7327-490b-a2e8-5d319cdd2b06",
			type: "oauth",
			provider: "google",
			providerAccountId: "google-account-id",
			access_token: "access-token",
			refresh_token: "refresh-token",
			id_token: "id-token",
			expires_at: 123,
			refresh_token_expires_in: 604_799,
			token_type: "Bearer",
			scope: "openid email profile",
			session_state: null,
			unexpected_provider_field: "must-not-reach-prisma",
		});

		assert.equal("unexpected_provider_field" in prepared, false);
		assert.deepEqual(prepared, {
			userId: "066dd68c-7327-490b-a2e8-5d319cdd2b06",
			type: "oauth",
			provider: "google",
			providerAccountId: "google-account-id",
		});
	});
});
