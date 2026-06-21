import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	createTaskDeleteHandler,
	createTaskPatchHandler,
	createTasksPostHandler,
} from "./handlers.ts";

const userId = "066dd68c-7327-490b-a2e8-5d319cdd2b06";
const generatedId = "a0cc48a7-892c-47f0-a1f7-9a43e5988873";
const taskBody = {
	id: "cc596816-c7f4-4f99-a368-1c1acddcb474",
	dueDate: "2026-06-22T03:59:00.000Z",
	title: "Essay",
	color: "Homework",
};

describe("task API security", () => {
	it("ignores a client ID and generates the create ID server-side", async () => {
		let persistedId: string | undefined;
		const handler = createTasksPostHandler({
			requireUserId: async () => userId,
			createId: () => generatedId,
			createTaskForUser: async (_userId, task) => {
				persistedId = task.id;
				return task;
			},
		});

		const response = await handler(
			new Request("http://localhost/api/tasks", {
				method: "POST",
				body: JSON.stringify(taskBody),
			}),
		);

		assert.equal(response.status, 200);
		assert.equal(persistedId, generatedId);
		assert.equal((await response.json()).task.id, generatedId);
	});

	it("rejects malformed route IDs before update or delete repository access", async () => {
		let repositoryCalls = 0;
		const dependencies = {
			requireUserId: async () => userId,
			updateTaskForUser: async () => {
				repositoryCalls += 1;
				return {} as never;
			},
			deleteTaskForUser: async () => {
				repositoryCalls += 1;
			},
		};
		const patch = createTaskPatchHandler(dependencies);
		const remove = createTaskDeleteHandler(dependencies);

		const patchResponse = await patch(
			new Request("http://localhost/api/tasks/bad", {
				method: "PATCH",
				body: JSON.stringify(taskBody),
			}),
			{ params: Promise.resolve({ taskId: "bad" }) },
		);
		const deleteResponse = await remove(
			new Request("http://localhost/api/tasks/bad", { method: "DELETE" }),
			{ params: Promise.resolve({ taskId: "bad" }) },
		);

		assert.equal(patchResponse.status, 400);
		assert.equal(deleteResponse.status, 400);
		assert.equal(repositoryCalls, 0);
	});
});
