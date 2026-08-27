import assert from "node:assert/strict";
import test from "node:test";
import {
	toPersistedEventInput,
	toPersistedTaskInput,
	toUiEvent,
	toUiTask,
} from "./calendar-mappers.ts";

const user = {
	id: "user-1",
	email: "student@example.com",
	name: "Student",
	image: null,
	timezone: "America/New_York",
};

test("maps persisted events to calendar UI events", () => {
	const event = toUiEvent(
		{
			id: "event-1",
			title: "Class",
			description: "",
			location: "Room 1",
			color: "School",
			startAt: new Date("2026-06-20T13:00:00.000Z"),
			endAt: new Date("2026-06-20T14:00:00.000Z"),
			recurrenceRule: null,
		},
		user,
	);

	assert.deepEqual(event, {
		id: "event-1",
		startDate: "2026-06-20T13:00:00.000Z",
		endDate: "2026-06-20T14:00:00.000Z",
		title: "Class",
		location: "Room 1",
		color: "School",
		description: "",
		user: {
			id: "user-1",
			name: "Student",
			picturePath: null,
		},
	});
});

test("maps UI events to persistence input", () => {
	const event = toPersistedEventInput({
		id: "event-1",
		startDate: "2026-06-20T13:00:00.000Z",
		endDate: "2026-06-20T14:00:00.000Z",
		title: "Class",
		location: "Room 1",
		color: "School",
		description: "",
		user: {
			id: "user-1",
			name: "Student",
			picturePath: null,
		},
	});

	assert.deepEqual(event, {
		title: "Class",
		description: "",
		location: "Room 1",
		color: "School",
		startAt: new Date("2026-06-20T13:00:00.000Z"),
		endAt: new Date("2026-06-20T14:00:00.000Z"),
		recurrenceRule: undefined,
	});
});

test("maps persisted tasks and blocks to calendar UI tasks", () => {
	const task = toUiTask(
		{
			id: "task-1",
			title: "Essay",
			description: "Draft intro",
			color: "Homework",
			dueAt: new Date("2026-06-22T03:59:00.000Z"),
			estimatedMinutes: 120,
			blocks: [
				{
					id: "block-1",
					startAt: new Date("2026-06-21T20:00:00.000Z"),
					endAt: new Date("2026-06-21T21:00:00.000Z"),
					position: 0,
				},
			],
		},
		user,
	);

	assert.deepEqual(task.scheduledBlocks, [
		{
			startDate: "2026-06-21T20:00:00.000Z",
			endDate: "2026-06-21T21:00:00.000Z",
		},
	]);
	assert.equal(task.estimatedHours, 2);
});

test("maps UI tasks to persistence input", () => {
	const task = toPersistedTaskInput({
		id: "task-1",
		title: "Essay",
		description: "Draft intro",
		color: "Homework",
		dueDate: "2026-06-22T03:59:00.000Z",
		estimatedHours: 2,
		user: {
			id: "user-1",
			name: "Student",
			picturePath: null,
		},
	});

	assert.deepEqual(task, {
		title: "Essay",
		description: "Draft intro",
		color: "Homework",
		dueAt: new Date("2026-06-22T03:59:00.000Z"),
		estimatedMinutes: 120,
	});
});
