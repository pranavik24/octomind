import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { prisma } from "../../lib/prisma.ts";
import { SchedulingError } from "../api/auth.ts";
import {
	createEventForUser,
	createTaskForUser,
} from "./calendar-repository.ts";

const database = prisma as unknown as {
	$transaction: unknown;
	user: { findUnique: unknown };
	event: { findMany: unknown };
	task: { findMany: unknown };
};

const userId = "066dd68c-7327-490b-a2e8-5d319cdd2b06";
const user = {
	id: userId,
	email: "student@example.com",
	name: "Student",
	image: null,
	timezone: "America/New_York",
};

const event = {
	id: "client-event-id",
	startDate: "2099-06-20T13:00:00.000Z",
	endDate: "2099-06-20T14:00:00.000Z",
	title: "Biology lab",
	location: "Room 204",
	color: "School" as const,
	description: "Bring goggles",
	user: { id: userId, name: "Student", picturePath: null },
};

const task = {
	id: "client-task-id",
	dueDate: "2099-06-22T03:59:00.000Z",
	estimatedHours: 1,
	title: "Finish essay",
	color: "Homework" as const,
	description: "Use the assigned sources",
	user: { id: userId, name: "Student", picturePath: null },
};

const originals = {
	transaction: database.$transaction,
	userFindUnique: database.user.findUnique,
	eventFindMany: database.event.findMany,
	taskFindMany: database.task.findMany,
};

beforeEach(() => {
	database.user.findUnique = async () => user;
	database.event.findMany = async () => [];
	database.task.findMany = async () => [];
});

afterEach(() => {
	database.$transaction = originals.transaction;
	database.user.findUnique = originals.userFindUnique;
	database.event.findMany = originals.eventFindMany;
	database.task.findMany = originals.taskFindMany;
});

describe("repository event insertion", () => {
	it("persists a valid event with its user-owned fields", async () => {
		let rows: Array<Record<string, unknown>> = [];
		database.$transaction = async (
			operation: (tx: unknown) => Promise<void>,
		) => {
			await operation({
				event: {
					createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
						rows = data;
					},
				},
				taskBlock: {
					deleteMany: async () => ({ count: 0 }),
					createMany: async () => ({ count: 0 }),
				},
			});
		};

		const created = await createEventForUser(userId, event);

		assert.equal(created.length, 1);
		assert.equal(rows.length, 1);
		assert.equal(rows[0].userId, userId);
		assert.equal(rows[0].title, "Biology lab");
		assert.equal(rows[0].location, "Room 204");
		assert.equal((rows[0].startAt as Date).toISOString(), event.startDate);
		assert.equal((rows[0].endAt as Date).toISOString(), event.endDate);
		assert.equal(rows[0].id, created[0].id);
	});

	it("expands a recurring event into individually persisted occurrences", async () => {
		let rows: Array<Record<string, unknown>> = [];
		database.$transaction = async (
			operation: (tx: unknown) => Promise<void>,
		) => {
			await operation({
				event: {
					createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
						rows = data;
					},
				},
				taskBlock: {
					deleteMany: async () => ({ count: 0 }),
					createMany: async () => ({ count: 0 }),
				},
			});
		};

		const created = await createEventForUser(userId, {
			...event,
			recurrence: { freq: "daily", count: 3 },
		});

		assert.equal(created.length, 3);
		assert.equal(rows.length, 3);
		assert.equal(new Set(rows.map((row) => row.id)).size, 3);
		assert.deepEqual(
			rows.map((row) => (row.startAt as Date).toISOString()),
			[
				"2099-06-20T13:00:00.000Z",
				"2099-06-21T13:00:00.000Z",
				"2099-06-22T13:00:00.000Z",
			],
		);
	});

	it("persists an event during school hours when re-planning has no capacity", async () => {
		const now = new Date();
		const schoolStart = new Date(now.getTime() - 60 * 60 * 1000);
		const schoolEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
		const dueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
		let eventRows: Array<Record<string, unknown>> = [];
		let taskBlockWrites = 0;

		database.event.findMany = async () => [
			{
				id: "school-hours",
				title: "School",
				description: "Regular school hours",
				location: "School",
				color: "School",
				startAt: schoolStart,
				endAt: schoolEnd,
			},
		] as never;
		database.task.findMany = async () => [
			{
				id: "blocked-task",
				title: "Essay",
				description: "",
				color: "Homework",
				dueAt: dueDate,
				estimatedMinutes: 480,
				blocks: [],
			},
		] as never;
		database.$transaction = async (
			operation: (tx: unknown) => Promise<void>,
		) => {
			await operation({
				event: {
					createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
						eventRows = data;
					},
				},
				taskBlock: {
					deleteMany: async () => ({ count: 0 }),
					createMany: async () => {
						taskBlockWrites += 1;
						return { count: 0 };
					},
				},
			});
		};

		const created = await createEventForUser(userId, {
			...event,
			startDate: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
			endDate: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
		});

		assert.equal(created.length, 1);
		assert.equal(eventRows.length, 1);
		assert.equal(taskBlockWrites, 0);
	});

	it("keeps scheduling conflicts for events outside school hours", async () => {
		const now = new Date();
		const schoolStart = new Date(now.getTime() - 60 * 60 * 1000);
		const schoolEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
		const dueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
		let transactionCalls = 0;

		database.event.findMany = async () => [
			{
				id: "school-hours",
				title: "School",
				description: "Regular school hours",
				location: "School",
				color: "School",
				startAt: schoolStart,
				endAt: schoolEnd,
			},
		] as never;
		database.task.findMany = async () => [
			{
				id: "blocked-task",
				title: "Essay",
				description: "",
				color: "Homework",
				dueAt: dueDate,
				estimatedMinutes: 480,
				blocks: [],
			},
		] as never;
		database.$transaction = async () => {
			transactionCalls += 1;
		};

		await assert.rejects(
			createEventForUser(userId, {
				...event,
				startDate: new Date(schoolEnd.getTime() + 60 * 60 * 1000).toISOString(),
				endDate: new Date(schoolEnd.getTime() + 2 * 60 * 60 * 1000).toISOString(),
			}),
			SchedulingError,
		);
		assert.equal(transactionCalls, 0);
	});

	it("rejects an invalid event interval before opening a transaction", async () => {
		let transactionCalls = 0;
		database.$transaction = async () => {
			transactionCalls += 1;
		};

		await assert.rejects(
			createEventForUser(userId, {
				...event,
				startDate: event.endDate,
			}),
			SchedulingError,
		);
		assert.equal(transactionCalls, 0);
	});
});

describe("repository task insertion", () => {
	it("schedules and persists a valid task plus its generated blocks", async () => {
		let taskRow: Record<string, unknown> | undefined;
		let blockRows: Array<Record<string, unknown>> = [];
		database.$transaction = async (
			operation: (tx: unknown) => Promise<void>,
		) => {
			await operation({
				task: {
					create: async ({ data }: { data: Record<string, unknown> }) => {
						taskRow = data;
					},
				},
				taskBlock: {
					deleteMany: async () => ({ count: 0 }),
					createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
						blockRows = data;
					},
				},
			});
		};

		const created = await createTaskForUser(userId, task);

		assert.ok(taskRow);
		assert.equal(taskRow?.userId, userId);
		assert.equal(taskRow?.title, "Finish essay");
		assert.equal((taskRow?.dueAt as Date).toISOString(), task.dueDate);
		assert.equal(taskRow?.estimatedMinutes, 60);
		assert.equal(created.scheduleStatus?.state, "scheduled");
		assert.ok(blockRows.length > 0);
		assert.ok(blockRows.every((row) => row.taskId === created.id));
		assert.ok(
			blockRows.every(
				(row) => (row.endAt as Date).getTime() <= new Date(task.dueDate).getTime(),
			),
		);
	});
});
