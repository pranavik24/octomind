import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SchedulingError } from "./auth.ts";
import {
	eventCreatePayloadSchema,
	taskCreatePayloadSchema,
} from "./calendar-schemas.ts";
import { createEventsPostHandler } from "../../app/api/events/handlers.ts";
import { createTasksPostHandler } from "../../app/api/tasks/handlers.ts";

const userId = "066dd68c-7327-490b-a2e8-5d319cdd2b06";
const generatedId = "a0cc48a7-892c-47f0-a1f7-9a43e5988873";
const clientId = "cc596816-c7f4-4f99-a368-1c1acddcb474";

const validEvent = {
	startDate: "2026-08-27T13:00:00.000Z",
	endDate: "2026-08-27T14:00:00.000Z",
	title: "Biology lab",
	location: "Room 204",
	color: "School" as const,
};

const validTask = {
	dueDate: "2026-08-28T03:59:00.000Z",
	estimatedHours: 2,
	title: "Finish essay",
	color: "Homework" as const,
};

const request = (url: string, body: unknown) =>
	new Request(url, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});

describe("task and event insertion payloads", () => {
	it("keeps optional event location and defaults its description", () => {
		const parsed = eventCreatePayloadSchema.parse(validEvent);

		assert.equal(parsed.location, "Room 204");
		assert.equal(parsed.description, "");
	});

	it("rejects an event whose end is equal to its start", () => {
		assert.equal(
			eventCreatePayloadSchema.safeParse({
				...validEvent,
				endDate: validEvent.startDate,
			}).success,
			false,
		);
	});

	it("rejects an event whose end is before its start", () => {
		assert.equal(
			eventCreatePayloadSchema.safeParse({
				...validEvent,
				startDate: "2026-08-27T15:00:00.000Z",
				endDate: "2026-08-27T14:00:00.000Z",
			}).success,
			false,
		);
	});

	it("rejects task blocks whose end is not after their start", () => {
		assert.equal(
			taskCreatePayloadSchema.safeParse({
				...validTask,
				scheduledBlocks: [
					{
						startDate: "2026-08-27T13:00:00.000Z",
						endDate: "2026-08-27T12:00:00.000Z",
					},
				],
			}).success,
			false,
		);
	});

	it("rejects missing titles and invalid task dates before persistence", () => {
		assert.equal(
			taskCreatePayloadSchema.safeParse({ ...validTask, title: "" }).success,
			false,
		);
		assert.equal(
			taskCreatePayloadSchema.safeParse({ ...validTask, dueDate: "not-a-date" }).success,
			false,
		);
	});

	it("strips client IDs from both create payloads", () => {
		const event = eventCreatePayloadSchema.parse({ ...validEvent, id: clientId });
		const task = taskCreatePayloadSchema.parse({ ...validTask, id: clientId });

		assert.equal("id" in event, false);
		assert.equal("id" in task, false);
	});
});

describe("POST insertion handlers", () => {
	it("forwards an event with server ID, location, default description, and authenticated user", async () => {
		let persisted: Record<string, unknown> | undefined;
		const handler = createEventsPostHandler({
			requireUserId: async () => userId,
			createId: () => generatedId,
			createEventForUser: async (_user, event) => {
				persisted = event as unknown as Record<string, unknown>;
				return [event];
			},
		});

		const response = await handler(
			request("http://localhost/api/events", { ...validEvent, id: clientId }),
		);

		assert.equal(response.status, 200);
		assert.equal(persisted?.id, generatedId);
		assert.equal(persisted?.location, "Room 204");
		assert.equal(persisted?.description, "");
		assert.deepEqual(persisted?.user, { id: userId, name: "Student", picturePath: null });
	});

	it("does not call the event repository for an invalid interval", async () => {
		let repositoryCalls = 0;
		const handler = createEventsPostHandler({
			requireUserId: async () => userId,
			createId: () => generatedId,
			createEventForUser: async () => {
				repositoryCalls += 1;
				return [];
			},
		});

		const response = await handler(
			request("http://localhost/api/events", {
				...validEvent,
				endDate: validEvent.startDate,
			}),
		);

		assert.equal(response.status, 400);
		assert.equal(repositoryCalls, 0);
	});

	it("returns a scheduling conflict instead of a generic event insertion error", async () => {
		const handler = createEventsPostHandler({
			requireUserId: async () => userId,
			createId: () => generatedId,
			createEventForUser: async () => {
				throw new SchedulingError("The event leaves no schedulable time.");
			},
		});

		const response = await handler(request("http://localhost/api/events", validEvent));

		assert.equal(response.status, 409);
		assert.deepEqual(await response.json(), {
			error: { code: "scheduling_conflict", message: "The event leaves no schedulable time." },
		});
	});

	it("forwards a task with server ID and authenticated user defaults", async () => {
		let persisted: Record<string, unknown> | undefined;
		const handler = createTasksPostHandler({
			requireUserId: async () => userId,
			createId: () => generatedId,
			createTaskForUser: async (_user, task) => {
				persisted = task as unknown as Record<string, unknown>;
				return task;
			},
		});

		const response = await handler(
			request("http://localhost/api/tasks", { ...validTask, id: clientId }),
		);

		assert.equal(response.status, 200);
		assert.equal(persisted?.id, generatedId);
		assert.equal(persisted?.description, "");
		assert.deepEqual(persisted?.user, { id: userId, name: "Student", picturePath: null });
	});

	it("returns a scheduling conflict instead of a generic task insertion error", async () => {
		const handler = createTasksPostHandler({
			requireUserId: async () => userId,
			createId: () => generatedId,
			createTaskForUser: async () => {
				throw new SchedulingError("There is no available time before the deadline.");
			},
		});

		const response = await handler(request("http://localhost/api/tasks", validTask));

		assert.equal(response.status, 409);
		assert.deepEqual(await response.json(), {
			error: { code: "scheduling_conflict", message: "There is no available time before the deadline." },
		});
	});

	it("maps malformed JSON to a validation response without calling persistence", async () => {
		let repositoryCalls = 0;
		const handler = createTasksPostHandler({
			requireUserId: async () => userId,
			createId: () => generatedId,
			createTaskForUser: async () => {
				repositoryCalls += 1;
				return {};
			},
		});

		const response = await handler(
			new Request("http://localhost/api/tasks", {
				method: "POST",
				body: "{not-json",
			}),
		);

		assert.equal(response.status, 400);
		assert.equal(repositoryCalls, 0);
	});
});
