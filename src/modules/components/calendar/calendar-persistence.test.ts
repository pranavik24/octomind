import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	createPersistedEvent,
	createPersistedTask,
	deletePersistedEvent,
	deletePersistedTask,
	updatePersistedEvent,
	updatePersistedTask,
} from "./calendar-persistence.ts";

const user = { id: "user", name: "Student", picturePath: null };
const event = {
	id: "client-event",
	startDate: "2026-06-21T13:00:00.000Z",
	endDate: "2026-06-21T14:00:00.000Z",
	title: "Class",
	color: "School" as const,
	description: "",
	user,
};
const task = {
	id: "server-task",
	dueDate: "2026-06-22T03:59:00.000Z",
	estimatedHours: 2,
	title: "Essay",
	color: "Homework" as const,
	description: "",
	user,
};

describe("calendar persistence client", () => {
	it("returns server-authoritative IDs after event creation", async () => {
		const serverEvent = { ...event, id: "server-event" };
		const events = await createPersistedEvent(event, async (_url, init) => {
			assert.equal(init?.method, "POST");
			return Response.json({ events: [serverEvent] });
		});
		assert.deepEqual(events, [serverEvent]);
	});

	it("waits for successful event and task deletion", async () => {
		const requests: string[] = [];
		const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
			requests.push(`${init?.method}:${String(url)}`);
			return Response.json({ ok: true });
		};
		await deletePersistedEvent("event-id", fetcher);
		await deletePersistedTask("task-id", fetcher);
		assert.deepEqual(requests, [
			"DELETE:/api/events/event-id",
			"DELETE:/api/tasks/task-id",
		]);
	});

	it("returns database records after task creation and event or task edits", async () => {
		const updatedEvent = { ...event, id: "server-event", title: "Lab" };
		const updatedTask = { ...task, title: "Revised essay" };
		const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
			if (String(url) === "/api/tasks" && init?.method === "POST") {
				return Response.json({ task });
			}
			if (String(url) === "/api/events/server-event") {
				return Response.json({ event: updatedEvent });
			}
			return Response.json({ task: updatedTask });
		};

		assert.deepEqual(await createPersistedTask(task, fetcher), task);
		assert.deepEqual(
			await updatePersistedEvent(updatedEvent, fetcher),
			updatedEvent,
		);
		assert.deepEqual(
			await updatePersistedTask(updatedTask, fetcher),
			updatedTask,
		);
	});

	it("keeps failed deletes and edits visible by rejecting API errors", async () => {
		const failingFetch = async () =>
			Response.json(
				{ error: { message: "Record not found." } },
				{ status: 404 },
			);
		await assert.rejects(
			deletePersistedEvent("missing", failingFetch),
			/Record not found/,
		);
		await assert.rejects(
			updatePersistedTask(task, failingFetch),
			/Record not found/,
		);
	});
});
