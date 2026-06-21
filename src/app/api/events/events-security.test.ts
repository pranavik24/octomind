import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "../../../modules/api/auth.ts";
import {
	createEventDeleteHandler,
	createEventPatchHandler,
	createEventsPostHandler,
} from "./handlers.ts";

const userId = "066dd68c-7327-490b-a2e8-5d319cdd2b06";
const generatedId = "a0cc48a7-892c-47f0-a1f7-9a43e5988873";

const eventBody = {
	id: "cc596816-c7f4-4f99-a368-1c1acddcb474",
	startDate: "2026-06-20T13:00:00.000Z",
	endDate: "2026-06-20T14:00:00.000Z",
	title: "Class",
	color: "School" as const,
};

describe("event API security", () => {
	it("returns a sanitized 401 without repository access when unauthenticated", async () => {
		let repositoryCalls = 0;
		const handler = createEventsPostHandler({
			requireUserId: async () => {
				throw new ApiError("unauthorized", 401, "Authentication required.");
			},
			createId: () => generatedId,
			createEventForUser: async () => {
				repositoryCalls += 1;
				return [eventBody] as never;
			},
		});

		const response = await handler(
			new Request("http://localhost/api/events", {
				method: "POST",
				body: JSON.stringify(eventBody),
			}),
		);

		assert.equal(response.status, 401);
		assert.equal(repositoryCalls, 0);
		assert.deepEqual(await response.json(), {
			error: { code: "unauthorized", message: "Authentication required." },
		});
	});

	it("ignores a client ID and generates the create ID server-side", async () => {
		let persistedId: string | undefined;
		const handler = createEventsPostHandler({
			requireUserId: async () => userId,
			createId: () => generatedId,
			createEventForUser: async (_userId, event) => {
				persistedId = event.id;
				return [event];
			},
		});

		const response = await handler(
			new Request("http://localhost/api/events", {
				method: "POST",
				body: JSON.stringify(eventBody),
			}),
		);

		assert.equal(response.status, 200);
		assert.equal(persistedId, generatedId);
		assert.equal((await response.json()).events[0].id, generatedId);
	});

	it("returns the persisted event after an update", async () => {
		const updatedEvent = {
			...eventBody,
			id: generatedId,
			title: "Updated class",
			description: "",
			user: { id: userId, name: "Student", picturePath: null },
		};
		const handler = createEventPatchHandler({
			requireUserId: async () => userId,
			updateEventForUser: async () => updatedEvent,
			deleteEventForUser: async () => undefined,
		});

		const response = await handler(
			new Request(`http://localhost/api/events/${generatedId}`, {
				method: "PATCH",
				body: JSON.stringify(updatedEvent),
			}),
			{ params: Promise.resolve({ eventId: generatedId }) },
		);

		assert.equal(response.status, 200);
		assert.deepEqual((await response.json()).event, updatedEvent);
	});

	it("rejects malformed route IDs before update or delete repository access", async () => {
		let repositoryCalls = 0;
		const dependencies = {
			requireUserId: async () => userId,
			updateEventForUser: async () => {
				repositoryCalls += 1;
				return {} as never;
			},
			deleteEventForUser: async () => {
				repositoryCalls += 1;
			},
		};
		const patch = createEventPatchHandler(dependencies);
		const remove = createEventDeleteHandler(dependencies);

		const patchResponse = await patch(
			new Request("http://localhost/api/events/bad", {
				method: "PATCH",
				body: JSON.stringify(eventBody),
			}),
			{ params: Promise.resolve({ eventId: "bad" }) },
		);
		const deleteResponse = await remove(
			new Request("http://localhost/api/events/bad", { method: "DELETE" }),
			{ params: Promise.resolve({ eventId: "bad" }) },
		);

		assert.equal(patchResponse.status, 400);
		assert.equal(deleteResponse.status, 400);
		assert.equal(repositoryCalls, 0);
	});
});
