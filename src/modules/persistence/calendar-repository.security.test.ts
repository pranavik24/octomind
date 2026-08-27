import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { prisma } from "../../lib/prisma.ts";
import { NotFoundError, SchedulingError } from "../api/auth.ts";
import {
	createTaskForUser,
	deleteEventForUser,
	deleteTaskForUser,
	updateEventForUser,
	updateTaskForUser,
} from "./calendar-repository.ts";

const database = prisma as unknown as {
	$transaction: unknown;
	user: { findUnique: unknown };
	event: { findFirst: unknown; findMany: unknown };
	task: { findFirst: unknown; findMany: unknown; deleteMany: unknown };
};
const userId = "066dd68c-7327-490b-a2e8-5d319cdd2b06";
const recordId = "a0cc48a7-892c-47f0-a1f7-9a43e5988873";
const user = {
	id: userId,
	email: "student@example.com",
	name: "Student",
	image: null,
	timezone: "America/New_York",
};
const event = {
	id: recordId,
	startDate: "2099-06-20T13:00:00.000Z",
	endDate: "2099-06-20T14:00:00.000Z",
	title: "Class",
	color: "School" as const,
	description: "",
	user: { id: userId, name: "Student", picturePath: null },
};
const task = {
	id: recordId,
	dueDate: "2099-06-22T03:59:00.000Z",
	estimatedHours: 1,
	title: "Essay",
	color: "Homework" as const,
	description: "",
	user: { id: userId, name: "Student", picturePath: null },
};

const originals = {
	transaction: database.$transaction,
	userFindUnique: database.user.findUnique,
	eventFindFirst: database.event.findFirst,
	eventFindMany: database.event.findMany,
	taskFindFirst: database.task.findFirst,
	taskFindMany: database.task.findMany,
	taskDeleteMany: database.task.deleteMany,
};

let transactionCalls = 0;
let directDeleteCalls = 0;

beforeEach(() => {
	transactionCalls = 0;
	directDeleteCalls = 0;
	database.user.findUnique = async () => user;
	database.event.findFirst = async () => null;
	database.event.findMany = async () => [];
	database.task.findFirst = async () => null;
	database.task.findMany = async () => [];
	database.task.deleteMany = async () => {
		directDeleteCalls += 1;
		return { count: 0 };
	};
	database.$transaction = async () => {
		transactionCalls += 1;
	};
});

afterEach(() => {
	database.$transaction = originals.transaction;
	database.user.findUnique = originals.userFindUnique;
	database.event.findFirst = originals.eventFindFirst;
	database.event.findMany = originals.eventFindMany;
	database.task.findFirst = originals.taskFindFirst;
	database.task.findMany = originals.taskFindMany;
	database.task.deleteMany = originals.taskDeleteMany;
});

describe("repository ownership enforcement", () => {
	it("denies foreign event updates and deletes before transactions", async () => {
		await assert.rejects(
			updateEventForUser(userId, recordId, event),
			NotFoundError,
		);
		await assert.rejects(deleteEventForUser(userId, recordId), NotFoundError);
		assert.equal(transactionCalls, 0);
	});

	it("denies foreign task updates and deletes before writes", async () => {
		await assert.rejects(
			updateTaskForUser(userId, recordId, task),
			NotFoundError,
		);
		await assert.rejects(deleteTaskForUser(userId, recordId), NotFoundError);
		assert.equal(transactionCalls, 0);
		assert.equal(directDeleteCalls, 0);
	});
});

describe("repository transactional scheduling", () => {
	it("does not let a past-due active task block a new task", async () => {
		database.task.findMany = async () =>
			[
				{
					id: "past-due-task",
					title: "Old essay",
					description: "",
					color: "Homework",
					dueAt: new Date("2000-01-01T00:00:00.000Z"),
					estimatedMinutes: 60,
					blocks: [],
				},
			] as never;

		let createdId: string | undefined;
		database.$transaction = async (
			operation: (tx: unknown) => Promise<void>,
		) => {
			transactionCalls += 1;
			await operation({
				task: {
					create: async ({ data }: { data: { id: string } }) => {
						createdId = data.id;
					},
				},
				taskBlock: {
					deleteMany: async () => ({ count: 0 }),
					createMany: async () => ({ count: 1 }),
				},
			});
		};

		const createdTask = await createTaskForUser(userId, task);

		assert.equal(transactionCalls, 1);
		assert.equal(createdTask.id, createdId);
	});

	it("discards a supplied task UUID and never performs an ID-only upsert", async () => {
		let createdId: string | undefined;
		let upsertCalls = 0;
		database.$transaction = async (
			operation: (tx: unknown) => Promise<void>,
		) => {
			transactionCalls += 1;
			await operation({
				task: {
					create: async ({ data }: { data: { id: string } }) => {
						createdId = data.id;
					},
					upsert: async () => {
						upsertCalls += 1;
					},
				},
				taskBlock: {
					deleteMany: async () => ({ count: 0 }),
					createMany: async () => ({ count: 1 }),
				},
			});
		};

		const createdTask = await createTaskForUser(userId, task);

		assert.equal(transactionCalls, 1);
		assert.notEqual(createdId, recordId);
		assert.equal(createdTask.id, createdId);
		assert.equal(upsertCalls, 0);
	});

	it("persists no task or task blocks when scheduling is impossible", async () => {
		const impossibleTask = {
			...task,
			dueDate: "2000-01-01T00:00:00.000Z",
		};

		await assert.rejects(
			createTaskForUser(userId, impossibleTask),
			SchedulingError,
		);
		assert.equal(transactionCalls, 0);
		assert.equal(directDeleteCalls, 0);
	});
});
